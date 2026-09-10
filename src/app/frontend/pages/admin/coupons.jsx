"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "@/app/frontend/utils/axios";

const bookingTypeOptions = [
  { value: "cruise", label: "Cruise" },
  { value: "storage", label: "Storage" },
  { value: "airport", label: "Airport" },
];

const discountTypeOptions = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed Amount" },
];

const emptyForm = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  max_discount_amount: "",
  min_booking_amount: "",
  applies_to: ["cruise", "storage", "airport"],
  valid_from: "",
  valid_to: "",
  usage_limit: "0",
  is_active: true,
};

function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
}

function getAuthHeaders() {
  const token = getAdminToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function money(value) {
  return `A$ ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateInputValue(value) {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function formatDiscount(coupon) {
  if (coupon.discount_type === "percentage") {
    return `${Number(coupon.discount_value || 0)}%`;
  }

  return money(coupon.discount_value);
}

function getCouponStatus(coupon) {
  if (!coupon.is_active) {
    return {
      label: "Inactive",
      className: "bg-gray-100 text-gray-700",
    };
  }

  const now = new Date();
  const validFrom = coupon.valid_from ? new Date(coupon.valid_from) : null;
  const validTo = coupon.valid_to ? new Date(coupon.valid_to) : null;

  if (validFrom && now < validFrom) {
    return {
      label: "Scheduled",
      className: "bg-blue-50 text-blue-700",
    };
  }

  if (validTo && now > validTo) {
    return {
      label: "Expired",
      className: "bg-red-50 text-red-700",
    };
  }

  if (
    Number(coupon.usage_limit || 0) > 0 &&
    Number(coupon.used_count || 0) >= Number(coupon.usage_limit || 0)
  ) {
    return {
      label: "Limit Reached",
      className: "bg-yellow-50 text-yellow-800",
    };
  }

  return {
    label: "Active",
    className: "bg-green-50 text-green-700",
  };
}

function getAppliesToLabel(appliesTo = []) {
  if (!Array.isArray(appliesTo) || appliesTo.length === 0) {
    return "All booking types";
  }

  return appliesTo
    .map((type) => {
      const option = bookingTypeOptions.find((item) => item.value === type);
      return option?.label || type;
    })
    .join(", ");
}

function getErrorMessage(error, fallback = "Something went wrong") {
  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    fallback
  );
}

function CouponModal({
  open,
  mode,
  initialData,
  saving,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && initialData) {
      setForm({
        code: initialData.code || "",
        discount_type: initialData.discount_type || "percentage",
        discount_value:
          initialData.discount_value !== undefined &&
          initialData.discount_value !== null
            ? String(initialData.discount_value)
            : "",
        max_discount_amount:
          initialData.max_discount_amount !== undefined &&
          initialData.max_discount_amount !== null
            ? String(initialData.max_discount_amount)
            : "",
        min_booking_amount:
          initialData.min_booking_amount !== undefined &&
          initialData.min_booking_amount !== null
            ? String(initialData.min_booking_amount)
            : "",
        applies_to:
          Array.isArray(initialData.applies_to) &&
          initialData.applies_to.length > 0
            ? initialData.applies_to
            : ["cruise", "storage", "airport"],
        valid_from: toDateInputValue(initialData.valid_from),
        valid_to: toDateInputValue(initialData.valid_to),
        usage_limit:
          initialData.usage_limit !== undefined &&
          initialData.usage_limit !== null
            ? String(initialData.usage_limit)
            : "0",
        is_active: Boolean(initialData.is_active),
      });

      return;
    }

    setForm(emptyForm);
  }, [open, mode, initialData]);

  if (!open) return null;

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function toggleBookingType(type) {
    setForm((prev) => {
      const current = Array.isArray(prev.applies_to) ? prev.applies_to : [];
      const exists = current.includes(type);

      return {
        ...prev,
        applies_to: exists
          ? current.filter((item) => item !== type)
          : [...current, type],
      };
    });
  }

  function validateForm() {
    const code = String(form.code || "").trim().toUpperCase();

    if (!code) {
      throw new Error("Coupon code is required.");
    }

    if (!["percentage", "fixed"].includes(form.discount_type)) {
      throw new Error("Please select a valid discount type.");
    }

    const discountValue = Number(form.discount_value);

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      throw new Error("Discount value must be greater than 0.");
    }

    if (form.discount_type === "percentage" && discountValue > 100) {
      throw new Error("Percentage discount cannot be greater than 100%.");
    }

    const maxDiscount =
      form.max_discount_amount === "" ? null : Number(form.max_discount_amount);

    if (
      maxDiscount !== null &&
      (!Number.isFinite(maxDiscount) || maxDiscount < 0)
    ) {
      throw new Error("Max discount amount must be 0 or greater.");
    }

    const minBookingAmount =
      form.min_booking_amount === "" ? 0 : Number(form.min_booking_amount);

    if (!Number.isFinite(minBookingAmount) || minBookingAmount < 0) {
      throw new Error("Minimum booking amount must be 0 or greater.");
    }

    if (!form.valid_from) {
      throw new Error("Valid from date is required.");
    }

    if (!form.valid_to) {
      throw new Error("Valid to date is required.");
    }

    const validFrom = new Date(form.valid_from);
    const validTo = new Date(form.valid_to);

    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validTo.getTime())) {
      throw new Error("Invalid coupon date.");
    }

    if (validTo < validFrom) {
      throw new Error("Valid to date cannot be before valid from date.");
    }

    const usageLimit = Number(form.usage_limit || 0);

    if (!Number.isFinite(usageLimit) || usageLimit < 0) {
      throw new Error("Usage limit must be 0 or greater.");
    }

    const usedCount = Number(initialData?.used_count || 0);

    if (mode === "edit" && usageLimit > 0 && usageLimit < usedCount) {
      throw new Error(
        `Usage limit cannot be lower than used count (${usedCount}).`
      );
    }

    if (!Array.isArray(form.applies_to) || form.applies_to.length === 0) {
      throw new Error("Please select at least one booking type.");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    try {
      validateForm();

      const payload = {
        code: String(form.code || "").trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        max_discount_amount:
          form.max_discount_amount === ""
            ? null
            : Number(form.max_discount_amount),
        min_booking_amount:
          form.min_booking_amount === "" ? 0 : Number(form.min_booking_amount),
        applies_to: form.applies_to,
        valid_from: form.valid_from,
        valid_to: form.valid_to,
        usage_limit: Number(form.usage_limit || 0),
        is_active: Boolean(form.is_active),
      };

      onSubmit(payload);
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">
              {mode === "edit" ? "Edit Coupon" : "Add Coupon"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Create discounts for cruise, storage, and airport bookings.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Coupon Code *
              </label>

              <input
                value={form.code}
                onChange={(event) =>
                  updateField("code", event.target.value.toUpperCase())
                }
                placeholder="Coupon"
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm uppercase outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Discount Type *
              </label>

              <select
                value={form.discount_type}
                onChange={(event) =>
                  updateField("discount_type", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              >
                {discountTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Discount Value *
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount_value}
                onChange={(event) =>
                  updateField("discount_value", event.target.value)
                }
                placeholder={
                  form.discount_type === "percentage" ? "10" : "25.00"
                }
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              />

              <p className="mt-1 text-xs text-gray-500">
                {form.discount_type === "percentage"
                  ? "Example: 10 means 10% off."
                  : "Example: 25 means A$25 off."}
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Max Discount Amount
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.max_discount_amount}
                onChange={(event) =>
                  updateField("max_discount_amount", event.target.value)
                }
                placeholder="Optional"
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              />

              <p className="mt-1 text-xs text-gray-500">
                Mostly useful for percentage coupons. Leave blank for no cap.
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Minimum Booking Amount
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.min_booking_amount}
                onChange={(event) =>
                  updateField("min_booking_amount", event.target.value)
                }
                placeholder="0"
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Usage Limit
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={form.usage_limit}
                onChange={(event) =>
                  updateField("usage_limit", event.target.value)
                }
                placeholder="0"
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              />

              <p className="mt-1 text-xs text-gray-500">
                0 means unlimited usage.
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Valid From *
              </label>

              <input
                type="date"
                value={form.valid_from}
                onChange={(event) =>
                  updateField("valid_from", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Valid To *
              </label>

              <input
                type="date"
                value={form.valid_to}
                onChange={(event) =>
                  updateField("valid_to", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="rounded-3xl border p-4">
            <label className="text-sm font-semibold text-gray-700">
              Applicable Booking Types *
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {bookingTypeOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={form.applies_to.includes(option.value)}
                    onChange={() => toggleBookingType(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                updateField("is_active", event.target.checked)
              }
            />
            Active coupon
          </label>

          <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-white py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border px-5 py-3 text-sm font-bold text-gray-700 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving
                ? mode === "edit"
                  ? "Saving..."
                  : "Creating..."
                : mode === "edit"
                ? "Save Changes"
                : "Create Coupon"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [bookingTypeFilter, setBookingTypeFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedCoupon, setSelectedCoupon] = useState(null);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const filteredCoupons = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return coupons.filter((coupon) => {
      const status = getCouponStatus(coupon);
      const appliesTo = Array.isArray(coupon.applies_to)
        ? coupon.applies_to
        : [];

      const matchesSearch =
        !keyword ||
        String(coupon.code || "").toLowerCase().includes(keyword) ||
        String(coupon.discount_type || "").toLowerCase().includes(keyword);

      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" && coupon.is_active === true) ||
        (statusFilter === "inactive" && coupon.is_active === false) ||
        (statusFilter === "expired" && status.label === "Expired") ||
        (statusFilter === "scheduled" && status.label === "Scheduled") ||
        (statusFilter === "limit_reached" && status.label === "Limit Reached");

      const matchesBookingType =
        !bookingTypeFilter ||
        appliesTo.length === 0 ||
        appliesTo.includes(bookingTypeFilter);

      return matchesSearch && matchesStatus && matchesBookingType;
    });
  }, [coupons, search, statusFilter, bookingTypeFilter]);

  const stats = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter((coupon) => coupon.is_active).length;
    const inactive = coupons.filter((coupon) => !coupon.is_active).length;
    const used = coupons.reduce(
      (sum, coupon) => sum + Number(coupon.used_count || 0),
      0
    );

    return {
      total,
      active,
      inactive,
      used,
    };
  }, [coupons]);

  async function fetchCoupons() {
    try {
      setLoading(true);

      const res = await axios.get("/admin/coupons", {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to load coupons."
        );
      }

      const data = Array.isArray(res.data?.data) ? res.data.data : [];

      setCoupons(data);
    } catch (error) {
      alert(getErrorMessage(error, "Failed to load coupons."));
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setSelectedCoupon(null);
    setModalMode("create");
    setModalOpen(true);
  }

  function openEditModal(coupon) {
    setSelectedCoupon(coupon);
    setModalMode("edit");
    setModalOpen(true);
  }

  function closeModal() {
    if (actionLoading) return;

    setModalOpen(false);
    setSelectedCoupon(null);
  }

  async function handleSaveCoupon(payload) {
    try {
      setActionLoading(true);

      let res;

      if (modalMode === "edit" && selectedCoupon?._id) {
        res = await axios.patch(`/admin/coupons/${selectedCoupon._id}`, payload, {
          headers: getAuthHeaders(),
        });
      } else {
        res = await axios.post("/admin/coupons", payload, {
          headers: getAuthHeaders(),
        });
      }

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to save coupon."
        );
      }

      alert(
        modalMode === "edit"
          ? "Coupon updated successfully."
          : "Coupon created successfully."
      );

      setModalOpen(false);
      setSelectedCoupon(null);
      await fetchCoupons();
    } catch (error) {
      alert(getErrorMessage(error, "Failed to save coupon."));
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleCouponStatus(coupon) {
    try {
      const nextStatus = !coupon.is_active;
      const confirmed = window.confirm(
        nextStatus
          ? `Activate coupon ${coupon.code}?`
          : `Deactivate coupon ${coupon.code}?`
      );

      if (!confirmed) return;

      setActionLoading(true);

      const res = await axios.patch(
        `/admin/coupons/${coupon._id}`,
        {
          is_active: nextStatus,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to update coupon status."
        );
      }

      await fetchCoupons();
    } catch (error) {
      alert(getErrorMessage(error, "Failed to update coupon status."));
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteOrDeactivateCoupon(coupon) {
    const usedCount = Number(coupon.used_count || 0);

    if (usedCount > 0) {
      const confirmed = window.confirm(
        `Coupon ${coupon.code} has already been used ${usedCount} time(s). It should not be permanently deleted. Deactivate it instead?`
      );

      if (!confirmed) return;

      try {
        setActionLoading(true);

        const res = await axios.patch(
          `/admin/coupons/${coupon._id}`,
          {
            is_active: false,
          },
          {
            headers: getAuthHeaders(),
          }
        );

        if (!res.data?.success) {
          throw new Error(
            res.data?.message ||
              res.data?.error ||
              "Failed to deactivate coupon."
          );
        }

        await fetchCoupons();
      } catch (error) {
        alert(getErrorMessage(error, "Failed to deactivate coupon."));
      } finally {
        setActionLoading(false);
      }

      return;
    }

    const confirmed = window.confirm(
      `Permanently delete coupon ${coupon.code}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);

      const res = await axios.delete(`/admin/coupons/${coupon._id}`, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to delete coupon."
        );
      }

      await fetchCoupons();
    } catch (error) {
      const fallbackConfirm = window.confirm(
        `${getErrorMessage(
          error,
          "Delete failed."
        )}\n\nDo you want to deactivate this coupon instead?`
      );

      if (fallbackConfirm) {
        await toggleCouponStatus({
          ...coupon,
          is_active: true,
        });
      }
    } finally {
      setActionLoading(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setBookingTypeFilter("");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Admin
            </p>

            <h1 className="mt-1 text-3xl font-bold text-gray-950">
              Coupons
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage promotional discounts for cruise, storage, and airport
              bookings.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
          >
            Add Coupon
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Coupons</p>
            <p className="mt-2 text-3xl font-bold text-gray-950">
              {stats.total}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Active</p>
            <p className="mt-2 text-3xl font-bold text-green-700">
              {stats.active}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Inactive</p>
            <p className="mt-2 text-3xl font-bold text-gray-700">
              {stats.inactive}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Used</p>
            <p className="mt-2 text-3xl font-bold text-blue-700">
              {stats.used}
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search coupon code..."
              className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
              <option value="scheduled">Scheduled</option>
              <option value="limit_reached">Limit Reached</option>
            </select>

            <select
              value={bookingTypeFilter}
              onChange={(event) => setBookingTypeFilter(event.target.value)}
              className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
            >
              <option value="">All Booking Types</option>
              {bookingTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl border px-5 py-3 text-sm font-bold text-gray-700"
            >
              Clear
            </button>
          </div>
        </div>


<div className="overflow-hidden rounded-3xl bg-white shadow-sm">
  <div className="flex items-center justify-between border-b px-5 py-4">
    <h2 className="text-lg font-bold text-gray-950">Coupon List</h2>

    <button
      type="button"
      onClick={fetchCoupons}
      disabled={loading}
      className="rounded-xl border px-4 py-2 text-xs font-bold text-gray-700 disabled:opacity-60"
    >
      {loading ? "Refreshing..." : "Refresh"}
    </button>
  </div>

  <div className="w-full">
    <table className="w-full table-fixed text-left text-xs leading-5">
      <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
        <tr>
          <th className="w-[14%] px-4 py-3.5">Code</th>
          <th className="w-[14%] px-4 py-3.5">Discount</th>
          <th className="w-[15%] px-4 py-3.5">Amounts</th>
          <th className="w-[17%] px-4 py-3.5">Applies</th>
          <th className="w-[17%] px-4 py-3.5">Validity</th>
          <th className="w-[10%] px-4 py-3.5">Usage</th>
          <th className="w-[13%] px-4 py-3.5 text-right">Actions</th>
        </tr>
      </thead>

      <tbody className="divide-y">
        {loading && (
          <tr>
            <td
              colSpan={7}
              className="px-5 py-10 text-center text-sm text-gray-500"
            >
              Loading coupons...
            </td>
          </tr>
        )}

        {!loading && filteredCoupons.length === 0 && (
          <tr>
            <td
              colSpan={7}
              className="px-5 py-10 text-center text-sm text-gray-500"
            >
              No coupons found.
            </td>
          </tr>
        )}

        {!loading &&
          filteredCoupons.map((coupon) => {
            const status = getCouponStatus(coupon);
            const usageLimit = Number(coupon.usage_limit || 0);
            const usedCount = Number(coupon.used_count || 0);

            return (
              <tr key={coupon._id} className="align-top hover:bg-gray-50">
                <td className="px-4 py-3.5">
                  <div className="truncate text-sm font-bold text-gray-950">
                    {coupon.code}
                  </div>

                  <span
                    className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>

                <td className="px-4 py-3.5">
                  <div className="text-sm font-semibold text-gray-900">
                    {formatDiscount(coupon)}
                  </div>

                  <div className="mt-0.5 truncate text-[11px] capitalize text-gray-500">
                    {String(coupon.discount_type || "-").replaceAll(
                      "_",
                      " "
                    )}
                  </div>
                </td>

                <td className="px-4 py-3.5 text-gray-700">
                  <div>
                    <span className="text-gray-500">Min:</span>{" "}
                    <strong>{money(coupon.min_booking_amount)}</strong>
                  </div>

                  <div className="mt-1">
                    <span className="text-gray-500">Max:</span>{" "}
                    <strong>
                      {coupon.max_discount_amount === null ||
                      coupon.max_discount_amount === undefined
                        ? "No cap"
                        : money(coupon.max_discount_amount)}
                    </strong>
                  </div>
                </td>

                <td className="px-4 py-3.5">
                  <div className="line-clamp-2 text-gray-700">
                    {getAppliesToLabel(coupon.applies_to)}
                  </div>
                </td>

                <td className="px-4 py-3.5 text-gray-700">
                  <div>{formatDate(coupon.valid_from)}</div>

                  <div className="mt-1 text-[11px] text-gray-500">
                    to {formatDate(coupon.valid_to)}
                  </div>
                </td>

                <td className="px-4 py-3.5">
                  <div className="font-semibold text-gray-900">
                    {usedCount}
                    {usageLimit > 0 ? `/${usageLimit}` : "/∞"}
                  </div>

                  <div className="text-[11px] text-gray-500">used</div>
                </td>

                <td className="px-4 py-3.5">
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(coupon)}
                      disabled={actionLoading}
                      className="w-full rounded-lg border px-3 py-2 text-[11px] font-bold text-gray-700 disabled:opacity-60"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCouponStatus(coupon)}
                      disabled={actionLoading}
                      className={`w-full rounded-lg px-3 py-2 text-[11px] font-bold disabled:opacity-60 ${
                        coupon.is_active
                          ? "bg-yellow-50 text-yellow-800"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {coupon.is_active ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteOrDeactivateCoupon(coupon)}
                      disabled={actionLoading}
                      className="w-full rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700 disabled:opacity-60"
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
</div>



      </div>

      <CouponModal
        open={modalOpen}
        mode={modalMode}
        initialData={selectedCoupon}
        saving={actionLoading}
        onClose={closeModal}
        onSubmit={handleSaveCoupon}
      />
    </div>
  );
}