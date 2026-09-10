"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const emptyCustomerForm = {
  name: "",
  email: "",
  phone: "",
  is_active: true,
};

const activeOptions = [
  { value: "", label: "All Statuses" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const customerTypeOptions = [
  { value: "all", label: "All Customers" },
  { value: "repeated", label: "Repeated Customers" },
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

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(amount, currency = "aud") {
  const symbols = {
    aud: "A$",
  };

  return `${symbols[String(currency).toLowerCase()] || currency}${Number(
    amount || 0
  ).toFixed(2)}`;
}

function getBookingCount(customer) {
  return Number(
    customer?.booking_count ||
      customer?.bookings_count ||
      customer?.total_bookings ||
      customer?.stats?.booking_count ||
      0
  );
}

function getLastBookingDate(customer) {
  return (
    customer?.last_booking_at ||
    customer?.last_booking_date ||
    customer?.latest_booking_at ||
    customer?.stats?.last_booking_at ||
    null
  );
}

function StatusBadge({ active }) {
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

function WalletBadge({ status }) {
  const classes = {
    active: "bg-green-50 text-green-700",
    frozen: "bg-yellow-50 text-yellow-700",
    disabled: "bg-red-50 text-red-700",
  };

  const label = status
    ? String(status)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "-";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        classes[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {label}
    </span>
  );
}

function RepeatedBadge({ count }) {
  const bookingCount = Number(count || 0);

  if (bookingCount < 2) {
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
        {bookingCount} Booking{bookingCount === 1 ? "" : "s"}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
      Repeated · {bookingCount} Bookings
    </span>
  );
}

function StatCard({ title, value, active = false, onClick }) {
  const clickable = typeof onClick === "function";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
        active ? "border-purple-300 bg-purple-50" : ""
      } ${clickable ? "hover:border-blue-300 hover:bg-blue-50" : ""}`}
    >
      <p
        className={`text-sm font-medium ${
          active ? "text-purple-700" : "text-gray-500"
        }`}
      >
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </button>
  );
}

function CustomerTypeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-purple-600 text-white"
          : "border bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function normalizeFormFromCustomer(customer) {
  return {
    name: customer?.name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    is_active: customer?.is_active !== false,
  };
}

function CustomerFormModal({
  open,
  form,
  setForm,
  saving,
  customer,
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
            <h2 className="text-xl font-bold text-gray-900">Edit Customer</h2>
            <p className="mt-1 text-sm text-gray-500">
              Update customer profile details.
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
          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
            <p>
              <span className="font-semibold text-gray-800">Customer ID:</span>{" "}
              {customer?.customer_id || customer?._id || "-"}
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Full Name
            </label>

            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
              placeholder="Full name"
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Email</label>

            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
              placeholder="Email address"
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Phone</label>

            <input
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
              placeholder="Phone number"
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                updateField("is_active", event.target.checked)
              }
            />
            Active customer account
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
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCustomersPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    repeated_customers: 0,
    frozen_wallets: 0,
    disabled_wallets: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
  });

  const [filters, setFilters] = useState({
    search: "",
    is_active: "",
    customer_type: "all",
    limit: 20,
  });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(emptyCustomerForm);

  const totals = useMemo(() => {
    return {
      total: Number(summary.total || pagination.total || 0),
      active: Number(summary.active || 0),
      inactive: Number(summary.inactive || 0),
      repeated_customers: Number(summary.repeated_customers || 0),
      frozen_wallets: Number(summary.frozen_wallets || 0),
      disabled_wallets: Number(summary.disabled_wallets || 0),
    };
  }, [pagination.total, summary]);

  const repeatedMode = filters.customer_type === "repeated";

  const fetchCustomers = useCallback(async () => {
    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await axios.get("/admin/customers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          page,
          limit: filters.limit,
          search: filters.search || undefined,
          is_active: filters.is_active || undefined,

          customer_type: filters.customer_type,
          repeated_customer:
            filters.customer_type === "repeated" ? "true" : undefined,
          min_bookings: filters.customer_type === "repeated" ? 2 : undefined,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to load customers."
        );
      }

      setCustomers(res.data.data?.customers || []);
      setSummary(
        res.data.data?.summary || {
          total: 0,
          active: 0,
          inactive: 0,
          repeated_customers: 0,
          frozen_wallets: 0,
          disabled_wallets: 0,
        }
      );

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
        "Failed to load customers.";

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
    filters.is_active,
    filters.customer_type,
    filters.limit,
  ]);

  useEffect(() => {
    if (!mounted) return;
    fetchCustomers();
  }, [mounted, fetchCustomers]);

  function updateFilter(name, value) {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function setCustomerType(value) {
    setFilters((prev) => ({
      ...prev,
      customer_type: value,
    }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({
      search: "",
      is_active: "",
      customer_type: "all",
      limit: 20,
    });
    setPage(1);
  }

  function openEditModal(customer) {
    setEditingCustomer(customer);
    setForm(normalizeFormFromCustomer(customer));
    setFormOpen(true);
  }

  function closeFormModal() {
    if (saving) return;

    setFormOpen(false);
    setEditingCustomer(null);
    setForm(emptyCustomerForm);
  }

  async function handleSubmitCustomer(event) {
    event.preventDefault();

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: String(form.name || "").trim(),
        email: String(form.email || "").toLowerCase().trim(),
        phone: String(form.phone || "").trim(),
        is_active: Boolean(form.is_active),
      };

      if (!payload.name) {
        throw new Error("Full name is required.");
      }

      if (!payload.email) {
        throw new Error("Email is required.");
      }

      if (!payload.phone) {
        throw new Error("Phone is required.");
      }

      const res = await axios.patch(
        `/admin/customers/${editingCustomer._id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to save customer."
        );
      }

      alert(res.data.message || "Customer saved successfully.");
      closeFormModal();
      await fetchCustomers();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to save customer."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCustomer(customer) {
    const customerId = customer?._id || customer?.customer_id || customer?.code;

    if (!customerId) {
      alert("Customer ID is missing. Please refresh the page and try again.");
      return;
    }

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    const confirmed = window.confirm(
      `Delete customer "${customer.name}"?\n\nIf this customer has booking history or wallet activity, the account cannot be deleted and will only be allowed to deactivate.`
    );

    if (!confirmed) return;

    async function sendDeleteRequest(payload = undefined) {
      return axios.delete(`/admin/customers/${customerId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: payload,
      });
    }

    try {
      const res = await sendDeleteRequest();

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to delete customer."
        );
      }

      alert(res.data.message || "Customer deleted successfully.");
      await fetchCustomers();
    } catch (error) {
      const responseData = error.response?.data;

      if (
        error.response?.status === 409 &&
        responseData?.requires_deactivation === true
      ) {
        const info = responseData.data || {};

        const shouldDeactivate = window.confirm(
          [
            responseData.message ||
              "This customer cannot be permanently deleted.",
            "",
            `Booking history: ${info.booking_count || 0}`,
            `Wallet balance: A$${Number(info.wallet_balance || 0).toFixed(
              2
            )}`,
            `Wallet transactions: ${info.wallet_transaction_count || 0}`,
            "",
            "Do you want to deactivate this customer account instead?",
          ].join("\n")
        );

        if (!shouldDeactivate) return;

        const deactivateRes = await sendDeleteRequest({
          action: "deactivate",
        });

        if (!deactivateRes.data?.success) {
          throw new Error(
            deactivateRes.data?.message ||
              deactivateRes.data?.error ||
              "Failed to deactivate customer."
          );
        }

        alert(
          deactivateRes.data.message || "Customer deactivated successfully."
        );
        await fetchCustomers();
        return;
      }

      alert(
        responseData?.message ||
          responseData?.error ||
          error.message ||
          "Failed to delete customer."
      );
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="mt-2 text-sm text-gray-500">
              View and manage registered customer accounts.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Total Customers"
          value={totals.total}
          active={!repeatedMode}
          onClick={() => setCustomerType("all")}
        />

        <StatCard title="Active" value={totals.active} />
        <StatCard title="Inactive" value={totals.inactive} />

        <StatCard
          title="Repeated Customers"
          value={totals.repeated_customers}
          active={repeatedMode}
          onClick={() => setCustomerType("repeated")}
        />

        <StatCard title="Frozen Wallets" value={totals.frozen_wallets} />
        <StatCard title="Disabled Wallets" value={totals.disabled_wallets} />
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {customerTypeOptions.map((option) => (
            <CustomerTypeButton
              key={option.value}
              active={filters.customer_type === option.value}
              onClick={() => setCustomerType(option.value)}
            >
              {option.label}
            </CustomerTypeButton>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            type="text"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search name, email, phone, or customer ID"
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

        {repeatedMode && (
          <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50 p-4 text-sm text-purple-800">
            Showing customers who have <strong>2 or more bookings</strong>.
          </div>
        )}

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
            Loading customers...
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we load customer accounts.
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="font-bold">Customers could not be loaded</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {customers.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              {repeatedMode
                ? "No repeated customers found."
                : "No customers found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-700">
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Bookings</th>
                    <th className="px-4 py-3">Registered</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Wallet</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {customers.map((customer) => {
                    const bookingCount = getBookingCount(customer);
                    const lastBookingDate = getLastBookingDate(customer);

                    return (
                      <tr key={customer._id} className="border-b align-middle">
                        <td className="min-w-[220px] px-4 py-3">
                          <p className="font-bold text-gray-900">
                            {customer.name}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {customer.phone || "-"}
                          </p>
                        </td>

                        <td className="min-w-[240px] px-4 py-3">
                          <p className="text-gray-700">{customer.email}</p>
                        </td>

                        <td className="min-w-[170px] px-4 py-3">
                          <RepeatedBadge count={bookingCount} />

                          {lastBookingDate && (
                            <p className="mt-2 text-xs text-gray-500">
                              Last: {formatDateTime(lastBookingDate)}
                            </p>
                          )}
                        </td>

                        <td className="min-w-[180px] px-4 py-3 text-gray-700">
                          {formatDateTime(customer.registered_at)}
                        </td>

                        <td className="px-4 py-3">
                          <StatusBadge active={customer.is_active} />
                        </td>

                        <td className="min-w-[180px] px-4 py-3">
                          <p className="font-semibold text-gray-900">
                            {money(
                              customer.wallet_balance,
                              customer.wallet_currency
                            )}
                          </p>

                          <div className="mt-2">
                            <WalletBadge status={customer.wallet_status} />
                          </div>
                        </td>

                        <td className="min-w-[180px] px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(customer)}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(customer)}
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

      <CustomerFormModal
        open={formOpen}
        form={form}
        setForm={setForm}
        saving={saving}
        customer={editingCustomer}
        onClose={closeFormModal}
        onSubmit={handleSubmitCustomer}
      />
    </div>
  );
}