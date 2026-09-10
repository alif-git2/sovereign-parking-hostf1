"use client";

import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
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

  start_date: "",
  end_date: "",

  pax: 1,
  shuttle_slot_id: "",
  shuttle_time: "",

  first_name: "",
  last_name: "",
  email: "",
  phone: "",

  license_plate: "",
  interlock: false,
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

function parseLocalDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const dateOnly = String(value).slice(0, 10);
  const [year, month, day] = dateOnly.split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function formatDate(date) {
  if (!date) return "-";

  const parsedDate = parseLocalDate(date);

  if (!parsedDate) {
    return "-";
  }

  return parsedDate.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateInput(date) {
  const value = parseLocalDate(date);

  if (!value) return "";

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDateKey(value) {
  return formatDateInput(value);
}

function getBlockedRanges(location) {
  const blocked =
    location?.blocked_dates ||
    location?.block_dates ||
    location?.blockedDates ||
    [];

  if (!Array.isArray(blocked)) return [];

  return blocked
    .filter((item) => item && item.is_active !== false)
    .map((item) => {
      if (typeof item === "string" || item instanceof Date) {
        const date = normalizeDateKey(item);

        return {
          start: date,
          end: date,
          reason: "This date is blocked by admin.",
        };
      }

      const start = normalizeDateKey(
        item.start_date || item.startDate || item.from || item.date
      );

      const end = normalizeDateKey(
        item.end_date ||
          item.endDate ||
          item.to ||
          item.date ||
          item.start_date ||
          item.startDate ||
          item.from
      );

      return {
        start,
        end,
        reason: item.reason || "This date is blocked by admin.",
      };
    })
    .filter((item) => item.start && item.end);
}

function getBlockedDateConflict(location, dateValue) {
  if (!location || !dateValue) return null;

  const selectedDate = normalizeDateKey(dateValue);
  const blockedRanges = getBlockedRanges(location);

  const conflict = blockedRanges.find((blocked) => {
    return selectedDate >= blocked.start && selectedDate <= blocked.end;
  });

  if (!conflict) return null;

  return conflict.reason || "This date is blocked by admin.";
}

function countBookableDays(location, startDateValue, endDateValue) {
  const startDate = parseLocalDate(startDateValue);
  const endDate = parseLocalDate(endDateValue);

  // Inclusive calendar-day counting:
  // 09 Sep -> 09 Sep = 1 day
  // 04 Sep -> 05 Sep = 2 days
  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const dateKey = formatDateInput(cursor);
    const isBlocked = getBlockedDateConflict(location, dateKey);

    if (!isBlocked) {
      count += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function getSlotTime(slot) {
  return String(slot?.time || slot?.shuttle_time || slot?.label || "").trim();
}

function getSlotRemaining(slot) {
  if (slot?.remaining !== undefined && slot?.remaining !== null) {
    return Math.max(Number(slot.remaining || 0), 0);
  }

  const capacity = Number(slot?.capacity || 0);
  const bookedCount = Number(slot?.booked_count || 0);

  return Math.max(capacity - bookedCount, 0);
}

function getSlotId(slot) {
  return String(slot?._id || slot?.id || slot?.slot_id || getSlotTime(slot));
}

function normalizeAirportShuttleSlots(slots = []) {
  if (!Array.isArray(slots)) return [];

  return slots
    .map((slot) => {
      const time = getSlotTime(slot);
      const capacity = Number(slot.capacity || 0);
      const bookedCount = Number(slot.booked_count || 0);

      return {
        ...slot,
        _id: getSlotId(slot),
        type: slot.type || "airport",
        time,
        shuttle_time: time,
        capacity,
        booked_count: bookedCount,
        remaining:
          slot.remaining !== undefined && slot.remaining !== null
            ? Math.max(Number(slot.remaining || 0), 0)
            : Math.max(capacity - bookedCount, 0),
        is_active: slot.is_active !== false,
      };
    })
    .filter((slot) => slot.time && slot.is_active !== false);
}

function extractLocations(response) {
  const data = response?.data?.data || response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.locations)) return data.locations;
  if (Array.isArray(data?.location)) return data.location;
  if (Array.isArray(data?.data)) return data.data;

  if (data?.location && typeof data.location === "object") {
    return [data.location];
  }

  return [];
}

export default function AdminAirportCreateBookingModal({ onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);

  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState("");

  const [airportPriceRule, setAirportPriceRule] = useState(null);
  const [airportPriceLoading, setAirportPriceLoading] = useState(false);
  const [airportPriceError, setAirportPriceError] = useState("");

  const [shuttleSlots, setShuttleSlots] = useState([]);
  const [shuttleLoading, setShuttleLoading] = useState(false);
  const [shuttleError, setShuttleError] = useState("");
  const [showShuttleSlots, setShowShuttleSlots] = useState(false);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeDateField, setActiveDateField] = useState("entry");
  const [calendarMessage, setCalendarMessage] = useState("");

  const [saving, setSaving] = useState(false);

  const selectedLocation = useMemo(() => {
    return locations.find(
      (location) => String(location._id) === String(form.location_id)
    );
  }, [locations, form.location_id]);

  const blockedRanges = useMemo(() => {
    return getBlockedRanges(selectedLocation);
  }, [selectedLocation]);

  const blockedDayModifiers = useMemo(() => {
    return blockedRanges
      .map((range) => {
        const from = parseLocalDate(range.start);
        const to = parseLocalDate(range.end);

        if (!from || !to) return null;

        return { from, to };
      })
      .filter(Boolean);
  }, [blockedRanges]);

  const entryDateObject = useMemo(() => {
    return parseLocalDate(form.start_date);
  }, [form.start_date]);

  const exitDateObject = useMemo(() => {
    return parseLocalDate(form.end_date);
  }, [form.end_date]);

  const selectedCalendarDate =
    activeDateField === "entry" ? entryDateObject : exitDateObject;

  const minimumExitDate = useMemo(() => {
    if (!entryDateObject) return null;

    // Same-day Airport booking is allowed.
    return entryDateObject;
  }, [entryDateObject]);

  const blockedDateConflict = useMemo(() => {
    const entryBlocked = getBlockedDateConflict(
      selectedLocation,
      form.start_date
    );

    if (entryBlocked) {
      return `Entry date is blocked by admin. ${entryBlocked}`;
    }

    const exitBlocked = getBlockedDateConflict(selectedLocation, form.end_date);

    if (exitBlocked) {
      return `Exit date is blocked by admin. ${exitBlocked}`;
    }

    return null;
  }, [selectedLocation, form.start_date, form.end_date]);

  const estimatedDays = useMemo(() => {
    return countBookableDays(selectedLocation, form.start_date, form.end_date);
  }, [selectedLocation, form.start_date, form.end_date]);

  const activeShuttleSlots = useMemo(() => {
    return shuttleSlots.filter(
      (slot) => slot && slot.type === "airport" && slot.is_active !== false
    );
  }, [shuttleSlots]);

  const hasAirportShuttleOptions =
    Boolean(selectedLocation?.show_shuttle_options) &&
    activeShuttleSlots.length > 0;

  const originalPrice = Number(airportPriceRule?.price || 0);
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
  }, []);

  useEffect(() => {
    loadAirportPriceRule();
  }, [selectedLocation, estimatedDays]);

  useEffect(() => {
    setShuttleSlots([]);
    setShuttleError("");
    setShowShuttleSlots(false);

    setForm((prev) => ({
      ...prev,
      shuttle_slot_id: "",
      shuttle_time: "",
    }));
  }, [form.location_id, form.start_date]);

  useEffect(() => {
    if (!selectedLocation?.show_shuttle_options) {
      setShuttleSlots([]);
      setShuttleError("");
      setShowShuttleSlots(false);

      setForm((prev) => ({
        ...prev,
        pax: 1,
        shuttle_slot_id: "",
        shuttle_time: "",
      }));
    }
  }, [selectedLocation]);

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
          type: "airport",
          limit: 200,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load airport locations."
        );
      }

      const finalLocations = extractLocations(res).filter((location) => {
        return location?.type === "airport" || !location?.type;
      });

      setLocations(finalLocations);
    } catch (error) {
      setLocations([]);
      setLocationsError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to load airport locations."
      );
    } finally {
      setLocationsLoading(false);
    }
  }

  async function loadAirportPriceRule() {
    try {
      setAirportPriceRule(null);
      setAirportPriceError("");

      if (!selectedLocation || !estimatedDays || estimatedDays < 1) {
        return;
      }

      setAirportPriceLoading(true);

      const res = await axios.get("/settings/price-rules", {
        params: {
          type: "airport",
          days: estimatedDays,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load airport price."
        );
      }

      const matchedRule =
        res.data.data?.matched_price_rule ||
        res.data.data?.price_rules?.[0] ||
        null;

      if (!matchedRule) {
        throw new Error(
          `No airport price rule found for ${estimatedDays} day(s). Please add it from Settings.`
        );
      }

      setAirportPriceRule(matchedRule);
    } catch (error) {
      setAirportPriceRule(null);
      setAirportPriceError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Airport price could not be loaded."
      );
    } finally {
      setAirportPriceLoading(false);
    }
  }

  async function loadAvailableShuttleSlots() {
    try {
      setShuttleSlots([]);
      setShuttleError("");
      setShowShuttleSlots(false);

      if (!selectedLocation) {
        alert("Please select airport location first.");
        return;
      }

      if (!selectedLocation.show_shuttle_options) {
        alert("This airport does not have shuttle options enabled.");
        return;
      }

      if (!form.start_date) {
        alert("Please select entry date first.");
        return;
      }

      const passengerCount = Number(form.pax || 0);

      if (!Number.isFinite(passengerCount) || passengerCount < 1) {
        alert("Please enter passengers at least 1.");
        return;
      }

      setShuttleLoading(true);

  const res = await axios.get("/airport-shuttle-availability", {
  params: {
    location_id: selectedLocation._id,
    date: form.start_date,
  },
});

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load airport shuttle slots."
        );
      }

      const rawSlots =
        res.data.data?.available_shuttle_slots ||
        res.data.data?.shuttle_time_slots ||
        [];

      const slots = normalizeAirportShuttleSlots(rawSlots);

      setShuttleSlots(slots);
      setShowShuttleSlots(true);

      if (slots.length === 0) {
        setShuttleError(
          "No airport shuttle slots are available for this airport and entry date."
        );
      }
    } catch (error) {
      setShuttleSlots([]);
      setShuttleError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Airport shuttle slots could not be loaded."
      );
    } finally {
      setShuttleLoading(false);
    }
  }

  function clearAirportDateAndPaymentState(next) {
    next.payment_type = "";
    next.payment_method = "";
    next.transaction_reference = "";
  }

  function clearShuttleSelection(next) {
    next.shuttle_slot_id = "";
    next.shuttle_time = "";
    setShuttleSlots([]);
    setShuttleError("");
    setShowShuttleSlots(false);
  }

  function updateField(name, value) {
    setForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "location_id") {
        next.start_date = "";
        next.end_date = "";
        next.pax = 1;
        clearShuttleSelection(next);
        clearAirportDateAndPaymentState(next);

        setAirportPriceRule(null);
        setAirportPriceError("");
        setCalendarOpen(false);
        setCalendarMessage("");
      }

      if (name === "payment_type") {
        next.payment_method = "";
        next.transaction_reference = "";
      }

      if (name === "start_date") {
        if (next.end_date && next.end_date < value) {
          next.end_date = value;
        }

        clearShuttleSelection(next);
        clearAirportDateAndPaymentState(next);
      }

      if (name === "end_date") {
        clearAirportDateAndPaymentState(next);
      }

      if (name === "pax") {
        const passengerCount = Number(value || 0);

        if (passengerCount < 1) {
          next.shuttle_slot_id = "";
          next.shuttle_time = "";
          setShowShuttleSlots(false);
        }

        if (
          passengerCount >= 1 &&
          prev.shuttle_slot_id &&
          activeShuttleSlots.length > 0
        ) {
          const selectedSlot = activeShuttleSlots.find(
            (slot) => getSlotId(slot) === String(prev.shuttle_slot_id)
          );

          if (selectedSlot) {
            const remaining = getSlotRemaining(selectedSlot);

            if (remaining < passengerCount) {
              next.shuttle_slot_id = "";
              next.shuttle_time = "";
            }
          }
        }
      }

      return next;
    });
  }

  function openDatePopup(field) {
    if (!selectedLocation) {
      alert("Please select airport location first.");
      return;
    }

    if (field === "exit" && !form.start_date) {
      alert("Please select entry date first.");
      return;
    }

    setActiveDateField(field);
    setCalendarOpen(true);
    setCalendarMessage("");
  }

  function handlePopupDateSelect(day) {
    if (!day) return;

    if (!selectedLocation) {
      setCalendarMessage("Please select airport location first.");
      return;
    }

    const selectedDate = formatDateInput(day);

    const singleBlockedMessage = getBlockedDateConflict(
      selectedLocation,
      selectedDate
    );

    if (singleBlockedMessage) {
      setCalendarMessage(singleBlockedMessage);
      return;
    }

    if (activeDateField === "entry") {
      setForm((prev) => {
        const selectedEntryDate = parseLocalDate(selectedDate);
        const oldExitDate = parseLocalDate(prev.end_date);

        let nextEndDate = prev.end_date;

        if (
          !oldExitDate ||
          oldExitDate < selectedEntryDate ||
          getBlockedDateConflict(selectedLocation, prev.end_date)
        ) {
          nextEndDate = "";
        }

        return {
          ...prev,
          start_date: selectedDate,
          end_date: nextEndDate,
          shuttle_slot_id: "",
          shuttle_time: "",
          payment_type: "",
          payment_method: "",
          transaction_reference: "",
        };
      });

      setShuttleSlots([]);
      setShuttleError("");
      setShowShuttleSlots(false);
      setActiveDateField("exit");
      setCalendarMessage("Entry date selected. Now select exit date.");
      return;
    }

    if (activeDateField === "exit") {
      if (!form.start_date) {
        setCalendarMessage("Please select entry date first.");
        return;
      }

      const startDate = parseLocalDate(form.start_date);
      const exitDate = parseLocalDate(selectedDate);

      if (!startDate || !exitDate) {
        setCalendarMessage("Invalid date format.");
        return;
      }

      if (exitDate < startDate) {
        setCalendarMessage("Exit date cannot be before entry date.");
        return;
      }

      setForm((prev) => ({
        ...prev,
        end_date: selectedDate,
        payment_type: "",
        payment_method: "",
        transaction_reference: "",
      }));

      setCalendarOpen(false);
      setCalendarMessage("");
    }
  }

  function handleShuttleSlotChange(slotId) {
    const selectedSlotId = String(slotId || "");

    const slot = activeShuttleSlots.find(
      (item) => getSlotId(item) === selectedSlotId
    );

    setForm((prev) => ({
      ...prev,
      shuttle_slot_id: selectedSlotId,
      shuttle_time: getSlotTime(slot),
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setAirportPriceRule(null);
    setAirportPriceError("");
    setShuttleSlots([]);
    setShuttleError("");
    setShowShuttleSlots(false);
    setCalendarOpen(false);
    setCalendarMessage("");
    setActiveDateField("entry");
  }

  function validateForm() {
    if (!form.location_id) {
      throw new Error("Airport parking location is required.");
    }

    if (!form.start_date) {
      throw new Error("Entry date is required.");
    }

    if (!form.end_date) {
      throw new Error("Exit date is required.");
    }

    const startDate = parseLocalDate(form.start_date);
    const endDate = parseLocalDate(form.end_date);

    if (!startDate || !endDate) {
      throw new Error("Invalid date format.");
    }

    if (endDate < startDate) {
      throw new Error("Exit date cannot be before entry date.");
    }

    if (blockedDateConflict) {
      throw new Error(blockedDateConflict);
    }

    if (estimatedDays < 1) {
      throw new Error(
        "Selected date range does not include any available booking days."
      );
    }

    if (airportPriceLoading) {
      throw new Error("Please wait while airport price is loading.");
    }

    if (!airportPriceRule || totalPrice <= 0) {
      throw new Error(
        airportPriceError ||
          `No airport price rule found for ${estimatedDays} day(s). Please add it from Settings.`
      );
    }

    if (selectedLocation?.show_shuttle_options) {
      if (shuttleLoading) {
        throw new Error("Please wait while shuttle slots are loading.");
      }

      if (!hasAirportShuttleOptions) {
        throw new Error(
          shuttleError ||
            "Please load and select an available shuttle slot."
        );
      }

      if (!form.pax || Number(form.pax) < 1) {
        throw new Error("Please enter passengers at least 1 for shuttle.");
      }

      if (!form.shuttle_time || !form.shuttle_slot_id) {
        throw new Error("Please load and select an available shuttle slot.");
      }

      const selectedSlot = activeShuttleSlots.find(
        (slot) => getSlotId(slot) === String(form.shuttle_slot_id)
      );

      if (!selectedSlot) {
        throw new Error("Selected shuttle slot was not found. Please load again.");
      }

      const remaining = getSlotRemaining(selectedSlot);

      if (remaining < Number(form.pax || 0)) {
        throw new Error(
          `Selected shuttle slot has only ${remaining} remaining seat(s).`
        );
      }
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

    if (!form.license_plate.trim()) {
      throw new Error("License plate is required.");
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

      const paymentFlow =
        form.payment_type === "online" ? "full_online" : "poa_deposit";

      const depositType = form.payment_type === "online" ? "full" : "poa";

      const hasShuttle = Boolean(
        selectedLocation?.show_shuttle_options &&
          form.shuttle_slot_id &&
          form.shuttle_time
      );

      const payload = {
        type: "airport",

        location_id: form.location_id,

        start_date: form.start_date,
        end_date: form.end_date,

        shuttle_slot_id: hasShuttle ? form.shuttle_slot_id : undefined,
        shuttle_time: hasShuttle ? form.shuttle_time : undefined,
        pax: hasShuttle ? Number(form.pax || 1) : 0,

        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        name: `${form.first_name} ${form.last_name}`.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),

        license_plate: form.license_plate.trim(),
        interlock: Boolean(form.interlock),

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
        manual_payment_reference:
          form.transaction_reference.trim() || undefined,

        price_rule_id: airportPriceRule?._id,
        calculated_days: estimatedDays,

        send_confirmation_email: Boolean(form.send_confirmation_email),
        resend_confirmation_email: Boolean(form.send_confirmation_email),

        admin_create: true,
      };

      const res = await axios.post("/admin/bookings/airport", payload, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to create admin airport booking."
        );
      }

      alert(res.data.message || "Airport booking created successfully.");

      if (onCreated) {
        await onCreated(res.data.data);
      }
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to create airport booking."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">
              Create Airport Booking
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
              Airport Booking Details
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">
                  Airport Parking Location *
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
                      : "Select airport parking location"}
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
                  Entry Date *
                </label>

                <button
                  type="button"
                  onClick={() => openDatePopup("entry")}
                  disabled={!form.location_id}
                  className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-left text-sm outline-none disabled:bg-gray-100 ${
                    activeDateField === "entry" && calendarOpen
                      ? "border-blue-600 ring-2 ring-blue-100"
                      : "border-gray-300"
                  }`}
                >
                  {form.start_date
                    ? formatDate(form.start_date)
                    : "Select entry date"}
                </button>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Exit Date *
                </label>

                <button
                  type="button"
                  onClick={() => openDatePopup("exit")}
                  disabled={!form.start_date}
                  className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-left text-sm outline-none disabled:bg-gray-100 ${
                    activeDateField === "exit" && calendarOpen
                      ? "border-blue-600 ring-2 ring-blue-100"
                      : "border-gray-300"
                  }`}
                >
                  {form.end_date
                    ? formatDate(form.end_date)
                    : "Select exit date"}
                </button>

                {form.start_date && (
                  <p className="mt-1 text-xs text-gray-500">
                    Same-day booking is allowed. Entry and exit dates are both counted.
                  </p>
                )}
              </div>

              {calendarOpen && (
                <div
                  className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 px-4"
                  onClick={() => {
                    setCalendarOpen(false);
                    setCalendarMessage("");
                  }}
                >
                  <div
                    className="w-[340px] max-w-full rounded-2xl border bg-white p-4 shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">
                        {activeDateField === "entry"
                          ? "Select Entry Date"
                          : "Select Exit Date"}
                      </h3>

                      <button
                        type="button"
                        onClick={() => {
                          setCalendarOpen(false);
                          setCalendarMessage("");
                        }}
                        className="rounded-lg border px-3 py-1 text-sm font-semibold"
                      >
                        Close
                      </button>
                    </div>

                    <DayPicker
                      mode="single"
                      selected={selectedCalendarDate || undefined}
                      onDayClick={handlePopupDateSelect}
                      disabled={
                        activeDateField === "exit" && minimumExitDate
                          ? [{ before: minimumExitDate }, ...blockedDayModifiers]
                          : blockedDayModifiers
                      }
                      modifiers={{
                        blocked: blockedDayModifiers,
                      }}
                      modifiersClassNames={{
                        blocked: "admin-airport-blocked-day",
                      }}
                      modifiersStyles={{
                        blocked: {
                          textDecoration: "line-through",
                          opacity: 0.45,
                        },
                      }}
                      className="admin-airport-date-picker"
                    />

                    {calendarMessage && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {calendarMessage}
                      </div>
                    )}

                    {blockedRanges.length > 0 && (
                      <p className="mt-3 text-xs text-gray-500">
                        Blocked dates are disabled by admin and cannot be
                        selected as Entry or Exit date.
                      </p>
                    )}

                    {blockedRanges.length === 0 && (
                      <p className="mt-3 text-xs text-gray-500">
                        No blocked dates are configured for this airport.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  License Plate *
                </label>

                <input
                  value={form.license_plate}
                  onChange={(event) =>
                    updateField("license_plate", event.target.value)
                  }
                  placeholder="Enter license plate"
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm uppercase outline-none focus:border-blue-600"
                  required
                />
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
              <p>
                <strong>Charged Days:</strong> {estimatedDays || "-"}
              </p>

              {blockedDateConflict && (
                <p className="mt-2 text-red-700">{blockedDateConflict}</p>
              )}

              {airportPriceLoading && (
                <p className="mt-2 text-blue-700">Loading airport price...</p>
              )}

              {airportPriceError && (
                <p className="mt-2 text-red-700">{airportPriceError}</p>
              )}

              {airportPriceRule && (
                <p className="mt-2 text-green-700">
                  Price rule: <strong>{airportPriceRule.label}</strong> —{" "}
                  <strong>{money(airportPriceRule.price)}</strong>
                </p>
              )}
            </div>
          </section>

          {selectedLocation?.show_shuttle_options && (
            <section className="rounded-3xl border border-gray-200 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-950">
                    Shuttle Slot
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    This airport has shuttle options enabled. Select entry date
                    first, then load real availability.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadAvailableShuttleSlots}
                  disabled={shuttleLoading}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {shuttleLoading
                    ? "Loading..."
                    : "Load Available Shuttle Slots"}
                </button>
              </div>

              <div className="mt-4">
                <label className="text-sm font-semibold text-gray-700">
                  Passengers *
                </label>

                <input
                  type="number"
                  min="1"
                  value={form.pax}
                  onChange={(event) => updateField("pax", event.target.value)}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                />
              </div>

              {shuttleError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {shuttleError}
                </div>
              )}

              {showShuttleSlots && activeShuttleSlots.length > 0 && (
                <div className="mt-4">
                  <label className="text-sm font-semibold text-gray-700">
                    Available Shuttle Slot *
                  </label>

                  <select
                    value={form.shuttle_slot_id}
                    onChange={(event) =>
                      handleShuttleSlotChange(event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  >
                    <option value="">Select shuttle slot</option>

                    {activeShuttleSlots.map((slot) => {
                      const slotId = getSlotId(slot);
                      const remaining = getSlotRemaining(slot);
                      const disabled = remaining < Number(form.pax || 1);

                      return (
                        <option key={slotId} value={slotId} disabled={disabled}>
                          {getSlotTime(slot)} — remaining {remaining}
                          {disabled ? " (not enough capacity)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {form.shuttle_time && (
                <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  Selected shuttle: <strong>{form.shuttle_time}</strong>
                </div>
              )}
            </section>
          )}

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

              <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold text-gray-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.interlock}
                  onChange={(event) =>
                    updateField("interlock", event.target.checked)
                  }
                />
                Interlock fitted vehicle
              </label>

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
                  <span>Charged Days</span>
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
              disabled={saving}
              className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Creating Booking..." : "Create Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}