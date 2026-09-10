"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const emptyAirportForm = {
  location_id: "",
  capacity: "",
  is_active: true,
  show_shuttle_options: false,
  blocked_dates: [],
};

const activeOptions = [
  { value: "", label: "All Statuses" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
}

function clearAdminSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
}

function formatDate(date) {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateInputValue(date) {
  if (!date) return "";

  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.slice(0, 10);
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

function parseYmdDate(value) {
  if (!value) return null;

  const [year, month, day] = String(value).split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function toYmdDate(date) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateRangeValues(startDate, endDate) {
  const start = parseYmdDate(toDateInputValue(startDate));
  const end = parseYmdDate(toDateInputValue(endDate || startDate));

  if (!start || !end || end < start) return [];

  const values = [];
  const current = new Date(start);

  while (current <= end) {
    values.push(toYmdDate(current));
    current.setDate(current.getDate() + 1);
  }

  return values;
}

function getBlockedDateValues(location) {
  const dateValues = [];

  if (!Array.isArray(location?.blocked_dates)) {
    return dateValues;
  }

  location.blocked_dates.forEach((item) => {
    if (!item || item.is_active === false) return;

    const dates = getDateRangeValues(item.start_date, item.end_date);

    dates.forEach((dateValue) => {
      if (!dateValues.includes(dateValue)) {
        dateValues.push(dateValue);
      }
    });
  });

  return dateValues.sort();
}

function formatDisplayDate(value) {
  if (!value) return "-";

  const parsedDate = parseYmdDate(value);

  if (!parsedDate) return "-";

  return parsedDate.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Badge({ active }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function normalizeAirportFormFromLocation(location) {
  const blockedDateValues = getBlockedDateValues(location);

  return {
    location_id: location?._id || "",
    capacity: String(location?.capacity ?? ""),
    is_active: location?.is_active !== false,
    show_shuttle_options: Boolean(location?.show_shuttle_options),
    blocked_dates: blockedDateValues.map((dateValue) => ({
      start_date: dateValue,
      end_date: dateValue,
      is_active: true,
    })),
  };
}

function buildAirportPayload(form, selectedLocation) {
  const blockedDates = form.blocked_dates
    .filter((item) => item.start_date)
    .map((item) => ({
      start_date: item.start_date,
      end_date: item.end_date || item.start_date,
      reason: "",
      is_active: item.is_active !== false,
    }));

  return {
    name: selectedLocation?.name || "",
    type: "airport",
    address: selectedLocation?.address || "",
    is_active: Boolean(form.is_active),
    capacity: Number(form.capacity || 0),
    show_shuttle_options: Boolean(form.show_shuttle_options),
    blocked_dates: blockedDates,
    storage_types: [],
  };
}

function validateAirportPayload(payload) {
  if (!payload.name) {
    throw new Error("Airport location is required.");
  }

  if (!Number.isFinite(payload.capacity) || payload.capacity < 0) {
    throw new Error("Capacity cannot be negative.");
  }

  for (const item of payload.blocked_dates || []) {
    if (!item.start_date) {
      throw new Error("Blocked date is required.");
    }

    const startDate = new Date(item.start_date);
    const endDate = new Date(item.end_date || item.start_date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error("Invalid blocked date.");
    }

    if (endDate < startDate) {
      throw new Error("Blocked date end date cannot be before start date.");
    }
  }
}

function BlockDatesViewModal({ location, onClose }) {
  if (!location) return null;

  const dateValues = getBlockedDateValues(location);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Blocked Dates</h2>
            <p className="mt-1 text-sm text-gray-500">{location.name}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Close
          </button>
        </div>

        <div className="p-6">
          {dateValues.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">
              No blocked dates added.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {dateValues.map((dateValue) => (
                <div
                  key={dateValue}
                  className="rounded-xl border bg-gray-50 p-4"
                >
                  <p className="text-sm font-bold text-gray-900">
                    {formatDisplayDate(dateValue)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{dateValue}</p>
                </div>
              ))}
            </div>
          )}

          <p className="mt-5 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
            These dates are disabled for airport booking availability.
          </p>
        </div>
      </div>
    </div>
  );
}

function BlockDateCalendarModal({
  open,
  selectedDates,
  onToggleDate,
  onClose,
}) {
  const [viewDate, setViewDate] = useState(() => new Date());

  if (!open) return null;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startPadding = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const calendarCells = [];

  for (let index = 0; index < startPadding; index += 1) {
    calendarCells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    calendarCells.push(new Date(year, month, day));
  }

  function goPreviousMonth() {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goNextMonth() {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  const monthLabel = viewDate.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });

  const selectedSet = new Set(selectedDates);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Select Block Dates
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Select one or multiple dates.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
          >
            Done
          </button>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={goPreviousMonth}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
            >
              Prev
            </button>

            <h4 className="text-base font-bold text-gray-900">{monthLabel}</h4>

            <button
              type="button"
              onClick={goNextMonth}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-500">
            <div>Su</div>
            <div>Mo</div>
            <div>Tu</div>
            <div>We</div>
            <div>Th</div>
            <div>Fr</div>
            <div>Sa</div>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarCells.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} />;
              }

              const value = toYmdDate(date);
              const selected = selectedSet.has(value);

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onToggleDate(value)}
                  className={`h-9 rounded-lg border text-xs font-semibold ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "bg-white text-gray-800 hover:bg-gray-50"
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {selectedDates.length > 0 && (
            <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              Selected dates: <strong>{selectedDates.length}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AirportFormModal({
  open,
  mode,
  form,
  setForm,
  locations,
  saving,
  onClose,
  onSubmit,
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  if (!open) return null;

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleLocationChange(locationId) {
    const location = locations.find((item) => item._id === locationId);

    if (!location) {
      setForm(emptyAirportForm);
      return;
    }

    setForm(normalizeAirportFormFromLocation(location));
  }

  function getSelectedBlockedDates() {
    return form.blocked_dates
      .map((item) => item.start_date)
      .filter(Boolean)
      .sort();
  }

  function toggleBlockedDate(dateValue) {
    setForm((prev) => {
      const exists = prev.blocked_dates.some(
        (item) => item.start_date === dateValue
      );

      if (exists) {
        return {
          ...prev,
          blocked_dates: prev.blocked_dates.filter(
            (item) => item.start_date !== dateValue
          ),
        };
      }

      return {
        ...prev,
        blocked_dates: [
          ...prev.blocked_dates,
          {
            start_date: dateValue,
            end_date: dateValue,
            is_active: true,
          },
        ],
      };
    });
  }

  function removeBlockedDate(dateValue) {
    setForm((prev) => ({
      ...prev,
      blocked_dates: prev.blocked_dates.filter(
        (item) => item.start_date !== dateValue
      ),
    }));
  }

  const selectedLocation = locations.find(
    (location) => location._id === form.location_id
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === "edit" ? "Edit Airport" : "Add Airport"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Configure airport capacity, blocked dates, and shuttle option
              availability.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Select Location
              </label>

              <select
                value={form.location_id}
                onChange={(event) => handleLocationChange(event.target.value)}
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                required
              >
                <option value="">Select airport location</option>
                {locations.map((location) => (
                  <option key={location._id} value={location._id}>
                    {location.name}
                  </option>
                ))}
              </select>

              {locations.length === 0 && (
                <p className="mt-2 text-xs text-red-600">
                  No airport location found. Create an Airport location first
                  from Locations.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Capacity
              </label>

              <input
                type="number"
                min="0"
                value={form.capacity}
                onChange={(event) => updateField("capacity", event.target.value)}
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                required
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={form.show_shuttle_options}
                  onChange={(event) =>
                    updateField("show_shuttle_options", event.target.checked)
                  }
                />
                See Shuttle Options
              </label>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    updateField("is_active", event.target.checked)
                  }
                />
                Active airport
              </label>
            </div>
          </div>

          {selectedLocation && (
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              Selected location:{" "}
              <strong className="text-gray-900">{selectedLocation.name}</strong>
            </div>
          )}

          <div className="rounded-2xl border bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Block Dates</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Select one or multiple dates from the calendar.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCalendarOpen(true)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Add Block Date
              </button>
            </div>

            <div className="mt-4">
              {form.blocked_dates.length === 0 ? (
                <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                  No blocked dates selected.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {getSelectedBlockedDates().map((dateValue) => (
                    <div
                      key={dateValue}
                      className="flex items-center justify-between gap-3 rounded-xl border p-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          {formatDisplayDate(dateValue)}
                        </p>
                        <p className="text-xs text-gray-500">{dateValue}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeBlockedDate(dateValue)}
                        className="rounded-lg border border-red-600 px-3 py-2 text-xs font-semibold text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <BlockDateCalendarModal
              open={calendarOpen}
              selectedDates={getSelectedBlockedDates()}
              onToggleDate={toggleBlockedDate}
              onClose={() => setCalendarOpen(false)}
            />
          </div>

          <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            Shuttle time slots are now managed from{" "}
            <strong>Settings → Shuttle Time Slots</strong>. This page only
            enables or disables shuttle options for the selected airport.
          </div>

          <div className="flex justify-end gap-3 border-t pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || locations.length === 0}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : mode === "edit"
                ? "Save Changes"
                : "Add Airport"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminAirportPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [locations, setLocations] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
  });

  const [filters, setFilters] = useState({
    search: "",
    is_active: "",
    limit: 20,
  });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [blockDatesLocation, setBlockDatesLocation] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingLocation, setEditingLocation] = useState(null);
  const [form, setForm] = useState(emptyAirportForm);

  const stats = useMemo(() => {
    const active = locations.filter(
      (location) => location.is_active !== false
    ).length;

    const inactive = locations.filter(
      (location) => location.is_active === false
    ).length;

    return {
      total: Number(pagination.total || locations.length),
      active,
      inactive,
    };
  }, [locations, pagination.total]);

  const fetchAirportLocations = useCallback(async () => {
    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await axios.get("/admin/locations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          page,
          limit: filters.limit,
          search: filters.search || undefined,
          type: "airport",
          is_active: filters.is_active || undefined,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load airport locations."
        );
      }

      setLocations(res.data.data?.locations || []);
      setPagination(
        res.data.data?.pagination || {
          page,
          limit: filters.limit,
          total: 0,
          total_pages: 1,
        }
      );
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to load airport locations.";

      setError(message);

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        router.replace("/admin/login");
      }
    } finally {
      setLoading(false);
    }
  }, [filters, page, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.is_active, filters.limit]);

  useEffect(() => {
    if (!mounted) return;
    fetchAirportLocations();
  }, [mounted, fetchAirportLocations]);

  function updateFilter(name, value) {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function clearFilters() {
    setFilters({
      search: "",
      is_active: "",
      limit: 20,
    });
    setPage(1);
  }

  function openAddAirportModal() {
    setFormMode("create");
    setEditingLocation(null);
    setForm(emptyAirportForm);
    setFormOpen(true);
  }

  function openEditAirportModal(location) {
    setFormMode("edit");
    setEditingLocation(location);
    setForm(normalizeAirportFormFromLocation(location));
    setFormOpen(true);
  }

  function closeFormModal() {
    if (saving) return;

    setFormOpen(false);
    setEditingLocation(null);
    setForm(emptyAirportForm);
  }

  async function handleSubmitAirport(event) {
    event.preventDefault();

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSaving(true);

      const selectedLocation = locations.find(
        (location) => location._id === form.location_id
      );

      if (!selectedLocation) {
        throw new Error("Please select an airport location.");
      }

      const payload = buildAirportPayload(form, selectedLocation);

      validateAirportPayload(payload);

      const res = await axios.patch(
        `/admin/locations/${form.location_id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to save airport."
        );
      }

      alert(res.data.message || "Airport saved successfully.");
      closeFormModal();
      await fetchAirportLocations();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to save airport."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAirportLocation(location) {
    const confirmed = window.confirm(
      `Delete airport location "${location.name}"?\n\nThis will permanently delete the location if no bookings are using it.`
    );

    if (!confirmed) return;

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      const res = await axios.delete(`/admin/locations/${location._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to delete airport location."
        );
      }

      alert(res.data.message || "Airport location deleted successfully.");
      await fetchAirportLocations();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to delete airport location."
      );
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Airport</h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage airport locations, capacity, blocked dates, and shuttle
              option availability.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddAirportModal}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
          >
            Add Airport
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Airport Locations" value={stats.total} />
        <StatCard title="Active Airports" value={stats.active} />
        <StatCard title="Inactive Airports" value={stats.inactive} />
      </div>

      <section className="space-y-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              type="text"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search airport location"
              className="rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600 xl:col-span-2"
            />

            <select
              value={filters.is_active}
              onChange={(event) => updateFilter("is_active", event.target.value)}
              className="rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            >
              {activeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.limit}
              onChange={(event) =>
                updateFilter("limit", Number(event.target.value))
              }
              className="rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Loading airport locations...
            </h2>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <h2 className="font-bold">Airport locations could not be loaded</h2>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            {locations.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No airport locations found. Create an Airport location first
                from Locations.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-700">
                      <th className="px-4 py-3">Location Name</th>
                      <th className="px-4 py-3">Capacity</th>
                      <th className="px-4 py-3">Block Dates</th>
                      <th className="px-4 py-3">See Shuttle Options</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {locations.map((location) => {
                      const blockedCount = getBlockedDateValues(location).length;
                      const shuttleEnabled = Boolean(
                        location.show_shuttle_options
                      );

                      return (
                        <tr
                          key={location._id}
                          className="border-b align-middle"
                        >
                          <td className="min-w-[220px] px-4 py-3">
                            <p className="font-bold text-gray-900">
                              {location.name}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              Created: {formatDate(location.createdAt)}
                            </p>
                          </td>

                          <td className="px-4 py-3 font-semibold">
                            {Number(location.booked_count || 0)} /{" "}
                            {Number(location.capacity || 0)}
                          </td>

                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setBlockDatesLocation(location)}
                              className="rounded-lg border px-3 py-2 text-xs font-semibold text-gray-700"
                            >
                              See Block Dates ({blockedCount})
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                shuttleEnabled
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {shuttleEnabled ? "Yes" : "No"}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <Badge active={location.is_active} />
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openEditAirportModal(location)}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteAirportLocation(location)
                                }
                                className="rounded-lg border border-red-600 px-3 py-2 text-xs font-semibold text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600">
                Showing page {pagination.page || page} of{" "}
                {pagination.total_pages || 1}. Total records:{" "}
                {pagination.total || 0}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!pagination.has_prev_page}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>

                <button
                  type="button"
                  disabled={!pagination.has_next_page}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <AirportFormModal
        open={formOpen}
        mode={formMode}
        form={form}
        setForm={setForm}
        locations={locations}
        saving={saving}
        onClose={closeFormModal}
        onSubmit={handleSubmitAirport}
      />

      <BlockDatesViewModal
        location={blockDatesLocation}
        onClose={() => setBlockDatesLocation(null)}
      />
    </div>
  );
}