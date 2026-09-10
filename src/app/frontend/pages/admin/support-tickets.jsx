"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "replied", label: "Replied" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function getAuthToken() {
  if (typeof window === "undefined") return "";

  const possibleKeys = [
    "adminToken",
    "admin_token",
    "adminAuthToken",
    "accessToken",
    "token",
  ];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

    if (value && value !== "undefined" && value !== "null") {
      return value;
    }
  }

  return "";
}

function getAuthHeaders() {
  const token = getAuthToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function formatDateTime(value) {
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

function formatStatus(status) {
  const labels = {
    open: "Open",
    in_progress: "In Progress",
    replied: "Replied",
    closed: "Closed",
  };

  return labels[status] || "-";
}

function formatPriority(priority) {
  const labels = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  };

  return labels[priority] || "Normal";
}

function getStatusClass(status) {
  if (status === "open") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (status === "in_progress") {
    return "bg-yellow-50 text-yellow-700 ring-yellow-200";
  }

  if (status === "replied") {
    return "bg-green-50 text-green-700 ring-green-200";
  }

  if (status === "closed") {
    return "bg-gray-100 text-gray-700 ring-gray-200";
  }

  return "bg-gray-100 text-gray-700 ring-gray-200";
}

function getPriorityClass(priority) {
  if (priority === "urgent") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (priority === "high") {
    return "bg-orange-50 text-orange-700 ring-orange-200";
  }

  if (priority === "normal") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

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
    <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
        —
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-600">{message}</p>
    </div>
  );
}

export default function AdminSupportTicketsPage() {
  const router = useRouter();

  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({
    all: 0,
    open: 0,
    in_progress: 0,
    replied: 0,
    closed: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [filters, setFilters] = useState({
    status: "all",
    priority: "all",
    search: "",
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyModalTicket, setReplyModalTicket] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replySendEmail, setReplySendEmail] = useState(true);

  const [viewModalTicket, setViewModalTicket] = useState(null);

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;

  const filteredTitle = useMemo(() => {
    const statusLabel =
      STATUS_OPTIONS.find((item) => item.value === filters.status)?.label ||
      "All";

    return `${statusLabel} Support Tickets`;
  }, [filters.status]);

  useEffect(() => {
    fetchTickets(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.priority]);

  async function fetchTickets(page = currentPage) {
    try {
      setLoading(true);
      setError("");

      const res = await axios.get("/admin/support-tickets", {
        headers: getAuthHeaders(),
        params: {
          page,
          limit: pagination.limit,
          status: filters.status,
          priority: filters.priority,
          search: filters.search,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to fetch support tickets."
        );
      }

      const data = res.data.data || {};

      setTickets(data.tickets || []);
      setCounts(
        data.counts || {
          all: 0,
          open: 0,
          in_progress: 0,
          replied: 0,
          closed: 0,
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
        "Failed to fetch support tickets.";

      setError(message);

     if (
  error.response?.status === 401 ||
  String(message).toLowerCase().includes("unauthorized") ||
  String(message).toLowerCase().includes("invalid or expired token")
) {
  router.push("/login");
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
    fetchTickets(1);
  }

  async function updateTicket(ticket, payload, successMessage) {
    const ticketId = ticket.ticket_id || ticket._id;

    try {
      setActionLoading(`${ticketId}:${JSON.stringify(payload)}`);
      setError("");

      const res = await axios.patch(
        `/admin/support-tickets/${ticketId}`,
        payload,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to update support ticket."
        );
      }

      alert(successMessage || res.data.message || "Support ticket updated.");

      await fetchTickets(currentPage);

      if (selectedTicket?._id === ticket._id) {
        setSelectedTicket(res.data.data?.ticket || null);
      }

      if (viewModalTicket?._id === ticket._id) {
        setViewModalTicket(res.data.data?.ticket || null);
      }

      return res.data.data?.ticket || null;
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to update support ticket."
      );

      return null;
    } finally {
      setActionLoading("");
    }
  }

  async function handleMarkInProgress(ticket) {
    await updateTicket(
      ticket,
      {
        status: "in_progress",
      },
      "Ticket marked as in progress."
    );
  }

  async function handleCloseTicket(ticket) {
    const confirmed = window.confirm("Close this support ticket?");

    if (!confirmed) return;

    await updateTicket(
      ticket,
      {
        status: "closed",
      },
      "Ticket closed successfully."
    );
  }

  async function handlePriorityChange(ticket, priority) {
    await updateTicket(
      ticket,
      {
        priority,
      },
      "Ticket priority updated."
    );
  }

  function openReplyModal(ticket) {
    setReplyModalTicket(ticket);
    setReplyText(ticket.admin_reply || "");
    setReplySendEmail(true);
  }

  function closeReplyModal() {
    if (actionLoading) return;

    setReplyModalTicket(null);
    setReplyText("");
    setReplySendEmail(true);
  }

  async function submitReply(event) {
    event.preventDefault();

    if (!replyModalTicket) return;

    const cleanReply = String(replyText || "").trim();

    if (!cleanReply) {
      alert("Admin reply is required.");
      return;
    }

    const updatedTicket = await updateTicket(
      replyModalTicket,
      {
        admin_reply: cleanReply,
        send_email: replySendEmail,
      },
      replySendEmail
        ? "Reply saved and email sent to customer."
        : "Reply saved without sending email."
    );

    if (updatedTicket) {
      closeReplyModal();
    }
  }

  async function handleDeleteTicket(ticket) {
    const confirmed = window.confirm(
      `Delete support ticket ${ticket.ticket_id}? This action cannot be undone.`
    );

    if (!confirmed) return;

    const ticketId = ticket.ticket_id || ticket._id;

    try {
      setActionLoading(`delete:${ticketId}`);

      const res = await axios.delete(`/admin/support-tickets/${ticketId}`, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to delete support ticket."
        );
      }

      alert(res.data.message || "Support ticket deleted successfully.");

      setViewModalTicket(null);
      setSelectedTicket(null);

      await fetchTickets(currentPage);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to delete support ticket."
      );
    } finally {
      setActionLoading("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="relative p-6 md:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-blue-50" />
            <div className="absolute bottom-0 right-24 h-20 w-20 rounded-t-full bg-green-50" />

            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
                  Admin Support
                </p>

                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-950">
                  Support Tickets
                </h1>

                <p className="mt-2 max-w-2xl text-sm text-gray-600">
                  Manage chat widget support tickets, reply to customers, update
                  ticket status, and close resolved requests.
                </p>
              </div>

              <button
                type="button"
                onClick={() => fetchTickets(currentPage)}
                className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-800 shadow-sm hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <SummaryCard
            title="All"
            value={counts.all}
            active={filters.status === "all"}
            onClick={() => updateFilter("status", "all")}
          />

          <SummaryCard
            title="Open"
            value={counts.open}
            active={filters.status === "open"}
            onClick={() => updateFilter("status", "open")}
          />

          <SummaryCard
            title="In Progress"
            value={counts.in_progress}
            active={filters.status === "in_progress"}
            onClick={() => updateFilter("status", "in_progress")}
          />

          <SummaryCard
            title="Replied"
            value={counts.replied}
            active={filters.status === "replied"}
            onClick={() => updateFilter("status", "replied")}
          />

          <SummaryCard
            title="Closed"
            value={counts.closed}
            active={filters.status === "closed"}
            onClick={() => updateFilter("status", "closed")}
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
              placeholder="Search ticket ID, customer, email, phone, booking ID, or message..."
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
            />

            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <select
              value={filters.priority}
              onChange={(event) =>
                updateFilter("priority", event.target.value)
              }
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
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
                {filteredTitle}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Showing {tickets.length} of {pagination.total || 0} tickets.
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
              Loading support tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-5">
              <EmptyState message="No support tickets found." />
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 whitespace-nowrap">Ticket</th>
                    <th className="px-4 py-3 whitespace-nowrap">Customer</th>
                    <th className="px-4 py-3 whitespace-nowrap">Booking</th>
                    <th className="px-4 py-3 whitespace-nowrap">Message</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 whitespace-nowrap">Priority</th>
                    <th className="px-4 py-3 whitespace-nowrap">Created</th>
                    <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {tickets.map((ticket) => {
                    const ticketId = ticket.ticket_id || ticket._id;

                    return (
                      <tr key={ticket._id} className="align-top hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <p className="font-extrabold text-gray-950 whitespace-nowrap">
                            {ticket.ticket_id}
                          </p>
                          <p className="mt-1 text-gray-500">
                            Source: {ticket.source || "chat_widget"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-bold text-gray-900">
                            {ticket.name || "-"}
                          </p>
                          <p className="mt-1 break-all text-gray-500">
                            {ticket.email || "-"}
                          </p>
                          <p className="mt-1 text-gray-500">
                            {ticket.phone || "-"}
                          </p>
                        </td>

                        <td className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">
                          {ticket.booking_id || "-"}
                        </td>

                        <td className="px-4 py-4">
                          <p className="max-w-[260px] line-clamp-3 text-gray-700">
                            {ticket.message}
                          </p>

                          {ticket.admin_reply && (
                            <p className="mt-2 max-w-[260px] rounded-xl bg-green-50 p-2 text-green-700 line-clamp-2">
                              Reply: {ticket.admin_reply}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            value={formatStatus(ticket.status)}
                            className={getStatusClass(ticket.status)}
                          />
                        </td>

                        <td className="px-4 py-4">
                          <select
                            value={ticket.priority || "normal"}
                            onChange={(event) =>
                              handlePriorityChange(ticket, event.target.value)
                            }
                            className={`rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold outline-none ${getPriorityClass(
                              ticket.priority
                            )}`}
                          >
                            {PRIORITY_OPTIONS.filter(
                              (item) => item.value !== "all"
                            ).map((priority) => (
                              <option
                                key={priority.value}
                                value={priority.value}
                              >
                                {priority.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                          {formatDateTime(ticket.createdAt)}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => setViewModalTicket(ticket)}
                              className="rounded-xl border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-white whitespace-nowrap"
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() => openReplyModal(ticket)}
                              className="rounded-xl border border-green-200 px-3 py-2 font-bold text-green-700 hover:bg-green-50 whitespace-nowrap"
                            >
                              Reply
                            </button>

                            {ticket.status !== "in_progress" &&
                              ticket.status !== "closed" && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkInProgress(ticket)}
                                  disabled={Boolean(actionLoading)}
                                  className="rounded-xl border border-yellow-200 px-3 py-2 font-bold text-yellow-700 hover:bg-yellow-50 disabled:opacity-60 whitespace-nowrap"
                                >
                                  In Progress
                                </button>
                              )}

                            {ticket.status !== "closed" && (
                              <button
                                type="button"
                                onClick={() => handleCloseTicket(ticket)}
                                disabled={Boolean(actionLoading)}
                                className="rounded-xl border border-gray-300 px-3 py-2 font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-60 whitespace-nowrap"
                              >
                                Close
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteTicket(ticket)}
                              disabled={Boolean(actionLoading)}
                              className="rounded-xl border border-red-200 px-3 py-2 font-bold text-red-700 hover:bg-red-50 disabled:opacity-60 whitespace-nowrap"
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

          <div className="flex flex-col gap-3 border-t border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => fetchTickets(currentPage - 1)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={currentPage >= totalPages || loading}
                onClick={() => fetchTickets(currentPage + 1)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewModalTicket && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-extrabold text-gray-950">
                  Ticket Details
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {viewModalTicket.ticket_id}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewModalTicket(null)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase text-gray-400">
                  Customer
                </p>
                <p className="mt-2 font-bold text-gray-950">
                  {viewModalTicket.name}
                </p>
                <p className="mt-1 break-all text-sm text-gray-600">
                  {viewModalTicket.email}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {viewModalTicket.phone}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase text-gray-400">
                  Ticket
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge
                    value={formatStatus(viewModalTicket.status)}
                    className={getStatusClass(viewModalTicket.status)}
                  />
                  <StatusBadge
                    value={formatPriority(viewModalTicket.priority)}
                    className={getPriorityClass(viewModalTicket.priority)}
                  />
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  Booking ID:{" "}
                  <strong>{viewModalTicket.booking_id || "-"}</strong>
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Created: {formatDateTime(viewModalTicket.createdAt)}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold uppercase text-gray-400">
                Customer Message
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                {viewModalTicket.message}
              </p>
            </div>

            {viewModalTicket.admin_reply && (
              <div className="mt-5 rounded-2xl border border-green-100 bg-green-50 p-4">
                <p className="text-xs font-bold uppercase text-green-700">
                  Admin Reply
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-green-800">
                  {viewModalTicket.admin_reply}
                </p>
                <p className="mt-3 text-xs text-green-700">
                  Replied at:{" "}
                  {formatDateTime(viewModalTicket.admin_replied_at)}
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => openReplyModal(viewModalTicket)}
                className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
              >
                Reply
              </button>

              {viewModalTicket.status !== "closed" && (
                <button
                  type="button"
                  onClick={() => handleCloseTicket(viewModalTicket)}
                  className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  Close Ticket
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDeleteTicket(viewModalTicket)}
                className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {replyModalTicket && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-extrabold text-gray-950">
                  Reply to Ticket
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {replyModalTicket.ticket_id} · {replyModalTicket.email}
                </p>
              </div>

              <button
                type="button"
                onClick={closeReplyModal}
                disabled={Boolean(actionLoading)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-bold uppercase text-gray-400">
                Customer Message
              </p>
              <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-gray-700">
                {replyModalTicket.message}
              </p>
            </div>

            <form onSubmit={submitReply} className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700">
                  Admin Reply
                </label>

                <textarea
                  rows={6}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Write your reply to the customer..."
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={replySendEmail}
                  onChange={(event) => setReplySendEmail(event.target.checked)}
                  className="h-4 w-4"
                />
                Send reply email to customer
              </label>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeReplyModal}
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
                  {actionLoading ? "Sending..." : "Save Reply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}