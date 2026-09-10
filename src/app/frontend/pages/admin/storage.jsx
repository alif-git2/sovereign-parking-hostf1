"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const emptyStorageForm = {
  location_id: "",
  capacity: "",
  is_active: true,
};

const emptyStorageTypeForm = {
  name: "",
  capacity: "0",
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

/**
 * Storage Type capacity rules:
 *
 * 0 = Unlimited
 * > 0 = Maximum overlapping bookings
 */
function formatStorageTypeCapacity(capacity) {
  if (
    capacity === undefined ||
    capacity === null ||
    capacity === ""
  ) {
    return "Unlimited";
  }

  const value = Number(capacity);

  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return "Unlimited";
  }

  if (value === 0) {
    return "Unlimited";
  }

  return value;
}

function Badge({ active }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        active
          ? "bg-green-50 text-green-700"
          : "bg-red-50 text-red-700"
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
      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function normalizeStorageFormFromLocation(location) {
  return {
    location_id: location?._id || "",
    capacity: String(location?.capacity ?? ""),
    is_active: location?.is_active !== false,
  };
}

function normalizeStorageTypeForm(storageType) {
  const rawCapacity = storageType?.capacity;

  let capacity = 0;

  if (
    rawCapacity !== undefined &&
    rawCapacity !== null &&
    rawCapacity !== ""
  ) {
    const parsedCapacity = Number(rawCapacity);

    if (
      Number.isFinite(parsedCapacity) &&
      Number.isInteger(parsedCapacity) &&
      parsedCapacity >= 0
    ) {
      capacity = parsedCapacity;
    }
  }

  return {
    name: storageType?.name || "",
    capacity: String(capacity),
  };
}

function buildStoragePayload(form, selectedLocation) {
  return {
    name: selectedLocation?.name || "",
    type: "storage",
    is_active: Boolean(form.is_active),
    address: selectedLocation?.address || "",

    // Compatibility only.
    // Real storage price now comes from Settings -> Prices Per Day.
    price_per_day: Number(selectedLocation?.price_per_day || 0),

    capacity: Number(form.capacity || 0),

    shuttle_times: [],
    shuttle_slots: [],
    blocked_dates: [],
    storage_types: [],
  };
}

function StorageFormModal({
  open,
  mode,
  form,
  setForm,
  locations,
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

  const selectedLocation = locations.find(
    (location) => location._id === form.location_id
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === "edit"
                ? "Edit Storage"
                : "Add Storage"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Select a storage location and set capacity. Storage
              prices are managed from Settings.
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

        <form
          onSubmit={onSubmit}
          className="space-y-5 p-6"
        >
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Select Location
            </label>

            <select
              value={form.location_id}
              onChange={(event) => {
                const locationId = event.target.value;

                const location = locations.find(
                  (item) => item._id === locationId
                );

                setForm((prev) => ({
                  ...prev,
                  location_id: locationId,
                  capacity:
                    locationId && location
                      ? String(location.capacity ?? "")
                      : "",
                  is_active:
                    locationId && location
                      ? location.is_active !== false
                      : true,
                }));
              }}
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
              required
            >
              <option value="">
                Select storage location
              </option>

              {locations.map((location) => (
                <option
                  key={location._id}
                  value={location._id}
                >
                  {location.name}
                </option>
              ))}
            </select>

            {locations.length === 0 && (
              <p className="mt-2 text-xs text-red-600">
                No storage location found. Create a Storage
                location first from Locations.
              </p>
            )}
          </div>

          {selectedLocation && (
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              Selected location:{" "}
              <strong className="text-gray-900">
                {selectedLocation.name}
              </strong>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Capacity
            </label>

            <input
              type="number"
              min="0"
              value={form.capacity}
              onChange={(event) =>
                updateField(
                  "capacity",
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
              placeholder="0"
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                updateField(
                  "is_active",
                  event.target.checked
                )
              }
            />

            Active storage location
          </label>

          <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            Storage prices are managed from{" "}
            <strong>
              Settings → Prices Per Day
            </strong>
            .
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
              disabled={
                saving ||
                locations.length === 0
              }
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : mode === "edit"
                ? "Save Changes"
                : "Create Storage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StorageTypeFormModal({
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
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === "edit"
                ? "Edit Storage Type"
                : "Add Storage Type"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {mode === "edit"
                ? "Update the storage type name and booking capacity."
                : "Set the storage type name and booking capacity."}
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

        <form
          onSubmit={onSubmit}
          className="space-y-5 p-6"
        >
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Storage Type Name
            </label>

            <input
              value={form.name}
              onChange={(event) =>
                updateField(
                  "name",
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
              placeholder="Caravan"
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Capacity
            </label>

            <input
              type="number"
              min="0"
              step="1"
              value={form.capacity}
              onChange={(event) =>
                updateField(
                  "capacity",
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
              placeholder="0"
              required
            />

            <p className="mt-2 text-xs text-gray-500">
              Enter <strong>0</strong> for unlimited
              bookings. Enter a number greater than 0 to
              limit simultaneous bookings for this storage
              type.
            </p>
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
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : mode === "edit"
                ? "Update Storage Type"
                : "Create Storage Type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminStoragePage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  const [locations, setLocations] =
    useState([]);

  const [storageTypes, setStorageTypes] =
    useState([]);

  const [
    locationsPagination,
    setLocationsPagination,
  ] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
  });

  const [
    storageTypesPagination,
    setStorageTypesPagination,
  ] = useState({
    page: 1,
    limit: 50,
    total: 0,
    total_pages: 1,
  });

  const [filters, setFilters] = useState({
    search: "",
    is_active: "",
    limit: 20,
  });

  const [
    storageTypeSearch,
    setStorageTypeSearch,
  ] = useState("");

  const [page, setPage] = useState(1);

  const [
    storageTypePage,
    setStorageTypePage,
  ] = useState(1);

  const [
    locationsLoading,
    setLocationsLoading,
  ] = useState(true);

  const [
    storageTypesLoading,
    setStorageTypesLoading,
  ] = useState(true);

  const [
    savingStorage,
    setSavingStorage,
  ] = useState(false);

  const [
    savingStorageType,
    setSavingStorageType,
  ] = useState(false);

  const [error, setError] = useState("");

  const [
    storageTypeError,
    setStorageTypeError,
  ] = useState("");

  const [
    storageModalOpen,
    setStorageModalOpen,
  ] = useState(false);

  const [
    storageMode,
    setStorageMode,
  ] = useState("create");

  const [
    editingLocation,
    setEditingLocation,
  ] = useState(null);

  const [
    storageForm,
    setStorageForm,
  ] = useState(emptyStorageForm);

  const [
    storageTypeModalOpen,
    setStorageTypeModalOpen,
  ] = useState(false);

  const [
    storageTypeMode,
    setStorageTypeMode,
  ] = useState("create");

  const [
    editingStorageType,
    setEditingStorageType,
  ] = useState(null);

  const [
    storageTypeForm,
    setStorageTypeForm,
  ] = useState(emptyStorageTypeForm);

  const stats = useMemo(() => {
    const activeLocations = locations.filter(
      (location) =>
        location.is_active !== false
    ).length;

    const inactiveLocations = locations.filter(
      (location) =>
        location.is_active === false
    ).length;

    return {
      totalLocations: Number(
        locationsPagination.total ||
          locations.length
      ),

      activeLocations,

      inactiveLocations,

      totalStorageTypes: Number(
        storageTypesPagination.total ||
          storageTypes.length
      ),
    };
  }, [
    locations,
    locationsPagination.total,
    storageTypes,
    storageTypesPagination.total,
  ]);

  const fetchStorageLocations =
    useCallback(async () => {
      const token = getAdminToken();

      if (!token) {
        router.replace("/admin/login");
        return;
      }

      try {
        setLocationsLoading(true);
        setError("");

        const res = await axios.get(
          "/admin/locations",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              page,
              limit: filters.limit,
              search:
                filters.search || undefined,
              type: "storage",
              is_active:
                filters.is_active || undefined,
            },
          }
        );

        if (!res.data?.success) {
          throw new Error(
            res.data?.message ||
              res.data?.error ||
              "Failed to load storage locations."
          );
        }

        setLocations(
          res.data.data?.locations || []
        );

        setLocationsPagination(
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
          "Failed to load storage locations.";

        setError(message);

        if (
          error.response?.status === 401 ||
          error.response?.status === 403
        ) {
          clearAdminSession();
          router.replace("/admin/login");
        }
      } finally {
        setLocationsLoading(false);
      }
    }, [filters, page, router]);

  const fetchStorageTypes =
    useCallback(async () => {
      const token = getAdminToken();

      if (!token) {
        router.replace("/admin/login");
        return;
      }

      try {
        setStorageTypesLoading(true);
        setStorageTypeError("");

        const res = await axios.get(
          "/admin/storage-types",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              page: storageTypePage,
              limit: 50,
              search:
                storageTypeSearch ||
                undefined,
            },
          }
        );

        if (!res.data?.success) {
          throw new Error(
            res.data?.message ||
              res.data?.error ||
              "Failed to load storage types."
          );
        }

        const responseData =
          res.data?.data;

        const list = Array.isArray(
          responseData
        )
          ? responseData
          : responseData?.storageTypes ||
            responseData?.storage_types ||
            responseData?.types ||
            [];

        setStorageTypes(list);

        setStorageTypesPagination(
          responseData?.pagination || {
            page: storageTypePage,
            limit: 50,
            total: Array.isArray(list)
              ? list.length
              : 0,
            total_pages: 1,
            has_prev_page: false,
            has_next_page: false,
          }
        );
      } catch (error) {
        const message =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to load storage types.";

        setStorageTypeError(message);

        if (
          error.response?.status === 401 ||
          error.response?.status === 403
        ) {
          clearAdminSession();
          router.replace("/admin/login");
        }
      } finally {
        setStorageTypesLoading(false);
      }
    }, [
      router,
      storageTypePage,
      storageTypeSearch,
    ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    filters.search,
    filters.is_active,
    filters.limit,
  ]);

  useEffect(() => {
    setStorageTypePage(1);
  }, [storageTypeSearch]);

  useEffect(() => {
    if (!mounted) return;

    fetchStorageLocations();
    fetchStorageTypes();
  }, [
    mounted,
    fetchStorageLocations,
    fetchStorageTypes,
  ]);

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

  function openAddStorageModal() {
    setStorageMode("create");
    setEditingLocation(null);
    setStorageForm(emptyStorageForm);
    setStorageModalOpen(true);
  }

  function openEditStorageModal(location) {
    setStorageMode("edit");

    setEditingLocation(location);

    setStorageForm(
      normalizeStorageFormFromLocation(
        location
      )
    );

    setStorageModalOpen(true);
  }

  function closeStorageModal() {
    if (savingStorage) return;

    setStorageModalOpen(false);
    setEditingLocation(null);
    setStorageForm(emptyStorageForm);
  }

  function openAddStorageTypeModal() {
    setStorageTypeMode("create");
    setEditingStorageType(null);

    setStorageTypeForm({
      name: "",
      capacity: "0",
    });

    setStorageTypeModalOpen(true);
  }

  function openEditStorageTypeModal(
    storageType
  ) {
    setStorageTypeMode("edit");

    setEditingStorageType(storageType);

    setStorageTypeForm(
      normalizeStorageTypeForm(storageType)
    );

    setStorageTypeModalOpen(true);
  }

  function closeStorageTypeModal() {
    if (savingStorageType) return;

    setStorageTypeModalOpen(false);
    setStorageTypeMode("create");
    setEditingStorageType(null);

    setStorageTypeForm({
      name: "",
      capacity: "0",
    });
  }

  async function handleSubmitStorage(event) {
    event.preventDefault();

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSavingStorage(true);

      const selectedLocation =
        locations.find(
          (location) =>
            location._id ===
            storageForm.location_id
        );

      if (!selectedLocation) {
        throw new Error(
          "Please select a storage location."
        );
      }

      const payload = buildStoragePayload(
        storageForm,
        selectedLocation
      );

      if (
        !Number.isFinite(payload.capacity) ||
        payload.capacity < 0
      ) {
        throw new Error(
          "Capacity cannot be negative."
        );
      }

      const res = await axios.patch(
        `/admin/locations/${storageForm.location_id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to save storage."
        );
      }

      setStorageModalOpen(false);
      setEditingLocation(null);
      setStorageForm(emptyStorageForm);

      await fetchStorageLocations();

      alert(
        res.data.message ||
          "Storage saved successfully."
      );
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to save storage."
      );
    } finally {
      setSavingStorage(false);
    }
  }

  async function handleDeleteStorageLocation(
    location
  ) {
    const confirmed = window.confirm(
      `Delete storage location "${location.name}"?\n\nThis will permanently delete the location if no bookings are using it.`
    );

    if (!confirmed) return;

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      const res = await axios.delete(
        `/admin/locations/${location._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to delete storage location."
        );
      }

      alert(
        res.data.message ||
          "Storage location deleted successfully."
      );

      await fetchStorageLocations();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to delete storage location."
      );
    }
  }

  async function handleSubmitStorageType(
    event
  ) {
    event.preventDefault();

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSavingStorageType(true);

      const name = String(
        storageTypeForm.name || ""
      ).trim();

      const capacity = Number(
        storageTypeForm.capacity
      );

      if (!name) {
        throw new Error(
          "Storage type name is required."
        );
      }

      if (name.length < 2) {
        throw new Error(
          "Storage type name must be at least 2 characters."
        );
      }

      if (!Number.isFinite(capacity)) {
        throw new Error(
          "Storage type capacity must be a valid number."
        );
      }

      if (!Number.isInteger(capacity)) {
        throw new Error(
          "Storage type capacity must be a whole number."
        );
      }

      if (capacity < 0) {
        throw new Error(
          "Storage type capacity cannot be negative."
        );
      }

      const payload = {
        name,
        capacity,
      };

      let res;

      if (
        storageTypeMode === "edit"
      ) {
        if (!editingStorageType?._id) {
          throw new Error(
            "Unable to identify the storage type to update."
          );
        }

        res = await axios.patch(
          `/admin/storage-types/${editingStorageType._id}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } else {
        res = await axios.post(
          "/admin/storage-types",
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            (storageTypeMode === "edit"
              ? "Failed to update storage type."
              : "Failed to create storage type.")
        );
      }

      const wasEditing =
        storageTypeMode === "edit";

      setStorageTypeModalOpen(false);
      setStorageTypeMode("create");
      setEditingStorageType(null);

      setStorageTypeForm({
        name: "",
        capacity: "0",
      });

      await fetchStorageTypes();

      alert(
        res.data.message ||
          (wasEditing
            ? "Storage type updated successfully."
            : "Storage type created successfully.")
      );
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          (storageTypeMode === "edit"
            ? "Failed to update storage type."
            : "Failed to create storage type.")
      );
    } finally {
      setSavingStorageType(false);
    }
  }

  async function handleDeleteStorageType(
    storageType
  ) {
    const confirmed = window.confirm(
      `Delete storage type "${storageType.name}"?\n\nIf bookings are using it, backend will block deletion.`
    );

    if (!confirmed) return;

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      const res = await axios.delete(
        `/admin/storage-types/${storageType._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to delete storage type."
        );
      }

      alert(
        res.data.message ||
          "Storage type deleted successfully."
      );

      await fetchStorageTypes();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to delete storage type."
      );
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Storage
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage storage locations, capacity,
              and standalone storage types.
              Storage prices are managed from
              Settings.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openAddStorageModal}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
            >
              Create Storage
            </button>

            <button
              type="button"
              onClick={
                openAddStorageTypeModal
              }
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Add Storage Type
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Storage Locations"
          value={stats.totalLocations}
        />

        <StatCard
          title="Active Locations"
          value={stats.activeLocations}
        />

        <StatCard
          title="Inactive Locations"
          value={stats.inactiveLocations}
        />

        <StatCard
          title="Storage Types"
          value={stats.totalStorageTypes}
        />
      </div>

      <section className="space-y-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Storage Locations
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                These are locations with type
                Storage.
              </p>
            </div>

            <button
              type="button"
              onClick={
                fetchStorageLocations
              }
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              type="text"
              value={filters.search}
              onChange={(event) =>
                updateFilter(
                  "search",
                  event.target.value
                )
              }
              placeholder="Search storage location"
              className="rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600 xl:col-span-2"
            />

            <select
              value={filters.is_active}
              onChange={(event) =>
                updateFilter(
                  "is_active",
                  event.target.value
                )
              }
              className="rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            >
              {activeOptions.map(
                (option) => (
                  <option
                    key={
                      option.value || "all"
                    }
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>

            <select
              value={filters.limit}
              onChange={(event) =>
                updateFilter(
                  "limit",
                  Number(
                    event.target.value
                  )
                )
              }
              className="rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            >
              <option value={10}>
                10 / page
              </option>

              <option value={20}>
                20 / page
              </option>

              <option value={50}>
                50 / page
              </option>

              <option value={100}>
                100 / page
              </option>
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

        {locationsLoading && (
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Loading storage locations...
            </h2>
          </div>
        )}

        {error &&
          !locationsLoading && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              <h2 className="font-bold">
                Storage locations could not
                be loaded
              </h2>

              <p className="mt-2 text-sm">
                {error}
              </p>
            </div>
          )}

        {!locationsLoading &&
          !error && (
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              {locations.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  No storage locations found.
                  Create a Storage location
                  first from Locations.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-700">
                        <th className="px-4 py-3">
                          Location
                        </th>

                        <th className="px-4 py-3">
                          Capacity
                        </th>

                        <th className="px-4 py-3">
                          Status
                        </th>

                        <th className="px-4 py-3">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {locations.map(
                        (location) => (
                          <tr
                            key={
                              location._id
                            }
                            className="border-b align-middle"
                          >
                            <td className="min-w-[220px] px-4 py-3">
                              <p className="font-bold text-gray-900">
                                {
                                  location.name
                                }
                              </p>

                              <p className="mt-1 text-xs text-gray-500">
                                Created:{" "}
                                {formatDate(
                                  location.createdAt
                                )}
                              </p>
                            </td>

                            <td className="px-4 py-3 font-semibold">
                              {Number(
                                location.booked_count ||
                                  0
                              )}{" "}
                              /{" "}
                              {Number(
                                location.capacity ||
                                  0
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <Badge
                                active={
                                  location.is_active
                                }
                              />
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditStorageModal(
                                      location
                                    )
                                  }
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteStorageLocation(
                                      location
                                    )
                                  }
                                  className="rounded-lg border border-red-600 px-3 py-2 text-xs font-semibold text-red-700"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600">
                  Showing page{" "}
                  {locationsPagination.page ||
                    page}{" "}
                  of{" "}
                  {locationsPagination.total_pages ||
                    1}
                  . Total records:{" "}
                  {locationsPagination.total ||
                    0}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={
                      !locationsPagination.has_prev_page
                    }
                    onClick={() =>
                      setPage((prev) =>
                        Math.max(
                          1,
                          prev - 1
                        )
                      )
                    }
                    className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={
                      !locationsPagination.has_next_page
                    }
                    onClick={() =>
                      setPage(
                        (prev) =>
                          prev + 1
                      )
                    }
                    className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Storage Types
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Manage storage types and
                their booking capacity. Set
                capacity to 0 for unlimited
                bookings.
              </p>
            </div>

            <button
              type="button"
              onClick={
                openAddStorageTypeModal
              }
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Add Storage Type
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={storageTypeSearch}
              onChange={(event) =>
                setStorageTypeSearch(
                  event.target.value
                )
              }
              placeholder="Search storage type"
              className="w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            />

            <button
              type="button"
              onClick={() =>
                setStorageTypeSearch("")
              }
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Clear
            </button>
          </div>
        </div>

        {storageTypesLoading && (
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Loading storage types...
            </h2>
          </div>
        )}

        {storageTypeError &&
          !storageTypesLoading && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              <h2 className="font-bold">
                Storage types could not be
                loaded
              </h2>

              <p className="mt-2 text-sm">
                {storageTypeError}
              </p>
            </div>
          )}

        {!storageTypesLoading &&
          !storageTypeError && (
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              {storageTypes.length ===
              0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  No storage types found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-700">
                        <th className="px-4 py-3">
                          Storage Type Name
                        </th>

                        <th className="px-4 py-3">
                          Capacity
                        </th>

                        <th className="px-4 py-3">
                          Created
                        </th>

                        <th className="px-4 py-3">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {storageTypes.map(
                        (storageType) => {
                          const capacityLabel =
                            formatStorageTypeCapacity(
                              storageType.capacity
                            );

                          const isUnlimited =
                            capacityLabel ===
                            "Unlimited";

                          return (
                            <tr
                              key={
                                storageType._id
                              }
                              className="border-b align-middle"
                            >
                              <td className="min-w-[240px] px-4 py-3">
                                <p className="font-bold text-gray-900">
                                  {
                                    storageType.name
                                  }
                                </p>
                              </td>

                              <td className="px-4 py-3">
                                {isUnlimited ? (
                                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                    Unlimited
                                  </span>
                                ) : (
                                  <span className="font-semibold text-gray-900">
                                    {
                                      capacityLabel
                                    }
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                {formatDate(
                                  storageType.createdAt
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditStorageTypeModal(
                                        storageType
                                      )
                                    }
                                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteStorageType(
                                        storageType
                                      )
                                    }
                                    className="rounded-lg border border-red-600 px-3 py-2 text-xs font-semibold text-red-700"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600">
                  Showing page{" "}
                  {storageTypesPagination.page ||
                    storageTypePage}{" "}
                  of{" "}
                  {storageTypesPagination.total_pages ||
                    1}
                  . Total records:{" "}
                  {storageTypesPagination.total ||
                    0}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={
                      !storageTypesPagination.has_prev_page
                    }
                    onClick={() =>
                      setStorageTypePage(
                        (prev) =>
                          Math.max(
                            1,
                            prev - 1
                          )
                      )
                    }
                    className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={
                      !storageTypesPagination.has_next_page
                    }
                    onClick={() =>
                      setStorageTypePage(
                        (prev) =>
                          prev + 1
                      )
                    }
                    className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
      </section>

      <StorageFormModal
        open={storageModalOpen}
        mode={storageMode}
        form={storageForm}
        setForm={setStorageForm}
        locations={locations}
        saving={savingStorage}
        onClose={closeStorageModal}
        onSubmit={handleSubmitStorage}
      />

      <StorageTypeFormModal
        open={storageTypeModalOpen}
        mode={storageTypeMode}
        form={storageTypeForm}
        setForm={setStorageTypeForm}
        saving={savingStorageType}
        onClose={closeStorageTypeModal}
        onSubmit={handleSubmitStorageType}
      />
    </div>
  );
}