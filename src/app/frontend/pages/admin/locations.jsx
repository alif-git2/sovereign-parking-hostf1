"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const emptyLocationForm = {
  name: "",
  type: "",
  is_active: true,
};

const locationTypes = [
  { value: "", label: "All Types" },
  { value: "cruise", label: "Cruise" },
  { value: "storage", label: "Storage" },
  { value: "airport", label: "Airport" },
];

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

function formatText(value) {
  if (!value) return "-";

  const labels = {
    cruise: "Cruise",
    storage: "Storage",
    airport: "Airport",
  };

  if (labels[value]) return labels[value];

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function TypeBadge({ type }) {
  const classes = {
    cruise: "bg-cyan-50 text-cyan-700",
    storage: "bg-purple-50 text-purple-700",
    airport: "bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        classes[type] || "bg-gray-100 text-gray-700"
      }`}
    >
      {formatText(type)}
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

function normalizeFormFromLocation(location) {
  return {
    name: location?.name || "",
    type: location?.type || "",
    is_active: location?.is_active !== false,
  };
}

function buildPayloadFromForm(form) {
  return {
    name: String(form.name || "").trim(),
    type: form.type,
    is_active: Boolean(form.is_active),

    // Keep backend defaults clean.
    address: "",
    capacity: 0,
    price_per_day: 0,
    shuttle_times: [],
    shuttle_slots: [],
    blocked_dates: [],
    storage_types: [],
  };
}

function LocationFormModal({
  open,
  mode,
  form,
  setForm,
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
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === "edit" ? "Edit Location" : "Create Location"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Create locations by booking type.
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

        <form onSubmit={onSubmit} className="space-y-5 p-6">
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Location Name
            </label>

            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
              placeholder="Location name"
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Type</label>

            <select
              value={form.type}
              onChange={(event) => updateField("type", event.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
              required
            >
              <option value="">Select Type</option>
              <option value="cruise">Cruise</option>
              <option value="storage">Storage</option>
              <option value="airport">Airport</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                updateField("is_active", event.target.checked)
              }
            />
            Active location
          </label>

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
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : mode === "edit"
                ? "Save Changes"
                : "Create Location"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminLocationsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [locations, setLocations] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
  });

  const [filters, setFilters] = useState({
    search: "",
    type: "",
    is_active: "",
    limit: 20,
  });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingLocation, setEditingLocation] = useState(null);
  const [form, setForm] = useState(emptyLocationForm);

  const totals = useMemo(() => {
    const total = Number(pagination.total || 0);

    if (breakdown.length === 0) {
      const active = locations.filter((location) => location.is_active).length;
      const inactive = locations.filter((location) => !location.is_active)
        .length;

      return {
        total,
        active,
        inactive,
      };
    }

    const active = breakdown.reduce(
      (sum, item) => sum + Number(item.active || 0),
      0
    );

    const inactive = breakdown.reduce(
      (sum, item) => sum + Number(item.inactive || 0),
      0
    );

    return {
      total,
      active,
      inactive,
    };
  }, [breakdown, locations, pagination.total]);

  const fetchLocations = useCallback(async () => {
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
          type: filters.type || undefined,
          is_active: filters.is_active || undefined,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to load locations."
        );
      }

      setLocations(res.data.data?.locations || []);
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
        "Failed to load locations.";

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
  }, [filters.search, filters.type, filters.is_active, filters.limit]);

  useEffect(() => {
    if (!mounted) return;
    fetchLocations();
  }, [mounted, fetchLocations]);

  function updateFilter(name, value) {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function clearFilters() {
    setFilters({
      search: "",
      type: "",
      is_active: "",
      limit: 20,
    });
    setPage(1);
  }

  function openCreateModal() {
    setFormMode("create");
    setEditingLocation(null);
    setForm(emptyLocationForm);
    setFormOpen(true);
  }

  function openEditModal(location) {
    setFormMode("edit");
    setEditingLocation(location);
    setForm(normalizeFormFromLocation(location));
    setFormOpen(true);
  }

  function closeFormModal() {
    if (saving) return;

    setFormOpen(false);
    setEditingLocation(null);
    setForm(emptyLocationForm);
  }

  async function handleSubmitLocation(event) {
    event.preventDefault();

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSaving(true);

      const payload = buildPayloadFromForm(form);

      if (!payload.name) {
        throw new Error("Location name is required.");
      }

      if (!payload.type) {
        throw new Error("Location type is required.");
      }

      let res;

      if (formMode === "edit" && editingLocation?._id) {
        res = await axios.patch(
          `/admin/locations/${editingLocation._id}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } else {
        res = await axios.post("/admin/locations", payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to save location."
        );
      }

      alert(res.data.message || "Location saved successfully.");
      closeFormModal();
      await fetchLocations();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to save location."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLocation(location) {
    const confirmed = window.confirm(
      `Delete location "${location.name}"?\n\nThis will deactivate it so existing booking data stays safe.`
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
          res.data?.message || res.data?.error || "Failed to delete location."
        );
      }

      alert(res.data.message || "Location deleted successfully.");
      await fetchLocations();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to delete location."
      );
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
            <p className="mt-2 text-sm text-gray-500">
              Create and manage booking locations by type.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
          >
            Add Location
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Locations" value={totals.total} />
        <StatCard title="Active Locations" value={totals.active} />
        <StatCard title="Inactive Locations" value={totals.inactive} />
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            type="text"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search location name"
            className="rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600 xl:col-span-2"
          />

          <select
            value={filters.type}
            onChange={(event) => updateFilter("type", event.target.value)}
            className="rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
          >
            {locationTypes.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

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
            Loading locations...
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we load locations.
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="font-bold">Locations could not be loaded</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {locations.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No locations found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-700">
                    <th className="px-4 py-3">Location Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {locations.map((location) => (
                    <tr key={location._id} className="border-b align-middle">
                      <td className="min-w-[260px] px-4 py-3">
                        <p className="font-bold text-gray-900">
                          {location.name}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <TypeBadge type={location.type} />
                      </td>

                      <td className="px-4 py-3">
                        <Badge active={location.is_active} />
                      </td>

                      <td className="min-w-[180px] px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(location)}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteLocation(location)}
                            className="rounded-lg border border-red-600 px-3 py-2 text-xs font-semibold text-red-700"
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

      <LocationFormModal
        open={formOpen}
        mode={formMode}
        form={form}
        setForm={setForm}
        saving={saving}
        onClose={closeFormModal}
        onSubmit={handleSubmitLocation}
      />
    </div>
  );
}