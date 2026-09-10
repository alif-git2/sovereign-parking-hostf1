"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "@/app/frontend/utils/axios";

const HOLDING_DEPOSIT_AMOUNT = 20;

const sourceOptions = [
  { value: "", label: "Select" },
  { value: "web", label: "Website" },
  { value: "google", label: "Google" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "friend", label: "Friend / Referral" },
  { value: "returning_customer", label: "Returning Customer" },
  { value: "other", label: "Other" },
];

const adminPaymentMethodOptions = [
  { value: "", label: "Select Payment Method" },
  { value: "stripe", label: "Stripe" },
  { value: "paypal", label: "PayPal" },
  { value: "credit_card_manual", label: "Credit Card Manual" },
];

const initialForm = {
  location_id: "",
  storage_type_id: "",

  start_date: "",
  end_date: "",

  first_name: "",
  last_name: "",
  email: "",
  phone: "",

  reference: "",
  source: "",
  notes: "",

  payment_type: "",
  payment_method: "",
  transaction_reference: "",
  send_confirmation_email: true,
};

function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
}

function money(amount) {
  return `A$ ${Number(amount || 0).toFixed(2)}`;
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

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calculateStorageDays(startDateValue, endDateValue) {
  if (!startDateValue || !endDateValue) return 0;

  const startDate = new Date(startDateValue);
  const endDate = new Date(endDateValue);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  const diffMs = endDate.getTime() - startDate.getTime();

  // Inclusive calendar-day counting:
  // 09 Sep -> 09 Sep = 1 day
  // 04 Sep -> 05 Sep = 2 days
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return days > 0 ? days : 0;
}

function extractStorageTypes(response) {
  const data = response?.data;

  if (Array.isArray(data)) return data;

  return (
    data?.storageTypes ||
    data?.storage_types ||
    data?.types ||
    data?.data ||
    []
  );
}

function extractLocations(response) {
  const data = response?.data?.data || response?.data;

  if (Array.isArray(data)) return data;

  return data?.locations || data?.location || data?.data || [];
}

function getLocationCapacityLabel(location) {
  if (!location) return "-";

  const capacity = Number(location.capacity || 0);
  const booked = Number(location.booked_count || location.current_bookings || 0);

  if (!capacity) {
    return "Capacity not set";
  }

  return `${booked} / ${capacity}`;
}


function normalizeAvailabilityPayload(payload) {
  const root = payload || {};
  const data = root.data || {};

  const available =
    typeof root.available === "boolean"
      ? root.available
      : typeof data.available === "boolean"
      ? data.available
      : false;

  return {
    ...data,
    available,
    message:
      root.message ||
      data.message ||
      (available
        ? "Storage is available for the selected dates."
        : "Storage is not available for the selected dates."),
  };
}

function getAvailabilityRemainingLabel(item) {
  if (!item) return "-";

  if (item.unlimited || Number(item.capacity || 0) === 0) {
    return "Unlimited";
  }

  const remaining = Number(item.remaining);

  if (Number.isFinite(remaining)) {
    return `${Math.max(remaining, 0)} remaining`;
  }

  const capacity = Number(item.capacity || 0);
  const booked = Number(item.booked_count || 0);

  return `${Math.max(capacity - booked, 0)} remaining`;
}

async function fetchStorageAvailability({
  locationId,
  storageTypeId,
  startDate,
  endDate,
  headers = {},
}) {
  const res = await axios.get("/storage-availability", {
    headers,
    params: {
      location_id: locationId,
      storage_type_id: storageTypeId,
      start_date: startDate,
      end_date: endDate,
    },
  });

  if (!res.data?.success) {
    throw new Error(
      res.data?.message ||
        res.data?.error ||
        "Failed to check storage availability."
    );
  }

  return normalizeAvailabilityPayload(res.data);
}

export default function AdminStorageCreateBookingModal({ onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);

  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState("");

  const [storageTypes, setStorageTypes] = useState([]);
  const [storageTypesLoading, setStorageTypesLoading] = useState(false);
  const [storageTypesError, setStorageTypesError] = useState("");

  const [storagePriceRule, setStoragePriceRule] = useState(null);
  const [storagePriceLoading, setStoragePriceLoading] = useState(false);
  const [storagePriceError, setStoragePriceError] = useState("");

  const [saving, setSaving] = useState(false);

  const [availability, setAvailability] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");

  const selectedLocation = useMemo(() => {
    return locations.find(
      (location) => String(location._id) === String(form.location_id)
    );
  }, [locations, form.location_id]);

  const selectedStorageType = useMemo(() => {
    return storageTypes.find(
      (type) => String(type._id) === String(form.storage_type_id)
    );
  }, [storageTypes, form.storage_type_id]);

  const estimatedDays = useMemo(() => {
    return calculateStorageDays(form.start_date, form.end_date);
  }, [form.start_date, form.end_date]);

  const availabilityReady = useMemo(() => {
    if (
      !form.location_id ||
      !form.storage_type_id ||
      !form.start_date ||
      !form.end_date
    ) {
      return false;
    }

    const startDate = new Date(form.start_date);
    const endDate = new Date(form.end_date);

    return (
      !Number.isNaN(startDate.getTime()) &&
      !Number.isNaN(endDate.getTime()) &&
      endDate >= startDate
    );
  }, [
    form.location_id,
    form.storage_type_id,
    form.start_date,
    form.end_date,
  ]);

  const originalPrice = Number(storagePriceRule?.price || 0);
  const totalPrice = originalPrice;
  const poaDepositAmount = Math.min(HOLDING_DEPOSIT_AMOUNT, totalPrice || 0);

  const paidAmount =
    form.payment_type === "online"
      ? totalPrice
      : form.payment_type === "poa"
      ? poaDepositAmount
      : 0;

  const dueAmount =
    form.payment_type === "online"
      ? 0
      : form.payment_type === "poa"
      ? Math.max(totalPrice - poaDepositAmount, 0)
      : totalPrice;

  useEffect(() => {
    loadLocations();
    loadStorageTypes();
  }, []);

  useEffect(() => {
    loadStoragePriceRule();
  }, [estimatedDays]);

  useEffect(() => {
    if (!availabilityReady) {
      setAvailability(null);
      setAvailabilityError("");
      setAvailabilityLoading(false);
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        if (!cancelled) {
          setAvailabilityLoading(true);
          setAvailabilityError("");
        }

        const result = await fetchStorageAvailability({
          locationId: form.location_id,
          storageTypeId: form.storage_type_id,
          startDate: form.start_date,
          endDate: form.end_date,
          headers: getAuthHeaders(),
        });

        if (cancelled) return;

        setAvailability(result);

        if (!result.available) {
          setAvailabilityError(
            result.message ||
              "Storage is not available for the selected dates."
          );
        }
      } catch (error) {
        if (cancelled) return;

        setAvailability(null);
        setAvailabilityError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Failed to check storage availability."
        );
      } finally {
        if (!cancelled) {
          setAvailabilityLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    availabilityReady,
    form.location_id,
    form.storage_type_id,
    form.start_date,
    form.end_date,
  ]);

  function getAuthHeaders() {
    const token = getAdminToken();

    return token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {};
  }

  async function loadLocations() {
    try {
      setLocationsLoading(true);
      setLocationsError("");

      const res = await axios.get("/admin/locations", {
        headers: getAuthHeaders(),
        params: {
          type: "storage",
          limit: 200,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load storage locations."
        );
      }

      const finalLocations = extractLocations(res).filter((location) => {
        return location?.type === "storage" || !location?.type;
      });

      setLocations(finalLocations);
    } catch (error) {
      setLocations([]);
      setLocationsError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to load storage locations."
      );
    } finally {
      setLocationsLoading(false);
    }
  }

  async function loadStorageTypes() {
    try {
      setStorageTypesLoading(true);
      setStorageTypesError("");

      const res = await axios.get("/storagetypes", {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success && !Array.isArray(res.data)) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load storage types."
        );
      }

      setStorageTypes(extractStorageTypes(res));
    } catch (error) {
      setStorageTypes([]);
      setStorageTypesError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to load storage types."
      );
    } finally {
      setStorageTypesLoading(false);
    }
  }

  async function loadStoragePriceRule() {
    try {
      setStoragePriceRule(null);
      setStoragePriceError("");

      if (!estimatedDays || estimatedDays < 1) {
        return;
      }

      setStoragePriceLoading(true);

      const res = await axios.get("/settings/price-rules", {
        params: {
          type: "storage",
          days: estimatedDays,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load storage price."
        );
      }

      const matchedRule =
        res.data.data?.matched_price_rule ||
        res.data.data?.price_rules?.[0] ||
        null;

      if (!matchedRule) {
        throw new Error(
          `No storage price rule found for ${estimatedDays} day(s). Please add it from Settings.`
        );
      }

      setStoragePriceRule(matchedRule);
    } catch (error) {
      setStoragePriceRule(null);
      setStoragePriceError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Storage price could not be loaded."
      );
    } finally {
      setStoragePriceLoading(false);
    }
  }

  function updateField(name, value) {
    if (
      ["location_id", "storage_type_id", "start_date", "end_date"].includes(
        name
      )
    ) {
      setAvailability(null);
      setAvailabilityError("");
    }

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "payment_type") {
        next.payment_method = "";
        next.transaction_reference = "";
      }

      if (name === "start_date") {
        if (next.end_date && next.end_date < value) {
          next.end_date = value;
        }
      }

      return next;
    });
  }

  function resetForm() {
    setForm(initialForm);
    setStoragePriceRule(null);
    setStoragePriceError("");
    setAvailability(null);
    setAvailabilityError("");
    setAvailabilityLoading(false);
  }

  function validateForm() {
    if (!form.location_id) {
      throw new Error("Storage location is required.");
    }

    if (!form.storage_type_id) {
      throw new Error("Storage type is required.");
    }

    if (!form.start_date) {
      throw new Error("Entry date is required.");
    }

    if (!form.end_date) {
      throw new Error("Exit date is required.");
    }

    const startDate = new Date(form.start_date);
    const endDate = new Date(form.end_date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error("Invalid date format.");
    }

    if (endDate < startDate) {
      throw new Error("Exit date cannot be before entry date.");
    }

    if (estimatedDays < 1) {
      throw new Error("Selected date range must be at least 1 day.");
    }

    if (storagePriceLoading) {
      throw new Error("Please wait while storage price is loading.");
    }

    if (!storagePriceRule || totalPrice <= 0) {
      throw new Error(
        storagePriceError ||
          `No storage price rule found for ${estimatedDays} day(s). Please add it from Settings.`
      );
    }

    if (!form.first_name.trim()) {
      throw new Error("First name is required.");
    }

    if (!form.last_name.trim()) {
      throw new Error("Last name is required.");
    }

    if (!form.email.trim()) {
      throw new Error("Email is required.");
    }

    if (!form.phone.trim()) {
      throw new Error("Phone is required.");
    }

    if (!form.reference.trim()) {
      throw new Error("License Plate is required.");
    }

    if (!form.payment_type) {
      throw new Error("Please select payment type.");
    }

    if (!["online", "poa"].includes(form.payment_type)) {
      throw new Error("Invalid payment type.");
    }

    if (!form.payment_method) {
      throw new Error("Please select payment method.");
    }

    if (
      !["stripe", "paypal", "credit_card_manual"].includes(form.payment_method)
    ) {
      throw new Error("Invalid payment method.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      validateForm();

      setSaving(true);
      setAvailabilityLoading(true);
      setAvailabilityError("");

      const availabilityResult = await fetchStorageAvailability({
        locationId: form.location_id,
        storageTypeId: form.storage_type_id,
        startDate: form.start_date,
        endDate: form.end_date,
        headers: getAuthHeaders(),
      });

      setAvailability(availabilityResult);
      setAvailabilityLoading(false);

      if (!availabilityResult.available) {
        const message =
          availabilityResult.message ||
          "Storage is not available for the selected dates.";

        setAvailabilityError(message);
        throw new Error(message);
      }

      const paymentFlow =
        form.payment_type === "online" ? "full_online" : "poa_deposit";

      const depositType = form.payment_type === "online" ? "full" : "poa";

      const payload = {
        type: "storage",

        location_id: form.location_id,
        storage_type_id: form.storage_type_id,

        start_date: form.start_date,
        end_date: form.end_date,

        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        name: `${form.first_name} ${form.last_name}`.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),

        reference: form.reference.trim(),
        license_plate: form.reference.trim(),

        source: form.source || "admin",
        notes: form.notes,

        price: totalPrice,
        original_price: originalPrice,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        holding_deposit_amount:
          form.payment_type === "poa" ? poaDepositAmount : 0,
        balance_due_on_arrival: dueAmount,

        payment_type: form.payment_type,
        payment_flow: paymentFlow,
        payment_method: form.payment_method,
        payment_status: form.payment_type === "online" ? "paid" : "partial",
        deposit_type: depositType,

        transaction_id: form.transaction_reference.trim() || undefined,
        transaction_reference: form.transaction_reference.trim() || undefined,
        reference_payment: form.transaction_reference.trim() || undefined,
        manual_payment_reference:
          form.transaction_reference.trim() || undefined,

        price_rule_id: storagePriceRule?._id,
        calculated_days: estimatedDays,

        send_confirmation_email: Boolean(form.send_confirmation_email),
        resend_confirmation_email: Boolean(form.send_confirmation_email),

        admin_create: true,
      };

      const res = await axios.post("/admin/bookings/storage", payload, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to create admin storage booking."
        );
      }

      alert(res.data.message || "Storage booking created successfully.");

      if (onCreated) {
        await onCreated(res.data.data);
      }
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to create storage booking."
      );
    } finally {
      setAvailabilityLoading(false);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">
              Create Storage Booking
            </h2>
  
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

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <section className="rounded-3xl border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-950">
              Storage Booking Details
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Storage Location *
                </label>

                <select
                  value={form.location_id}
                  onChange={(event) =>
                    updateField("location_id", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                >
                  <option value="">
                    {locationsLoading
                      ? "Loading locations..."
                      : "Select storage location"}
                  </option>

                  {locations.map((location) => (
                    <option key={location._id} value={location._id}>
                      {location.name}
                    </option>
                  ))}
                </select>

                {locationsError && (
                  <p className="mt-2 text-sm text-red-600">{locationsError}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Storage Type *
                </label>

                <select
                  value={form.storage_type_id}
                  onChange={(event) =>
                    updateField("storage_type_id", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                >
                  <option value="">
                    {storageTypesLoading
                      ? "Loading storage types..."
                      : "Select storage type"}
                  </option>

                  {storageTypes.map((type) => (
                    <option key={type._id} value={type._id}>
                      {type.name}
                    </option>
                  ))}
                </select>

                {storageTypesError && (
                  <p className="mt-2 text-sm text-red-600">
                    {storageTypesError}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Entry Date *
                </label>

                <input
                  type="date"
                  value={form.start_date}
                  onChange={(event) =>
                    updateField("start_date", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Exit Date *
                </label>

                <input
                  type="date"
                  value={form.end_date}
                  min={form.start_date || undefined}
                  onChange={(event) =>
                    updateField("end_date", event.target.value)
                  }
                  disabled={!form.start_date}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600 disabled:bg-gray-100"
                  required
                />

                {form.start_date && (
                  <p className="mt-1 text-xs text-gray-500">
                    Same-day booking is allowed. Entry and exit dates are both counted.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  License Plate *
                </label>

                <input
                  value={form.reference}
                  onChange={(event) =>
                    updateField("reference", event.target.value)
                  }
                  placeholder="License Plate"
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm uppercase outline-none focus:border-blue-600"
                  required
                />
              </div>

              {/* <div>
                <label className="text-sm font-semibold text-gray-700">
                  Capacity
                </label>

                <input
                  value={selectedLocation ? getLocationCapacityLabel(selectedLocation) : "-"}
                  readOnly
                  className="mt-2 w-full rounded-2xl border bg-gray-50 px-4 py-3 text-sm text-gray-600"
                />
              </div> */}
            </div>

            <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
              <p>
                <strong>Storage Days:</strong> {estimatedDays || "-"}
              </p>

              {storagePriceLoading && (
                <p className="mt-2 text-blue-700">Loading storage price...</p>
              )}

              {storagePriceError && (
                <p className="mt-2 text-red-700">{storagePriceError}</p>
              )}

              {storagePriceRule && (
                <p className="mt-2 text-green-700">
                  Price rule: <strong>{storagePriceRule.label}</strong> —{" "}
                  <strong>{money(storagePriceRule.price)}</strong>
                </p>
              )}

              {availabilityLoading && (
                <p className="mt-2 text-blue-700">
                  Checking storage availability...
                </p>
              )}

              {!availabilityLoading && availabilityError && (
                <p className="mt-2 font-semibold text-red-700">
                  {availabilityError}
                </p>
              )}

              {!availabilityLoading &&
                availability?.available &&
                !availabilityError && (
                  <div className="mt-2 text-green-700">
                    <p className="font-semibold">
                      Storage is available for the selected dates.
                    </p>

                    {/* <p className="mt-1 text-xs">
                      Storage Type:{" "}
                      <strong>
                        {getAvailabilityRemainingLabel(
                          availability.storage_type
                        )}
                      </strong>
                      {" • "}
                      Location:{" "}
                      <strong>
                        {getAvailabilityRemainingLabel(
                          availability.location
                        )}
                      </strong>
                    </p> */}
                  </div>
                )}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-950">
              Customer Details
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  First Name *
                </label>

                <input
                  value={form.first_name}
                  onChange={(event) =>
                    updateField("first_name", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Last Name *
                </label>

                <input
                  value={form.last_name}
                  onChange={(event) =>
                    updateField("last_name", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Email *
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Phone *
                </label>

                <input
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">
                  How did you hear about us?
                </label>

                <select
                  value={form.source}
                  onChange={(event) => updateField("source", event.target.value)}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                >
                  {sourceOptions.map((option) => (
                    <option key={option.value || "select"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">
                  Vehicle Type / Other Info
                </label>

                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-950">Payment</h3>

            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
              <h4 className="font-bold text-gray-900">Price Calculation</h4>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Days</span>
                  <strong>{estimatedDays || 0}</strong>
                </div>

                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <strong>{money(originalPrice)}</strong>
                </div>

                <div className="border-t pt-3 text-base font-bold">
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span>{money(totalPrice)}</span>
                  </div>
                </div>

                {form.payment_type === "poa" && (
                  <div className="flex justify-between text-blue-700">
                    <span>Holding Deposit Paid</span>
                    <strong>{money(poaDepositAmount)}</strong>
                  </div>
                )}

                <div className="flex justify-between text-green-700">
                  <span>Paid Amount</span>
                  <strong>{money(paidAmount)}</strong>
                </div>

                <div className="flex justify-between text-red-700">
                  <span>Due on Arrival</span>
                  <strong>{money(dueAmount)}</strong>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Payment Type *
                </label>

                <select
                  value={form.payment_type}
                  onChange={(event) =>
                    updateField("payment_type", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                >
                  <option value="">Select Payment Type</option>
                  <option value="online">Pay Online</option>
                  <option value="poa">Pay on Arrival</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Payment Method *
                </label>

                <select
                  value={form.payment_method}
                  onChange={(event) =>
                    updateField("payment_method", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                >
                  {adminPaymentMethodOptions.map((option) => (
                    <option key={option.value || "select"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">
                  Transaction ID / Reference Optional
                </label>

                <input
                  value={form.transaction_reference}
                  onChange={(event) =>
                    updateField("transaction_reference", event.target.value)
                  }
                  placeholder="Stripe / PayPal / credit card manual reference"
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                />

                <p className="mt-2 text-xs text-gray-500">
                  This is only saved as a manual reference. Admin booking does
                  not redirect to Stripe or PayPal.
                </p>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold text-gray-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.send_confirmation_email}
                  onChange={(event) =>
                    updateField("send_confirmation_email", event.target.checked)
                  }
                />
                Send confirmation email to customer
              </label>
            </div>
          </section>

          <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-white py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="rounded-2xl border px-5 py-3 text-sm font-bold text-gray-700 disabled:opacity-60"
            >
              Reset
            </button>

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
              disabled={
                saving ||
                availabilityLoading ||
                (availabilityReady && availability?.available === false)
              }
              className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Creating Booking..."
                : availabilityLoading
                ? "Checking Availability..."
                : "Create Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}