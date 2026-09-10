"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "customer", label: "Customer" },
];

const ROLE_FILTERS = [
  { value: "all", label: "All Roles" },
  ...ROLE_OPTIONS,
];

const STATUS_FILTERS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function getAuthHeaders() {
  if (typeof window === "undefined") return {};

  const token = localStorage.getItem("adminToken");

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRole(role) {
  const labels = {
    admin: "Admin",
    manager: "Manager",
    customer: "Customer",
  };

  return labels[role] || "-";
}

function getRoleClass(role) {
  if (role === "admin") return "bg-purple-50 text-purple-700 ring-purple-200";
  if (role === "manager") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

function StatusBadge({ value, className }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${className}`}
    >
      {value}
    </span>
  );
}

function SummaryCard({ title, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        active
          ? "border-blue-300 bg-blue-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-extrabold text-gray-950">{value || 0}</p>
    </button>
  );
}

function EmptyState({ message }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
        —
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-600">{message}</p>
    </div>
  );
}

function getInitialForm() {
  return {
    name: "",
    email: "",
    phone: "",
    role: "customer",
    is_active: true,
  };
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({
    all: 0,
    admin: 0,
    manager: 0,
    customer: 0,
    active: 0,
    inactive: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [filters, setFilters] = useState({
    role: "all",
    status: "all",
    search: "",
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(getInitialForm());
  const [formError, setFormError] = useState("");
  const [devSetupUrl, setDevSetupUrl] = useState("");

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;

  const pageTitle = useMemo(() => {
    const roleLabel =
      ROLE_FILTERS.find((item) => item.value === filters.role)?.label ||
      "All Roles";

    return `${roleLabel} Users`;
  }, [filters.role]);

  useEffect(() => {
    const rawUser =
      typeof window !== "undefined" ? localStorage.getItem("adminUser") : null;

    if (rawUser) {
      try {
        const adminUser = JSON.parse(rawUser);

        if (adminUser?.role !== "admin") {
          router.replace("/admin/dashboard");
          return;
        }
      } catch {
        router.replace("/admin/login");
        return;
      }
    }

    fetchUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.role, filters.status]);

  async function fetchUsers(page = currentPage) {
    try {
      setLoading(true);
      setError("");

      const res = await axios.get("/admin/users", {
        headers: getAuthHeaders(),
        params: {
          page,
          limit: pagination.limit,
          role: filters.role,
          status: filters.status,
          search: filters.search,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to fetch users."
        );
      }

      const data = res.data.data || {};

      setUsers(data.users || []);
      setCounts(
        data.counts || {
          all: 0,
          admin: 0,
          manager: 0,
          customer: 0,
          active: 0,
          inactive: 0,
        }
      );
      setPagination(
        data.pagination || {
          page,
          limit: 20,
          total: 0,
          totalPages: 1,
        }
      );
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch users.";

      setError(message);

      if (
        error.response?.status === 401 ||
        String(message).toLowerCase().includes("token") ||
        String(message).toLowerCase().includes("unauthorized")
      ) {
        router.replace("/admin/login");
      }

      if (
        error.response?.status === 403 ||
        String(message).toLowerCase().includes("admin access")
      ) {
        router.replace("/admin/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(name, value) {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    fetchUsers(1);
  }

  function openCreateModal() {
    setEditingUser(null);
    setForm(getInitialForm());
    setFormError("");
    setDevSetupUrl("");
    setFormModalOpen(true);
  }

  function openEditModal(user) {
    setEditingUser(user);
    setForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "customer",
      is_active: user.is_active !== false,
    });
    setFormError("");
    setDevSetupUrl("");
    setFormModalOpen(true);
  }

  function closeFormModal() {
    if (actionLoading) return;

    setFormModalOpen(false);
    setEditingUser(null);
    setForm(getInitialForm());
    setFormError("");
    setDevSetupUrl("");
  }

  function updateFormField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setFormError("");
    setDevSetupUrl("");
  }

  async function submitUserForm(event) {
    event.preventDefault();

    try {
      setActionLoading("save");
      setFormError("");
      setDevSetupUrl("");

      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role,
        is_active: form.is_active,
      };

      const res = editingUser
        ? await axios.patch(`/admin/users/${editingUser._id}`, payload, {
            headers: getAuthHeaders(),
          })
        : await axios.post("/admin/users", payload, {
            headers: getAuthHeaders(),
          });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to save user."
        );
      }

      if (res.data.data?.setup_url) {
        setDevSetupUrl(res.data.data.setup_url);
      }

      alert(res.data.message || "User saved successfully.");

      await fetchUsers(currentPage);

      if (!res.data.data?.setup_url) {
        closeFormModal();
      }
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to save user."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function toggleUserStatus(user) {
    const nextStatus = !user.is_active;

    const confirmed = window.confirm(
      `${nextStatus ? "Activate" : "Deactivate"} ${user.name}?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(`status:${user._id}`);

      const res = await axios.patch(
        `/admin/users/${user._id}`,
        {
          is_active: nextStatus,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to update user."
        );
      }

      await fetchUsers(currentPage);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to update user."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function sendPasswordReset(user) {
    const confirmed = window.confirm(
      `Send password reset email to ${user.email}?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(`reset:${user._id}`);

      const res = await axios.post(
        `/admin/users/${user._id}/password-reset`,
        {},
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to send password reset."
        );
      }

      if (res.data.data?.setup_url) {
        alert(`${res.data.message}\n\nDev setup URL:\n${res.data.data.setup_url}`);
      } else {
        alert(res.data.message || "Password reset email sent.");
      }
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to send password reset."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function deleteUser(user) {
    const confirmed = window.confirm(
      `Delete ${user.name}? This will permanently remove the account only if the user has no bookings, payments, wallet transactions, or support tickets.`
    );

    if (!confirmed) return;

    try {
      setActionLoading(`delete:${user._id}`);

      const res = await axios.delete(`/admin/users/${user._id}`, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to delete user."
        );
      }

      alert(res.data.message || "User deleted successfully.");

      await fetchUsers(currentPage);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to delete user."
      );
    } finally {
      setActionLoading("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="relative p-6 md:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-blue-50" />

            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
                  Admin Only
                </p>

                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-950">
                  User Management
                </h1>

                <p className="mt-2 max-w-2xl text-sm text-gray-600">
                  Create admin, manager, and customer accounts. Edit account
                  details, activate/deactivate users, delete users with no linked
                  data, and send password setup or reset emails.
                </p>
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
              >
                Create User
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <SummaryCard
            title="All Users"
            value={counts.all}
            active={filters.role === "all"}
            onClick={() => updateFilter("role", "all")}
          />
          <SummaryCard
            title="Admins"
            value={counts.admin}
            active={filters.role === "admin"}
            onClick={() => updateFilter("role", "admin")}
          />
          <SummaryCard
            title="Managers"
            value={counts.manager}
            active={filters.role === "manager"}
            onClick={() => updateFilter("role", "manager")}
          />
          <SummaryCard
            title="Customers"
            value={counts.customer}
            active={filters.role === "customer"}
            onClick={() => updateFilter("role", "customer")}
          />
          <SummaryCard
            title="Inactive"
            value={counts.inactive}
            active={filters.status === "inactive"}
            onClick={() => updateFilter("status", "inactive")}
          />
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <form
            onSubmit={handleSearchSubmit}
            className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]"
          >
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search by name, email, phone, or role..."
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
            />

            <select
              value={filters.role}
              onChange={(event) => updateFilter("role", event.target.value)}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
            >
              {ROLE_FILTERS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
            >
              Search
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-gray-950">
                {pageTitle}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Showing {users.length} of {pagination.total || 0} users.
              </p>
            </div>
          </div>

          {error && (
            <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-sm font-semibold text-gray-600">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <EmptyState message="No users found." />
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 whitespace-nowrap">User</th>
                    <th className="px-4 py-3 whitespace-nowrap">Phone</th>
                    <th className="px-4 py-3 whitespace-nowrap">Role</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 whitespace-nowrap">Password</th>
                    <th className="px-4 py-3 whitespace-nowrap">Created</th>
                    <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user._id} className="align-top hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <p className="font-extrabold text-gray-950">
                          {user.name}
                        </p>
                        <p className="mt-1 break-all text-gray-500">
                          {user.email}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                        {user.phone || "-"}
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge
                          value={formatRole(user.role)}
                          className={getRoleClass(user.role)}
                        />
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge
                          value={user.is_active ? "Active" : "Inactive"}
                          className={
                            user.is_active
                              ? "bg-green-50 text-green-700 ring-green-200"
                              : "bg-red-50 text-red-700 ring-red-200"
                          }
                        />
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge
                          value={user.has_password ? "Set" : "Not Set"}
                          className={
                            user.has_password
                              ? "bg-green-50 text-green-700 ring-green-200"
                              : "bg-yellow-50 text-yellow-700 ring-yellow-200"
                          }
                        />
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                        {formatDate(user.createdAt)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="rounded-xl border border-blue-200 px-3 py-2 font-bold text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => sendPasswordReset(user)}
                            disabled={!user.is_active || Boolean(actionLoading)}
                            className="rounded-xl border border-green-200 px-3 py-2 font-bold text-green-700 hover:bg-green-50 disabled:opacity-60 whitespace-nowrap"
                          >
                            Reset Password
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleUserStatus(user)}
                            disabled={Boolean(actionLoading)}
                            className={`rounded-xl border px-3 py-2 font-bold disabled:opacity-60 whitespace-nowrap ${
                              user.is_active
                                ? "border-orange-200 text-orange-700 hover:bg-orange-50"
                                : "border-green-200 text-green-700 hover:bg-green-50"
                            }`}
                          >
                            {user.is_active ? "Deactivate" : "Activate"}
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteUser(user)}
                            disabled={Boolean(actionLoading)}
                            className="rounded-xl border border-red-200 px-3 py-2 font-bold text-red-700 hover:bg-red-50 disabled:opacity-60 whitespace-nowrap"
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

          <div className="flex flex-col gap-3 border-t border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => fetchUsers(currentPage - 1)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={currentPage >= totalPages || loading}
                onClick={() => fetchUsers(currentPage + 1)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {formModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-extrabold text-gray-950">
                  {editingUser ? "Edit User" : "Create User"}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {editingUser
                    ? "Update user account details."
                    : "Create account and send password setup email."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeFormModal}
                disabled={Boolean(actionLoading)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <form onSubmit={submitUserForm} className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700">Name</label>
                <input
                  value={form.name}
                  onChange={(event) =>
                    updateFormField("name", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    updateFormField("email", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700">Phone</label>
                <input
                  value={form.phone}
                  onChange={(event) =>
                    updateFormField("phone", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700">Role</label>
                <select
                  value={form.role}
                  onChange={(event) =>
                    updateFormField("role", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 text-sm font-bold text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    updateFormField("is_active", event.target.checked)
                  }
                  className="h-4 w-4"
                />
                Active account
              </label>

              {formError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              {devSetupUrl && (
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                  <p className="font-bold">Development setup URL:</p>
                  <p className="mt-1 break-all">{devSetupUrl}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={Boolean(actionLoading)}
                  className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={Boolean(actionLoading)}
                  className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {actionLoading ? "Saving..." : "Save User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}