"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "@/app/frontend/utils/axios";

const tabs = [
  { value: "credit", label: "Credit" },
  { value: "withdraw", label: "Withdraw Request" },
  { value: "transactions", label: "Wallet Transactions" },
];

const walletStatusOptions = [
  { value: "active", label: "Active" },
  { value: "frozen", label: "Frozen" },
  { value: "disabled", label: "Disabled" },
];

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
  return `A$${Number(value || 0).toFixed(2)}`;
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

function formatText(value) {
  const labels = {
    active: "Active",
    frozen: "Frozen",
    disabled: "Disabled",

    topup_stripe: "Stripe Top Up",
    topup_paypal: "PayPal Top Up",
    booking_payment: "Booking Payment",
    refund_credit: "Refund Credit",
    withdrawal_request: "Withdrawal Request",
    withdrawal_paid: "Withdrawal Paid",
    admin_adjustment: "Admin Credit",

    credit: "Credit",
    debit: "Debit",

    completed: "Completed",
    pending: "Pending",
    failed: "Failed",
    cancelled: "Rejected",
    refunded: "Refunded",
    reversed: "Reversed",

    stripe: "Stripe",
    paypal: "PayPal",
    wallet: "Wallet",
    admin: "Admin",
    bank: "Bank",

    bank_transfer: "Bank Transfer",
    cash: "Cash",
    other: "Other",
  };

  return (
    labels[value] ||
    String(value || "-")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function getStatusClass(status) {
  if (status === "active" || status === "completed") {
    return "bg-green-50 text-green-700";
  }

  if (status === "pending" || status === "frozen") {
    return "bg-yellow-50 text-yellow-800";
  }

  if (status === "disabled" || status === "failed" || status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-gray-100 text-gray-700";
}

function getErrorMessage(error, fallback) {
  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    fallback
  );
}

function getPayoutDetailsText(transaction) {
  const details =
    transaction?.payout_details || transaction?.metadata?.payout_details;

  if (!details) return "-";

  if (details.method === "bank_transfer") {
    return [
      "Method: Bank Transfer",
      `Holder: ${details.account_holder_name || "-"}`,
      `Bank: ${details.bank_name || "-"}`,
      `BSB: ${details.bsb || "-"}`,
      `Account: ${details.account_number || "-"}`,
    ].join("\n");
  }

  if (details.method === "paypal") {
    return ["Method: PayPal", `Email: ${details.paypal_email || "-"}`].join(
      "\n"
    );
  }

  return [
    `Method: ${formatText(details.method)}`,
    details.customer_note ? `Note: ${details.customer_note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function getAdminProofText(transaction) {
  const proof =
    transaction?.admin_payment_proof ||
    transaction?.metadata?.admin_payment_proof;

  if (!proof) return "";

  return [
    `Paid Method: ${formatText(proof.paid_method)}`,
    `Reference: ${proof.paid_reference || "-"}`,
    proof.paid_note ? `Note: ${proof.paid_note}` : "",
    proof.paid_at ? `Paid At: ${formatDateTime(proof.paid_at)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function AdminWalletsPage() {
  const [activeTab, setActiveTab] = useState("credit");

  const [wallets, setWallets] = useState([]);
  const [walletSearch, setWalletSearch] = useState("");
  const [walletStatus, setWalletStatus] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);

  const [creditForm, setCreditForm] = useState({
    email: "",
    amount: "",
    note: "",
  });

  const [creditLoading, setCreditLoading] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const [acceptModalTransaction, setAcceptModalTransaction] = useState(null);
  const [acceptForm, setAcceptForm] = useState({
    paid_method: "",
    paid_reference: "",
    paid_note: "",
  });
  const [acceptError, setAcceptError] = useState("");

  const [editWallet, setEditWallet] = useState(null);
  const [editWalletForm, setEditWalletForm] = useState({
    wallet_balance: "",
    wallet_status: "active",
    note: "",
  });
  const [editWalletError, setEditWalletError] = useState("");

  useEffect(() => {
    fetchWallets();
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withdrawalRequests = useMemo(() => {
    return transactions.filter((transaction) => {
      const isWithdrawal = ["withdrawal_request", "withdrawal_paid"].includes(
        transaction.type
      );

      const isDeleted =
        transaction.metadata?.admin_withdraw_deleted === true ||
        transaction.admin_withdraw_deleted === true;

      return isWithdrawal && !isDeleted;
    });
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(
      (transaction) =>
        !["withdrawal_request", "withdrawal_paid"].includes(transaction.type)
    );
  }, [transactions]);

  async function fetchWallets() {
    try {
      setWalletLoading(true);

      const res = await axios.get("/admin/wallets", {
        headers: getAuthHeaders(),
        params: {
          search: walletSearch || undefined,
          status: walletStatus || undefined,
          limit: 300,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to load wallets."
        );
      }

      setWallets(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error) {
      alert(getErrorMessage(error, "Failed to load wallets."));
      setWallets([]);
    } finally {
      setWalletLoading(false);
    }
  }

  async function fetchTransactions() {
    try {
      setTransactionLoading(true);

      const res = await axios.get("/admin/wallet-transactions", {
        headers: getAuthHeaders(),
        params: {
          search: transactionSearch || undefined,
          limit: 300,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load wallet transactions."
        );
      }

      setTransactions(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error) {
      alert(getErrorMessage(error, "Failed to load wallet transactions."));
      setTransactions([]);
    } finally {
      setTransactionLoading(false);
    }
  }

  function updateCreditField(name, value) {
    setCreditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleCreditSubmit(event) {
    event.preventDefault();

    const email = String(creditForm.email || "").trim().toLowerCase();
    const amount = Number(creditForm.amount || 0);

    if (!email) {
      alert("Customer email is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Amount must be greater than 0.");
      return;
    }

    try {
      setCreditLoading(true);

      const res = await axios.post(
        "/admin/wallets/credit",
        {
          email,
          amount,
          note: creditForm.note,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to credit wallet."
        );
      }

      alert(res.data.message || "Wallet credited successfully.");

      setCreditForm({
        email: "",
        amount: "",
        note: "",
      });

      await fetchWallets();
      await fetchTransactions();
    } catch (error) {
      alert(getErrorMessage(error, "Failed to credit wallet."));
    } finally {
      setCreditLoading(false);
    }
  }

  async function deleteWallet(wallet) {
    const confirmed = window.confirm(
      `Delete/disable wallet for ${wallet.email}? Wallets with balance cannot be deleted.`
    );

    if (!confirmed) return;

    try {
      setActionLoading(`delete:${wallet._id}`);

      const res = await axios.delete(`/admin/wallets/${wallet._id}`, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to delete wallet."
        );
      }

      alert(res.data.message || "Wallet deleted/disabled successfully.");

      await fetchWallets();
    } catch (error) {
      alert(getErrorMessage(error, "Failed to delete wallet."));
    } finally {
      setActionLoading("");
    }
  }

  function openEditWalletModal(wallet) {
    setEditWallet(wallet);
    setEditWalletForm({
      wallet_balance: String(Number(wallet?.wallet_balance || 0).toFixed(2)),
      wallet_status: wallet?.wallet_status || "active",
      note: "",
    });
    setEditWalletError("");
  }

  function closeEditWalletModal() {
    if (actionLoading) return;

    setEditWallet(null);
    setEditWalletForm({
      wallet_balance: "",
      wallet_status: "active",
      note: "",
    });
    setEditWalletError("");
  }

  async function submitEditWallet(event) {
    event.preventDefault();

    if (!editWallet?._id) return;

    try {
      const walletBalance = Number(editWalletForm.wallet_balance || 0);

      if (!Number.isFinite(walletBalance) || walletBalance < 0) {
        throw new Error("Wallet balance must be 0 or greater.");
      }

      if (!walletStatusOptions.some((option) => option.value === editWalletForm.wallet_status)) {
        throw new Error("Invalid wallet status.");
      }

      setActionLoading(`edit:${editWallet._id}`);
      setEditWalletError("");

      const res = await axios.patch(
        `/admin/wallets/${editWallet._id}`,
        {
          wallet_balance: walletBalance,
          wallet_status: editWalletForm.wallet_status,
          note: editWalletForm.note,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to update wallet."
        );
      }

      alert(res.data.message || "Wallet updated successfully.");

      setEditWallet(null);
      setEditWalletForm({
        wallet_balance: "",
        wallet_status: "active",
        note: "",
      });
      setEditWalletError("");

      await fetchWallets();
      await fetchTransactions();
    } catch (error) {
      setEditWalletError(getErrorMessage(error, "Failed to update wallet."));
    } finally {
      setActionLoading("");
    }
  }

  function openAcceptModal(transaction) {
    setAcceptModalTransaction(transaction);
    setAcceptForm({
      paid_method: "",
      paid_reference: "",
      paid_note: "",
    });
    setAcceptError("");
  }

  function closeAcceptModal() {
    if (actionLoading) return;

    setAcceptModalTransaction(null);
    setAcceptForm({
      paid_method: "",
      paid_reference: "",
      paid_note: "",
    });
    setAcceptError("");
  }

  async function submitAcceptWithdrawal(event) {
    event.preventDefault();

    if (!acceptModalTransaction) return;

    try {
      if (!acceptForm.paid_method) {
        throw new Error("Please select paid method.");
      }

      if (!acceptForm.paid_reference.trim()) {
        throw new Error("Payment reference / proof is required.");
      }

      setActionLoading(`paid:${acceptModalTransaction._id}`);
      setAcceptError("");

      const res = await axios.post(
        `/admin/wallet-transactions/${acceptModalTransaction._id}/paid`,
        acceptForm,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to accept withdrawal request."
        );
      }

      alert(res.data.message || "Withdrawal accepted and marked as paid.");

      setAcceptModalTransaction(null);
      setAcceptForm({
        paid_method: "",
        paid_reference: "",
        paid_note: "",
      });
      setAcceptError("");

      await fetchTransactions();
    } catch (error) {
      setAcceptError(getErrorMessage(error, "Failed to accept withdrawal."));
    } finally {
      setActionLoading("");
    }
  }

  async function rejectWithdrawal(transaction) {
    const reason = window.prompt(
      `Reject withdrawal ${transaction.transaction_reference}? Optional reason:`,
      ""
    );

    if (reason === null) return;

    const confirmed = window.confirm(
      `Reject this withdrawal and return ${money(
        transaction.amount
      )} to the customer's wallet?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(`reject:${transaction._id}`);

      const res = await axios.post(
        `/admin/wallet-transactions/${transaction._id}/reject`,
        {
          note: reason,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to reject withdrawal request."
        );
      }

      alert(res.data.message || "Withdrawal rejected and wallet refunded.");

      await fetchWallets();
      await fetchTransactions();
    } catch (error) {
      alert(getErrorMessage(error, "Failed to reject withdrawal request."));
    } finally {
      setActionLoading("");
    }
  }

  async function deleteWithdrawRequest(transaction) {
    if (transaction.status === "pending") {
      alert("Please accept or reject this withdrawal request before deleting.");
      return;
    }

    const confirmed = window.confirm(
      `Delete withdrawal request ${transaction.transaction_reference} from the admin list?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(`delete-withdraw:${transaction._id}`);

      const res = await axios.delete(
        `/admin/wallet-transactions/${transaction._id}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to delete withdrawal request."
        );
      }

      alert(res.data.message || "Withdrawal request deleted.");

      await fetchTransactions();
    } catch (error) {
      alert(getErrorMessage(error, "Failed to delete withdrawal request."));
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Admin
          </p>

          <h1 className="mt-1 text-3xl font-bold text-gray-950">Wallets</h1>

          <p className="mt-2 text-sm text-gray-500">
            Credit customer wallets, review withdrawal requests, and monitor all
            wallet transactions.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-2 shadow-sm">
          <div className="grid gap-2 md:grid-cols-3">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                  activeTab === tab.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-50 text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "credit" && (
          <>
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-950">
                Credit Customer Wallet
              </h2>

              <form
                onSubmit={handleCreditSubmit}
                className="mt-5 grid gap-4 md:grid-cols-[1.2fr_0.7fr_1fr_auto]"
              >
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Customer Email *
                  </label>

                  <input
                    type="email"
                    value={creditForm.email}
                    onChange={(event) =>
                      updateCreditField("email", event.target.value)
                    }
                    placeholder="customer@email.com"
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Amount *
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={creditForm.amount}
                    onChange={(event) =>
                      updateCreditField("amount", event.target.value)
                    }
                    placeholder="50.00"
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Note
                  </label>

                  <input
                    value={creditForm.note}
                    onChange={(event) =>
                      updateCreditField("note", event.target.value)
                    }
                    placeholder="Optional note"
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creditLoading}
                  className="mt-7 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {creditLoading ? "Sending..." : "Send"}
                </button>
              </form>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <input
                  value={walletSearch}
                  onChange={(event) => setWalletSearch(event.target.value)}
                  placeholder="Search by name, email, phone..."
                  className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                />

                <select
                  value={walletStatus}
                  onChange={(event) => setWalletStatus(event.target.value)}
                  className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                >
                  <option value="">All Wallet Status</option>
                  {walletStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={fetchWallets}
                  disabled={walletLoading}
                  className="rounded-2xl border px-5 py-3 text-sm font-bold text-gray-700 disabled:opacity-60"
                >
                  {walletLoading ? "Loading..." : "Search"}
                </button>
              </div>
            </div>

            <WalletUsersTable
              wallets={wallets}
              loading={walletLoading}
              actionLoading={actionLoading}
              onEdit={openEditWalletModal}
              onDelete={deleteWallet}
            />
          </>
        )}

        {activeTab === "withdraw" && (
          <WithdrawalTable
            transactions={withdrawalRequests}
            loading={transactionLoading}
            actionLoading={actionLoading}
            onRefresh={fetchTransactions}
            onAccept={openAcceptModal}
            onReject={rejectWithdrawal}
            onDelete={deleteWithdrawRequest}
          />
        )}

        {activeTab === "transactions" && (
          <>
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  value={transactionSearch}
                  onChange={(event) =>
                    setTransactionSearch(event.target.value)
                  }
                  placeholder="Search transaction reference, customer, note..."
                  className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                />

                <button
                  type="button"
                  onClick={fetchTransactions}
                  disabled={transactionLoading}
                  className="rounded-2xl border px-5 py-3 text-sm font-bold text-gray-700 disabled:opacity-60"
                >
                  {transactionLoading ? "Loading..." : "Search"}
                </button>
              </div>
            </div>

            <TransactionsTable
              transactions={filteredTransactions}
              loading={transactionLoading}
              title="Wallet Transactions"
            />
          </>
        )}
      </div>

      {editWallet && (
        <EditWalletModal
          wallet={editWallet}
          form={editWalletForm}
          error={editWalletError}
          saving={actionLoading === `edit:${editWallet._id}`}
          setForm={setEditWalletForm}
          onClose={closeEditWalletModal}
          onSubmit={submitEditWallet}
        />
      )}

      {acceptModalTransaction && (
        <AcceptWithdrawalModal
          transaction={acceptModalTransaction}
          form={acceptForm}
          error={acceptError}
          saving={actionLoading === `paid:${acceptModalTransaction._id}`}
          setForm={setAcceptForm}
          onClose={closeAcceptModal}
          onSubmit={submitAcceptWithdrawal}
        />
      )}
    </div>
  );
}

function WalletUsersTable({
  wallets,
  loading,
  actionLoading,
  onEdit,
  onDelete,
}) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-lg font-bold text-gray-950">Wallet Users</h2>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-3 whitespace-nowrap">Email</th>
              <th className="px-3 py-3 whitespace-nowrap">Balance</th>
              <th className="px-3 py-3 whitespace-nowrap">Status</th>
              <th className="px-3 py-3 whitespace-nowrap">Transactions</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center text-gray-500"
                >
                  Loading wallets...
                </td>
              </tr>
            )}

            {!loading && wallets.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center text-gray-500"
                >
                  No wallet users found.
                </td>
              </tr>
            )}

            {!loading &&
              wallets.map((wallet) => (
                <tr key={wallet._id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-gray-950 whitespace-nowrap">
                      {wallet.email}
                    </div>
                    <div className="mt-1 text-gray-500">
                      {wallet.phone || "-"}
                    </div>
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap">
                    <strong>{money(wallet.wallet_balance)}</strong>
                  </td>

                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 font-bold ${getStatusClass(
                        wallet.wallet_status
                      )}`}
                    >
                      {formatText(wallet.wallet_status)}
                    </span>
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap">
                    {wallet.transaction_count || 0}
                  </td>

                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(wallet)}
                        disabled={Boolean(actionLoading)}
                        className="rounded-xl bg-blue-50 px-4 py-2 font-bold text-blue-700 disabled:opacity-60"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(wallet)}
                        disabled={actionLoading === `delete:${wallet._id}`}
                        className="rounded-xl bg-red-50 px-4 py-2 font-bold text-red-700 disabled:opacity-60"
                      >
                        {actionLoading === `delete:${wallet._id}`
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WithdrawalTable({
  transactions,
  loading,
  actionLoading,
  onRefresh,
  onAccept,
  onReject,
  onDelete,
}) {
  return (
    <div className="w-full overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-[3%] py-[2%]">
        <h2 className="text-lg font-bold text-gray-950">Withdraw Request</h2>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-xl border px-[3%] py-[1.5%] text-xs font-bold text-gray-700 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-[0.7rem] sm:text-xs">
          <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-[12%] break-words px-[1%] py-[2%]">
                Reference
              </th>
              <th className="w-[16%] break-words px-[1%] py-[2%]">
                Customer
              </th>
              <th className="w-[10%] break-words px-[1%] py-[2%]">
                Amount
              </th>
              <th className="w-[26%] break-words px-[1%] py-[2%]">
                Payout Details
              </th>
              <th className="w-[12%] break-words px-[1%] py-[2%]">
                Status
              </th>
              <th className="w-[12%] break-words px-[1%] py-[2%]">
                Requested
              </th>
              <th className="w-[12%] px-[1%] py-[2%] text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-[1%] py-[5%] text-center text-gray-500"
                >
                  Loading withdrawal requests...
                </td>
              </tr>
            )}

            {!loading && transactions.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-[1%] py-[5%] text-center text-gray-500"
                >
                  No withdrawal requests found.
                </td>
              </tr>
            )}

            {!loading &&
              transactions.map((transaction) => {
                const adminProofText = getAdminProofText(transaction);

                return (
                  <tr
                    key={transaction._id}
                    className="align-top hover:bg-gray-50"
                  >
                    <td className="break-words px-[1%] py-[2%] font-bold">
                      {transaction.transaction_reference}
                    </td>

                    <td className="break-words px-[1%] py-[2%]">
                      <div className="font-semibold break-words">
                        {transaction.user_email}
                      </div>

                      <div className="mt-1 break-words text-gray-500">
                        {transaction.user_name}
                      </div>
                    </td>

                    <td className="break-words px-[1%] py-[2%] font-bold text-red-700">
                      {money(transaction.amount)}
                    </td>

                    <td className="px-[1%] py-[2%]">
                      <div className="w-full whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-[3%] leading-5 text-gray-700">
                        {getPayoutDetailsText(transaction)}
                      </div>

                      {adminProofText && (
                        <div className="mt-2 w-full whitespace-pre-wrap break-words rounded-xl bg-green-50 p-[3%] leading-5 text-green-700">
                          {adminProofText}
                        </div>
                      )}
                    </td>

                    <td className="px-[1%] py-[2%]">
                      <span
                        className={`inline-flex break-words rounded-full px-[8%] py-[4%] text-center font-bold ${getStatusClass(
                          transaction.status
                        )}`}
                      >
                        {formatText(transaction.status)}
                      </span>

                      {transaction.type === "withdrawal_paid" && (
                        <div className="mt-2 break-words font-semibold text-green-700">
                          Paid manually
                        </div>
                      )}
                    </td>

                    <td className="break-words px-[1%] py-[2%]">
                      {formatDateTime(transaction.createdAt)}
                    </td>

                    <td className="px-[1%] py-[2%]">
                      {transaction.status === "pending" ? (
                        <div className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => onAccept(transaction)}
                            disabled={actionLoading === `paid:${transaction._id}`}
                            className="w-full rounded-xl bg-blue-600 px-[3%] py-[6%] text-[0.65rem] font-bold text-white disabled:opacity-60"
                          >
                            {actionLoading === `paid:${transaction._id}`
                              ? "Saving..."
                              : "Accept"}
                          </button>

                          <button
                            type="button"
                            onClick={() => onReject(transaction)}
                            disabled={actionLoading === `reject:${transaction._id}`}
                            className="w-full rounded-xl bg-red-50 px-[3%] py-[6%] text-[0.65rem] font-bold text-red-700 disabled:opacity-60"
                          >
                            {actionLoading === `reject:${transaction._id}`
                              ? "Rejecting..."
                              : "Reject"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDelete(transaction)}
                          disabled={
                            actionLoading ===
                            `delete-withdraw:${transaction._id}`
                          }
                          className="w-full rounded-xl bg-red-50 px-[3%] py-[6%] text-[0.65rem] font-bold text-red-700 disabled:opacity-60"
                        >
                          {actionLoading ===
                          `delete-withdraw:${transaction._id}`
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionsTable({ transactions, loading, title }) {
  return (
    <div className="w-full overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="border-b px-[3%] py-[2%]">
        <h2 className="text-lg font-bold text-gray-950">{title}</h2>
      </div>

      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-[0.7rem] sm:text-xs">
          <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-[14%] break-words px-[1%] py-[2%]">
                Reference
              </th>
              <th className="w-[18%] break-words px-[1%] py-[2%]">
                Customer
              </th>
              <th className="w-[12%] break-words px-[1%] py-[2%]">Type</th>
              <th className="w-[10%] break-words px-[1%] py-[2%]">
                Direction
              </th>
              <th className="w-[10%] break-words px-[1%] py-[2%]">
                Amount
              </th>
              <th className="w-[14%] break-words px-[1%] py-[2%]">
                Balance
              </th>
              <th className="w-[10%] break-words px-[1%] py-[2%]">Status</th>
              <th className="w-[12%] break-words px-[1%] py-[2%]">Date</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-[1%] py-[5%] text-center text-gray-500"
                >
                  Loading transactions...
                </td>
              </tr>
            )}

            {!loading && transactions.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-[1%] py-[5%] text-center text-gray-500"
                >
                  No transactions found.
                </td>
              </tr>
            )}

            {!loading &&
              transactions.map((transaction) => (
                <tr
                  key={transaction._id}
                  className="align-top hover:bg-gray-50"
                >
                  <td className="break-words px-[1%] py-[2%] font-bold text-gray-950">
                    {transaction.transaction_reference}
                  </td>

                  <td className="break-words px-[1%] py-[2%]">
                    <div className="font-semibold break-words text-gray-900">
                      {transaction.user_email}
                    </div>

                    <div className="mt-1 break-words text-[0.65rem] text-gray-500">
                      {transaction.user_name}
                    </div>
                  </td>

                  <td className="break-words px-[1%] py-[2%]">
                    {formatText(transaction.type)}
                  </td>

                  <td className="px-[1%] py-[2%]">
                    <span
                      className={`inline-flex break-words rounded-full px-[6%] py-[3%] text-[0.65rem] font-bold ${
                        transaction.direction === "credit"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {formatText(transaction.direction)}
                    </span>
                  </td>

                  <td className="break-words px-[1%] py-[2%] font-bold">
                    {money(transaction.amount)}
                  </td>

                  <td className="break-words px-[1%] py-[2%]">
                    <div className="break-words">
                      {money(transaction.balance_before)}
                    </div>

                    <div className="mt-1 break-words text-[0.65rem] text-gray-500">
                      to {money(transaction.balance_after)}
                    </div>
                  </td>

                  <td className="px-[1%] py-[2%]">
                    <span
                      className={`inline-flex break-words rounded-full px-[6%] py-[3%] text-[0.65rem] font-bold ${getStatusClass(
                        transaction.status
                      )}`}
                    >
                      {formatText(transaction.status)}
                    </span>
                  </td>

                  <td className="break-words px-[1%] py-[2%]">
                    {formatDateTime(transaction.createdAt)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditWalletModal({
  wallet,
  form,
  error,
  saving,
  setForm,
  onClose,
  onSubmit,
}) {
  if (!wallet) return null;

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-gray-950">Edit Wallet</h3>

            <p className="mt-1 text-sm text-gray-500">
              Update wallet balance and wallet status.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 overflow-y-auto p-6">
          <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
            <p>
              <strong>Email:</strong> {wallet.email || "-"}
            </p>
            <p className="mt-1">
              <strong>Phone:</strong> {wallet.phone || "-"}
            </p>
            <p className="mt-1">
              <strong>Current Balance:</strong> {money(wallet.wallet_balance)}
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Wallet Balance
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={form.wallet_balance}
              onChange={(event) =>
                updateField("wallet_balance", event.target.value)
              }
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Wallet Status
            </label>

            <select
              value={form.wallet_status}
              onChange={(event) =>
                updateField("wallet_status", event.target.value)
              }
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              required
            >
              {walletStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Admin Note
            </label>

            <textarea
              rows={4}
              value={form.note}
              onChange={(event) => updateField("note", event.target.value)}
              placeholder="Optional reason for this wallet update"
              className="mt-2 w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t pt-5">
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
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Wallet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AcceptWithdrawalModal({
  transaction,
  form,
  error,
  saving,
  setForm,
  onClose,
  onSubmit,
}) {
  if (!transaction) return null;

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-[3%]">
      <div className="flex max-h-[95vh] w-full max-w-[95vw] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-w-[85vw] lg:max-w-[45vw]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-[5%] py-[4%]">
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-lg font-bold text-gray-950 sm:text-xl">
              Accept Withdrawal
            </h3>

            <p className="mt-1 break-words text-xs text-gray-500 sm:text-sm">
              Confirm you manually paid this customer outside the system.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border px-[4%] py-[2%] text-xs font-bold disabled:opacity-60 sm:text-sm"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-[5%] py-[4%]">
          <div className="rounded-2xl bg-gray-50 p-[4%] text-xs text-gray-700 sm:text-sm">
            <p className="break-words">
              <strong>Reference:</strong> {transaction.transaction_reference}
            </p>

            <p className="mt-2 break-words">
              <strong>Customer:</strong> {transaction.user_email}
            </p>

            <p className="mt-2 break-words">
              <strong>Amount:</strong> {money(transaction.amount)}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-sm font-bold text-gray-900">Payout Details</p>

            <div className="mt-2 max-h-[20vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-[4%] text-xs leading-5 text-gray-700">
              {getPayoutDetailsText(transaction)}
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Paid Method
              </label>

              <select
                value={form.paid_method}
                onChange={(event) =>
                  updateField("paid_method", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border px-[4%] py-[3%] text-sm outline-none focus:border-blue-600"
                required
              >
                <option value="">Select paid method</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="paypal">PayPal</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Payment Reference / Proof
              </label>

              <input
                value={form.paid_reference}
                onChange={(event) =>
                  updateField("paid_reference", event.target.value)
                }
                placeholder="Bank transfer ID / PayPal transaction ID / receipt note"
                className="mt-2 w-full rounded-2xl border px-[4%] py-[3%] text-sm outline-none focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Paid Note
              </label>

              <textarea
                rows={4}
                value={form.paid_note}
                onChange={(event) => updateField("paid_note", event.target.value)}
                placeholder="Optional note about the manual payout..."
                className="mt-2 w-full resize-none rounded-2xl border px-[4%] py-[3%] text-sm outline-none focus:border-blue-600"
              />
            </div>

            {error && (
              <div className="break-words rounded-2xl border border-red-200 bg-red-50 p-[4%] text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="w-full rounded-2xl border px-[4%] py-[3%] text-sm font-bold text-gray-700 disabled:opacity-60 sm:w-auto"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-blue-600 px-[4%] py-[3%] text-sm font-bold text-white disabled:opacity-60 sm:w-auto"
              >
                {saving ? "Saving..." : "Confirm Paid"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
