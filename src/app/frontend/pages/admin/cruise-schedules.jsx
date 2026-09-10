"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const emptyCruiseForm = {
  location_id: "",
  schedule_name: "",
  departure_date: "",
  return_date: "",
  capacity: "",
  is_active: true,
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

function getCruiseDays(schedule) {
  const departure = new Date(schedule?.departure_date);
  const arrival = new Date(schedule?.return_date);

  if (
    Number.isNaN(departure.getTime()) ||
    Number.isNaN(arrival.getTime()) ||
    arrival <= departure
  ) {
    return "-";
  }

  return Math.ceil((arrival - departure) / (1000 * 60 * 60 * 24));
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

function FilterLabel({ children }) {
  return (
    <label className="mb-1 block text-xs font-semibold text-gray-600">
      {children}
    </label>
  );
}

// function DaysRangeFilter({ value, onChange }) {
//   const activeValue = Number(value || 1);
//   const bubbleLeft = ((activeValue - 1) / 29) * 100;

//   return (
//     <div className="rounded-xl border border-green-100 bg-white px-4 py-3 shadow-sm xl:col-span-5">
//       <div className="mb-2 flex items-center justify-between gap-3">
//         <div>
//           <p className="text-lg font-bold text-green-700">
//             Days : {value ? activeValue : "All"}
//           </p>
//           <p className="text-xs text-gray-500">
//             Select cruise duration from 1 to 30 days.
//           </p>
//         </div>

//         <button
//           type="button"
//           onClick={() => onChange("")}
//           className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-50"
//         >
//           All Days
//         </button>
//       </div>

//       <div className="relative mt-7 px-2 pb-1">
//         {value && (
//           <div
//             className="absolute -top-7 z-10 -translate-x-1/2"
//             style={{ left: `${bubbleLeft}%` }}
//           >
//             <div className="relative rounded-md border border-green-600 bg-green-50 px-5 py-1.5 text-lg font-bold leading-none text-green-700 shadow-md">
//               {activeValue}

//               <span className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-green-600 bg-green-50" />
//             </div>
//           </div>
//         )}

//         <input
//           type="range"
//           min="1"
//           max="30"
//           step="1"
//           value={activeValue}
//           onChange={(event) => onChange(event.target.value)}
//           className="days-range-slider w-full"
//         />

//         <div className="mt-1 flex justify-between text-[11px] font-semibold text-gray-400">
//           <span>1 Day</span>
//           <span>30 Days</span>
//         </div>
//       </div>

//       <style jsx>{`
//         .days-range-slider {
//           height: 10px;
//           appearance: none;
//           -webkit-appearance: none;
//           border-radius: 999px;
//           background: linear-gradient(
//             to right,
//             #8acb55 0%,
//             #8acb55 ${value ? bubbleLeft : 0}%,
//             #f3f4f6 ${value ? bubbleLeft : 0}%,
//             #f3f4f6 100%
//           );
//           border: 1px solid #d1d5db;
//           outline: none;
//           box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
//         }

//         .days-range-slider::-webkit-slider-thumb {
//           appearance: none;
//           -webkit-appearance: none;
//           width: 28px;
//           height: 28px;
//           border-radius: 999px;
//           background: #7ac943;
//           border: 3px solid #ffffff;
//           box-shadow: 0 5px 12px rgba(0, 0, 0, 0.22);
//           cursor: pointer;
//         }

//         .days-range-slider::-moz-range-thumb {
//           width: 28px;
//           height: 28px;
//           border-radius: 999px;
//           background: #7ac943;
//           border: 3px solid #ffffff;
//           box-shadow: 0 5px 12px rgba(0, 0, 0, 0.22);
//           cursor: pointer;
//         }
//       `}</style>
//     </div>
//   );
// }

function getLocationIdValue(locationId) {
  if (!locationId) return "";
  if (typeof locationId === "string") return locationId;
  return locationId._id || "";
}

function getLocationName(locationId) {
  if (!locationId) return "-";
  if (typeof locationId === "string") return locationId;
  return locationId.name || "-";
}

function normalizeFormFromSchedule(schedule) {
  return {
    location_id: getLocationIdValue(schedule?.location_id),
    schedule_name: schedule?.schedule_name || schedule?.ship_name || "",
    departure_date: toDateInputValue(schedule?.departure_date),
    return_date: toDateInputValue(schedule?.return_date),
    capacity: String(schedule?.capacity ?? ""),
    is_active: schedule?.is_active !== false,
  };
}

function buildPayloadFromForm(form) {
  return {
    location_id: form.location_id,
    schedule_name: String(form.schedule_name || "").trim(),
    ship_name: String(form.schedule_name || "").trim(),
    departure_date: form.departure_date,
    return_date: form.return_date,
    capacity: Number(form.capacity || 0),
    is_active: Boolean(form.is_active),

    price_per_slot: 0,
    shuttle_slots: [],
    shuttle_times: [],
  };
}

function CruiseScheduleFormModal({
  open,
  mode,
  form,
  setForm,
  cruiseLocations,
  saving,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === "edit" ? "Edit Cruise" : "Add Cruise"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage cruise ship schedule details. Price and shuttle slots are
              controlled from Settings.
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
                onChange={(event) =>
                  updateField("location_id", event.target.value)
                }
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                required
              >
                <option value="">Select cruise location</option>
                {cruiseLocations.map((location) => (
                  <option key={location._id} value={location._id}>
                    {location.name}
                  </option>
                ))}
              </select>

              {cruiseLocations.length === 0 && (
                <p className="mt-2 text-xs text-red-600">
                  No active cruise location found. Create a cruise location
                  first.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Ship Name
              </label>

              <input
                value={form.schedule_name}
                onChange={(event) =>
                  updateField("schedule_name", event.target.value)
                }
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                placeholder="Ship name"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Ship Departure Date
              </label>

              <input
                type="date"
                value={form.departure_date}
                onChange={(event) =>
                  updateField("departure_date", event.target.value)
                }
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Ship Arrival Date
              </label>

              <input
                type="date"
                value={form.return_date}
                onChange={(event) =>
                  updateField("return_date", event.target.value)
                }
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Capacity
              </label>

              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(event) => updateField("capacity", event.target.value)}
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                placeholder="Total cruise parking capacity"
                required
              />
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
                Active cruise schedule
              </label>
            </div>
          </div>

          <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            Cruise prices are managed from{" "}
            <strong>Settings → Prices Per Day</strong>. Cruise shuttle slots are
            managed from <strong>Settings → Shuttle Time Slots</strong>.
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
              disabled={saving || cruiseLocations.length === 0}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : mode === "edit"
                ? "Save Changes"
                : "Create Cruise"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCruiseSchedulesPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [cruiseLocations, setCruiseLocations] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
  });

  const [filters, setFilters] = useState({
    search: "",
    location_id: "",
    is_active: "",
    departure_from: "",
    arrival_date: "",
    days_range: "",
    limit: 20,
  });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [form, setForm] = useState(emptyCruiseForm);

  const totals = useMemo(() => {
    const activeItem = breakdown.find((item) => item.is_active === true);
    const inactiveItem = breakdown.find((item) => item.is_active === false);

    return {
      total: Number(pagination.total || 0),
      active: Number(activeItem?.count || 0),
      inactive: Number(inactiveItem?.count || 0),
    };
  }, [breakdown, pagination.total]);

  const fetchCruiseLocations = useCallback(async () => {
    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setLocationsLoading(true);

      const res = await axios.get("/admin/locations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          type: "cruise",
          is_active: "true",
          limit: 100,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load cruise locations."
        );
      }

      setCruiseLocations(res.data.data?.locations || []);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to load cruise locations."
      );
    } finally {
      setLocationsLoading(false);
    }
  }, [router]);

  const fetchSchedules = useCallback(async () => {
    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await axios.get("/admin/cruise-schedules", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          page,
          limit: filters.limit,
          search: filters.search || undefined,
          location_id: filters.location_id || undefined,
          is_active: filters.is_active || undefined,

          departure_from: filters.departure_from || undefined,
          arrival_date: filters.arrival_date || undefined,
          return_date: filters.arrival_date || undefined,
          ship_arrival_date: filters.arrival_date || undefined,

          days_range: filters.days_range || undefined,
          days: filters.days_range || undefined,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load cruise schedules."
        );
      }

      setSchedules(res.data.data?.schedules || []);
      setBreakdown(res.data.data?.breakdown || []);
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
        "Failed to load cruise schedules.";

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
  }, [
    filters.search,
    filters.location_id,
    filters.is_active,
    filters.departure_from,
    filters.arrival_date,
    filters.days_range,
    filters.limit,
  ]);

  useEffect(() => {
    if (!mounted) return;

    fetchCruiseLocations();
    fetchSchedules();
  }, [mounted, fetchCruiseLocations, fetchSchedules]);

  function updateFilter(name, value) {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function clearFilters() {
    setFilters({
      search: "",
      location_id: "",
      is_active: "",
      departure_from: "",
      arrival_date: "",
      days_range: "",
      limit: 20,
    });
    setPage(1);
  }

  function openCreateModal() {
    setFormMode("create");
    setEditingSchedule(null);
    setForm(emptyCruiseForm);
    setFormOpen(true);
  }

  function openEditModal(schedule) {
    setFormMode("edit");
    setEditingSchedule(schedule);
    setForm(normalizeFormFromSchedule(schedule));
    setFormOpen(true);
  }

  function closeFormModal() {
    if (saving) return;

    setFormOpen(false);
    setEditingSchedule(null);
    setForm(emptyCruiseForm);
  }

  function validatePayload(payload) {
    if (!payload.location_id) {
      throw new Error("Cruise location is required.");
    }

    if (!payload.schedule_name) {
      throw new Error("Ship name is required.");
    }

    if (!payload.departure_date) {
      throw new Error("Ship departure date is required.");
    }

    if (!payload.return_date) {
      throw new Error("Ship arrival date is required.");
    }

    if (new Date(payload.return_date) <= new Date(payload.departure_date)) {
      throw new Error("Ship arrival date must be after ship departure date.");
    }

    if (!Number.isFinite(payload.capacity) || payload.capacity < 1) {
      throw new Error("Capacity must be at least 1.");
    }
  }

  async function handleSubmitSchedule(event) {
    event.preventDefault();

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSaving(true);

      const payload = buildPayloadFromForm(form);
      validatePayload(payload);

      let res;

      if (formMode === "edit" && editingSchedule?._id) {
        res = await axios.patch(
          `/admin/cruise-schedules/${editingSchedule._id}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } else {
        res = await axios.post("/admin/cruise-schedules", payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to save cruise schedule."
        );
      }

      setFormOpen(false);
      setEditingSchedule(null);
      setForm(emptyCruiseForm);

      await fetchSchedules();

      alert(res.data.message || "Cruise schedule saved successfully.");
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to save cruise schedule."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSchedule(schedule) {
    const confirmed = window.confirm(
      `Delete cruise schedule "${schedule.schedule_name}"?\n\nThis permanently deletes unused cruise schedules. If bookings are using it, backend will block deletion.`
    );

    if (!confirmed) return;

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      const res = await axios.delete(`/admin/cruise-schedules/${schedule._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to delete cruise schedule."
        );
      }

      alert(res.data.message || "Cruise schedule deleted successfully.");
      await fetchSchedules();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to delete cruise schedule."
      );
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Cruise Schedules
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Add and manage cruise ships, locations, departure dates, arrival
              dates, and capacity.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={locationsLoading}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add Cruise
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Cruises" value={totals.total} />
        <StatCard title="Active Cruises" value={totals.active} />
        <StatCard title="Inactive Cruises" value={totals.inactive} />
      </div>

    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
  <div className="mb-4 flex items-center justify-between">
    <h2 className="text-sm font-semibold text-gray-900">
      Filter Cruises
    </h2>

    <button
      type="button"
      onClick={clearFilters}
      className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
    >
      Clear
    </button>
  </div>

  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
    <div className="xl:col-span-2">
      <FilterLabel>Search Ship Name</FilterLabel>
      <input
        type="text"
        value={filters.search}
        onChange={(e) => updateFilter("search", e.target.value)}
        placeholder="Search ship name..."
        className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none transition focus:border-blue-500"
      />
    </div>

    <div>
      <FilterLabel>Cruise Location</FilterLabel>
      <select
        value={filters.location_id}
        onChange={(e) => updateFilter("location_id", e.target.value)}
        className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none transition focus:border-blue-500"
      >
        <option value="">All Locations</option>
        {cruiseLocations.map((location) => (
          <option key={location._id} value={location._id}>
            {location.name}
          </option>
        ))}
      </select>
    </div>

    <div>
      <FilterLabel>Status</FilterLabel>
      <select
        value={filters.is_active}
        onChange={(e) => updateFilter("is_active", e.target.value)}
        className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none transition focus:border-blue-500"
      >
        {activeOptions.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>

    <div>
      <FilterLabel>Departure Date</FilterLabel>
      <input
        type="date"
        value={filters.departure_from}
        onChange={(e) =>
          updateFilter("departure_from", e.target.value)
        }
        className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none transition focus:border-blue-500"
      />
    </div>

    <div>
      <FilterLabel>Arrival Date</FilterLabel>
      <input
        type="date"
        value={filters.arrival_date}
        onChange={(e) =>
          updateFilter("arrival_date", e.target.value)
        }
        className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none transition focus:border-blue-500"
      />
    </div>

    <div>
      <FilterLabel>Per Page</FilterLabel>
      <select
        value={filters.limit}
        onChange={(e) =>
          updateFilter("limit", Number(e.target.value))
        }
        className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none transition focus:border-blue-500"
      >
        <option value={10}>10</option>
        <option value={20}>20</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
      </select>
    </div>

    {/* <DaysRangeFilter
      value={filters.days_range}
      onChange={(value) => updateFilter("days_range", value)}
    /> */}
  </div>
</div>

      {loading && (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            Loading cruise schedules...
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we load cruise schedules.
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="font-bold">Cruise schedules could not be loaded</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {schedules.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No cruise schedules found.
            </div>
          ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
  <table className="w-full text-left text-sm">
    <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
      <tr>
        <th className="px-3 py-2">Ship</th>
        <th className="px-3 py-2">Location</th>
        <th className="px-3 py-2">Departure</th>
        <th className="px-3 py-2">Arrival</th>
        <th className="px-3 py-2">Days</th>
        <th className="px-3 py-2">Capacity</th>
        <th className="px-3 py-2">Status</th>
        <th className="px-3 py-2 text-right">Actions</th>
      </tr>
    </thead>

    <tbody className="divide-y divide-gray-100">
      {schedules.map((schedule) => (
        <tr
          key={schedule._id}
          className="hover:bg-gray-50 transition"
        >
          <td className="px-3 py-2">
            <p className="font-medium text-gray-900">
              {schedule.schedule_name}
            </p>
          </td>

          <td className="px-3 py-2 text-gray-600">
            {getLocationName(schedule.location_id)}
          </td>

          <td className="px-3 py-2 text-gray-600">
            {formatDate(schedule.departure_date)}
          </td>

          <td className="px-3 py-2 text-gray-600">
            {formatDate(schedule.return_date)}
          </td>

          <td className="px-3 py-2">
            <span className="inline-flex rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
              {getCruiseDays(schedule)}{" "}
              {Number(getCruiseDays(schedule)) === 1 ? "Day" : "Days"}
            </span>
          </td>

          <td className="px-3 py-2 text-gray-700">
            <span className="font-medium">
              {Number(schedule.booked_count || 0)}
            </span>
            <span className="text-gray-400"> / {schedule.capacity || 0}</span>
          </td>

          <td className="px-3 py-2">
            <Badge active={schedule.is_active} />
          </td>

          <td className="px-3 py-2">
            <div className="flex justify-end gap-2">
              <button
                onClick={() => openEditModal(schedule)}
                className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Edit
              </button>

              <button
                onClick={() => handleDeleteSchedule(schedule)}
                className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          </td>
        </tr>
      ))}
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

      <CruiseScheduleFormModal
        open={formOpen}
        mode={formMode}
        form={form}
        setForm={setForm}
        cruiseLocations={cruiseLocations}
        saving={saving}
        onClose={closeFormModal}
        onSubmit={handleSubmitSchedule}
      />
    </div>
  );
}