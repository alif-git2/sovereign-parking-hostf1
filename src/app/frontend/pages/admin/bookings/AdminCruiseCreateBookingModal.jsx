"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "@/app/frontend/utils/axios";

const HOLDING_DEPOSIT_AMOUNT = 20;
const INCLUDED_SHUTTLE_PASSENGERS = 4;
const EXTRA_PASSENGER_FEE = 5;
const ADD_ON_VEHICLE_DISCOUNT_PERCENT = 10;

const addOnVehicleOptions = [
  { value: "", label: "Select add-on vehicle" },
  { value: "SUV", label: "SUV" },
  { value: "Van", label: "Van" },
  { value: "Truck", label: "Truck" },
  { value: "Ute", label: "Ute" },
  { value: "Trailer", label: "Trailer" },
  { value: "Other", label: "Other" },
];

const shuttleDirections = {
  carParkToTerminal: {
    label: "Car park to terminal",
    passengerField: "car_park_to_terminal_passengers",
    slotIdField: "car_park_to_terminal_shuttle_slot_id",
    timeField: "car_park_to_terminal_shuttle_time",
    showField: "show_car_park_to_terminal",
  },
  terminalToCarPark: {
    label: "Terminal to car park",
    passengerField: "terminal_to_car_park_passengers",
    slotIdField: "terminal_to_car_park_shuttle_slot_id",
    timeField: "terminal_to_car_park_shuttle_time",
    showField: "show_terminal_to_car_park",
  },
};

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
  schedule_id: "",
  ship_name: "",
  start_date: "",
  end_date: "",

  car_park_to_terminal_passengers: 1,
  car_park_to_terminal_shuttle_slot_id: "",
  car_park_to_terminal_shuttle_time: "",

  terminal_to_car_park_passengers: 1,
  terminal_to_car_park_shuttle_slot_id: "",
  terminal_to_car_park_shuttle_time: "",

  parking_slot: "",

  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  license_plate: "",

  add_on_vehicle_enabled: false,
  add_on_vehicle_type: "",
  add_on_vehicle_license_plate: "",

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

function parseDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate()
  );
}

function calculateCruiseDays(startDateValue, endDateValue) {
  const departureDate = parseDateOnly(startDateValue);
  const arrivalDate = parseDateOnly(endDateValue);

  if (!departureDate || !arrivalDate || arrivalDate <= departureDate) {
    return 0;
  }

  const diffMs = arrivalDate.getTime() - departureDate.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return days > 0 ? days : 0;
}

function normalizeCount(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
}

function getPassengerExtraCount(passengers) {
  return Math.max(
    normalizeCount(passengers) - INCLUDED_SHUTTLE_PASSENGERS,
    0
  );
}

function getSlotId(slot) {
  return String(slot?._id || slot?.id || slot?.slot_id || slot?.time || "");
}

function getSlotTime(slot) {
  return String(slot?.time || slot?.shuttle_time || "").trim();
}

function getSlotRemaining(slot) {
  if (slot?.remaining !== undefined && slot?.remaining !== null) {
    return Math.max(Number(slot.remaining || 0), 0);
  }

  const capacity = Number(slot?.capacity || 0);
  const bookedCount = Number(slot?.booked_count || 0);

  return Math.max(capacity - bookedCount, 0);
}

function getDirectionRemaining(slot, directionKey) {
  if (directionKey === "carParkToTerminal") {
    if (
      slot?.car_park_to_terminal_remaining !== undefined &&
      slot.car_park_to_terminal_remaining !== null
    ) {
      return Math.max(Number(slot.car_park_to_terminal_remaining || 0), 0);
    }
  }

  if (directionKey === "terminalToCarPark") {
    if (
      slot?.terminal_to_car_park_remaining !== undefined &&
      slot.terminal_to_car_park_remaining !== null
    ) {
      return Math.max(Number(slot.terminal_to_car_park_remaining || 0), 0);
    }
  }

  return getSlotRemaining(slot);
}

function getDirectionBookedCount(slot, directionKey) {
  if (directionKey === "carParkToTerminal") {
    return normalizeCount(slot?.car_park_to_terminal_booked_count);
  }

  if (directionKey === "terminalToCarPark") {
    return normalizeCount(slot?.terminal_to_car_park_booked_count);
  }

  return normalizeCount(slot?.booked_count);
}

function normalizeCruiseShuttleSlot(slot) {
  const time = getSlotTime(slot);
  const capacity = Number(slot?.capacity || 0);

  return {
    ...slot,
    _id: getSlotId(slot),
    type: "cruise",
    time,
    shuttle_time: time,
    capacity,
    booked_count: normalizeCount(slot?.booked_count),
    remaining:
      slot?.remaining !== undefined && slot.remaining !== null
        ? normalizeCount(slot.remaining)
        : Math.max(capacity - normalizeCount(slot?.booked_count), 0),

    show_car_park_to_terminal: slot?.show_car_park_to_terminal !== false,
    show_terminal_to_car_park: slot?.show_terminal_to_car_park !== false,

    car_park_to_terminal_booked_count: normalizeCount(
      slot?.car_park_to_terminal_booked_count
    ),
    car_park_to_terminal_remaining:
      slot?.car_park_to_terminal_remaining !== undefined &&
      slot.car_park_to_terminal_remaining !== null
        ? normalizeCount(slot.car_park_to_terminal_remaining)
        : capacity,

    terminal_to_car_park_booked_count: normalizeCount(
      slot?.terminal_to_car_park_booked_count
    ),
    terminal_to_car_park_remaining:
      slot?.terminal_to_car_park_remaining !== undefined &&
      slot.terminal_to_car_park_remaining !== null
        ? normalizeCount(slot.terminal_to_car_park_remaining)
        : capacity,

    is_active: slot?.is_active !== false,
  };
}

function getScheduleTitle(schedule) {
  return (
    schedule?.ship_name ||
    schedule?.schedule_name ||
    schedule?.name ||
    "Unnamed Cruise"
  );
}

function getLocationName(schedule) {
  const location = schedule?.location_id;

  if (!location) return "-";
  if (typeof location === "string") return location;

  return location.name || "-";
}

function extractSchedules(response) {
  const data = response?.data?.data;

  if (Array.isArray(data)) return data;

  return data?.schedules || data?.cruise_schedules || [];
}

export default function AdminCruiseCreateBookingModal({ onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);

  const [schedules, setSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [schedulesError, setSchedulesError] = useState("");

  const [priceRule, setPriceRule] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState("");

  const [shuttleSlots, setShuttleSlots] = useState([]);
  const [shuttleLoading, setShuttleLoading] = useState(false);
  const [shuttleError, setShuttleError] = useState("");
  const [showShuttleSlots, setShowShuttleSlots] = useState({
    carParkToTerminal: false,
    terminalToCarPark: false,
  });

  const [saving, setSaving] = useState(false);

  const selectedSchedule = useMemo(() => {
    return schedules.find(
      (schedule) => String(schedule._id) === String(form.schedule_id)
    );
  }, [schedules, form.schedule_id]);

  const cruiseDays = useMemo(() => {
    return calculateCruiseDays(form.start_date, form.end_date);
  }, [form.start_date, form.end_date]);

  const activeShuttleSlots = useMemo(() => {
    return shuttleSlots.filter(
      (slot) => slot && slot.type === "cruise" && slot.is_active !== false
    );
  }, [shuttleSlots]);

  const carParkToTerminalShuttleSlots = useMemo(() => {
    return activeShuttleSlots.filter(
      (slot) => slot.show_car_park_to_terminal !== false
    );
  }, [activeShuttleSlots]);

  const terminalToCarParkShuttleSlots = useMemo(() => {
    return activeShuttleSlots.filter(
      (slot) => slot.show_terminal_to_car_park !== false
    );
  }, [activeShuttleSlots]);

  const carParkToTerminalPassengerCount = Number(
    form.car_park_to_terminal_passengers || 0
  );

  const terminalToCarParkPassengerCount = Number(
    form.terminal_to_car_park_passengers || 0
  );

  const carParkToTerminalExtraPassengerCount = getPassengerExtraCount(
    carParkToTerminalPassengerCount
  );

  const terminalToCarParkExtraPassengerCount = getPassengerExtraCount(
    terminalToCarParkPassengerCount
  );

  const extraPassengerCount =
    carParkToTerminalExtraPassengerCount + terminalToCarParkExtraPassengerCount;

  const extraPassengerFee = extraPassengerCount * EXTRA_PASSENGER_FEE;

  const originalPrice = Number(priceRule?.price || 0);
  const addOnVehicleOriginalPrice = form.add_on_vehicle_enabled
    ? originalPrice
    : 0;
  const addOnVehicleDiscountAmount = form.add_on_vehicle_enabled
    ? Number(
        (
          (addOnVehicleOriginalPrice * ADD_ON_VEHICLE_DISCOUNT_PERCENT) /
          100
        ).toFixed(2)
      )
    : 0;
  const addOnVehiclePrice = form.add_on_vehicle_enabled
    ? Number((addOnVehicleOriginalPrice - addOnVehicleDiscountAmount).toFixed(2))
    : 0;
  const totalPrice = originalPrice + extraPassengerFee + addOnVehiclePrice;
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
    loadSchedules();
  }, []);

  useEffect(() => {
    loadPriceRule();
  }, [cruiseDays]);

  function getAuthHeaders() {
    const token = getAdminToken();

    return token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {};
  }

  function getDirectionShuttleSlots(directionKey) {
    if (directionKey === "carParkToTerminal") {
      return carParkToTerminalShuttleSlots;
    }

    if (directionKey === "terminalToCarPark") {
      return terminalToCarParkShuttleSlots;
    }

    return [];
  }

  async function loadSchedules() {
    try {
      setSchedulesLoading(true);
      setSchedulesError("");

      const res = await axios.get("/admin/cruise-schedules", {
        headers: getAuthHeaders(),
        params: {
          limit: 200,
          is_active: true,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load cruise schedules."
        );
      }

      setSchedules(extractSchedules(res));
    } catch (error) {
      setSchedules([]);
      setSchedulesError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to load cruise schedules."
      );
    } finally {
      setSchedulesLoading(false);
    }
  }

  async function loadPriceRule() {
    try {
      setPriceRule(null);
      setPriceError("");

      if (!cruiseDays || cruiseDays < 1) {
        return;
      }

      setPriceLoading(true);

      const res = await axios.get("/settings/price-rules", {
        params: {
          type: "cruise",
          days: cruiseDays,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to load cruise price."
        );
      }

      const matchedRule =
        res.data.data?.matched_price_rule ||
        res.data.data?.price_rules?.[0] ||
        null;

      if (!matchedRule) {
        throw new Error(
          `No cruise price rule found for ${cruiseDays} day(s). Please add it from Settings.`
        );
      }

      setPriceRule(matchedRule);
    } catch (error) {
      setPriceRule(null);
      setPriceError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Cruise price could not be loaded."
      );
    } finally {
      setPriceLoading(false);
    }
  }

  async function loadAvailableShuttleSlots(directionKey) {
    try {
      const direction = shuttleDirections[directionKey];

      setShuttleError("");

      if (!form.schedule_id) {
        alert("Please select a cruise schedule first.");
        return;
      }

      const passengerCount = Number(form[direction.passengerField] || 0);

      if (!Number.isFinite(passengerCount) || passengerCount < 1) {
        alert(`Please enter ${direction.label} passengers at least 1.`);
        return;
      }

      setShuttleLoading(true);

      const res = await axios.get("/settings/shuttle-time-slots", {
        params: {
          type: "cruise",
          schedule_id: form.schedule_id,
          departure_date: form.start_date,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load cruise shuttle slots."
        );
      }

      const slots =
        res.data.data?.available_shuttle_slots ||
        res.data.data?.shuttle_time_slots ||
        [];

      const normalizedSlots = slots
        .map(normalizeCruiseShuttleSlot)
        .filter((slot) => slot.time && slot.is_active !== false);

      if (normalizedSlots.length === 0) {
        throw new Error(
          "No cruise shuttle slots are configured in Settings → Shuttle Time Slots."
        );
      }

      setShuttleSlots(normalizedSlots);

      const directionSlots = normalizedSlots.filter(
        (slot) => slot[direction.showField] !== false
      );

      if (directionSlots.length === 0) {
        throw new Error(`No ${direction.label} shuttle slots are enabled.`);
      }

      setShowShuttleSlots((prev) => ({
        ...prev,
        [directionKey]: true,
      }));
    } catch (error) {
      setShuttleError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Cruise shuttle slots could not be loaded."
      );
    } finally {
      setShuttleLoading(false);
    }
  }

  function updateField(name, value) {
    setForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "payment_type") {
        next.payment_method = "";
        next.transaction_reference = "";
      }

      if (name === "add_on_vehicle_enabled" && !value) {
        next.add_on_vehicle_type = "";
        next.add_on_vehicle_license_plate = "";
      }

      if (name === "add_on_vehicle_type") {
        next.add_on_vehicle_license_plate = "";
      }

      return next;
    });
  }

  function handleDirectionPassengerChange(directionKey, value) {
    const direction = shuttleDirections[directionKey];
    const passengerCount = Number(value || 0);
    const directionSlots = getDirectionShuttleSlots(directionKey);

    setForm((prev) => {
      let shouldClearShuttle = passengerCount < 1;

      if (
        passengerCount >= 1 &&
        prev[direction.slotIdField] &&
        directionSlots.length > 0
      ) {
        const selectedSlot = directionSlots.find(
          (slot) =>
            String(getSlotId(slot)) === String(prev[direction.slotIdField])
        );

        if (selectedSlot) {
          const remaining = getDirectionRemaining(selectedSlot, directionKey);

          if (remaining < passengerCount) {
            shouldClearShuttle = true;
          }
        } else {
          shouldClearShuttle = true;
        }
      }

      return {
        ...prev,
        [direction.passengerField]: value,
        [direction.slotIdField]: shouldClearShuttle
          ? ""
          : prev[direction.slotIdField],
        [direction.timeField]: shouldClearShuttle
          ? ""
          : prev[direction.timeField],
      };
    });

    if (passengerCount < 1) {
      setShowShuttleSlots((prev) => ({
        ...prev,
        [directionKey]: false,
      }));
    }
  }

  function handleScheduleChange(scheduleId) {
    const schedule = schedules.find(
      (item) => String(item._id) === String(scheduleId)
    );

    setPriceRule(null);
    setPriceError("");
    setShuttleSlots([]);
    setShuttleError("");
    setShowShuttleSlots({
      carParkToTerminal: false,
      terminalToCarPark: false,
    });

    setForm((prev) => ({
      ...prev,
      schedule_id: scheduleId,
      ship_name: schedule ? getScheduleTitle(schedule) : "",
      start_date: schedule ? toDateInputValue(schedule.departure_date) : "",
      end_date: schedule ? toDateInputValue(schedule.return_date) : "",

      car_park_to_terminal_passengers: 1,
      car_park_to_terminal_shuttle_slot_id: "",
      car_park_to_terminal_shuttle_time: "",

      terminal_to_car_park_passengers: 1,
      terminal_to_car_park_shuttle_slot_id: "",
      terminal_to_car_park_shuttle_time: "",
    }));
  }

  function handleDirectionShuttleSlotChange(directionKey, slotId) {
    const direction = shuttleDirections[directionKey];
    const directionSlots = getDirectionShuttleSlots(directionKey);

    const slot = directionSlots.find(
      (item) => String(getSlotId(item)) === String(slotId)
    );

    setForm((prev) => ({
      ...prev,
      [direction.slotIdField]: slotId,
      [direction.timeField]: getSlotTime(slot),
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setPriceRule(null);
    setPriceError("");
    setShuttleSlots([]);
    setShuttleError("");
    setShowShuttleSlots({
      carParkToTerminal: false,
      terminalToCarPark: false,
    });
  }

  function validateDirectionSelection(directionKey) {
    const direction = shuttleDirections[directionKey];
    const directionSlots = getDirectionShuttleSlots(directionKey);

    const passengerCount = Number(form[direction.passengerField] || 0);
    const selectedSlotId = form[direction.slotIdField];
    const selectedTime = form[direction.timeField];

    if (!Number.isFinite(passengerCount) || passengerCount < 1) {
      throw new Error(`Please enter ${direction.label} passengers at least 1.`);
    }

    if (directionSlots.length === 0) {
      throw new Error(`No ${direction.label} shuttle slots are available.`);
    }

    if (!selectedSlotId || !selectedTime) {
      throw new Error(`Please select ${direction.label} shuttle option.`);
    }

    const selectedSlot = directionSlots.find(
      (slot) => String(getSlotId(slot)) === String(selectedSlotId)
    );

    if (!selectedSlot) {
      throw new Error(
        `${direction.label} shuttle slot was not found. Please load again.`
      );
    }

    const remaining = getDirectionRemaining(selectedSlot, directionKey);

    if (remaining < passengerCount) {
      throw new Error(
        `${direction.label} shuttle option has only ${remaining} remaining seat(s).`
      );
    }
  }

  function validateForm() {
    if (!form.schedule_id) {
      throw new Error("Cruise schedule is required.");
    }

    if (!form.start_date) {
      throw new Error("Ship departure date is required.");
    }

    if (!form.end_date) {
      throw new Error("Ship arrival date is required.");
    }

    if (cruiseDays < 1) {
      throw new Error("Ship arrival date must be after ship departure date.");
    }

    if (priceLoading) {
      throw new Error("Please wait while cruise price is loading.");
    }

    if (!priceRule || totalPrice <= 0) {
      throw new Error(
        priceError ||
          `No cruise price rule found for ${cruiseDays} day(s). Please add it from Settings.`
      );
    }

    validateDirectionSelection("carParkToTerminal");
    validateDirectionSelection("terminalToCarPark");

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

    if (form.add_on_vehicle_enabled) {
      if (!form.add_on_vehicle_type) {
        throw new Error("Please select add-on vehicle.");
      }

      if (!form.add_on_vehicle_license_plate.trim()) {
        throw new Error(`${form.add_on_vehicle_type} License Plate is required.`);
      }
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

      const maxDirectionPassengers = Math.max(
        carParkToTerminalPassengerCount,
        terminalToCarParkPassengerCount
      );

      const paymentFlow =
        form.payment_type === "online" ? "full_online" : "poa_deposit";

      const depositType = form.payment_type === "online" ? "full" : "poa";

      const payload = {
        type: "cruise",

        schedule_id: form.schedule_id,
        ship_name: form.ship_name || getScheduleTitle(selectedSchedule),

        start_date: form.start_date,
        end_date: form.end_date,

        shuttle_slot_id: form.car_park_to_terminal_shuttle_slot_id,
        shuttle_time: form.car_park_to_terminal_shuttle_time,

        pax: maxDirectionPassengers,
        pickup_pax: maxDirectionPassengers,
        pickup_pax_pro: maxDirectionPassengers,

        car_park_to_terminal_passengers: carParkToTerminalPassengerCount,
        car_park_to_terminal_shuttle_slot_id:
          form.car_park_to_terminal_shuttle_slot_id,
        car_park_to_terminal_shuttle_time:
          form.car_park_to_terminal_shuttle_time,

        terminal_to_car_park_passengers: terminalToCarParkPassengerCount,
        terminal_to_car_park_shuttle_slot_id:
          form.terminal_to_car_park_shuttle_slot_id,
        terminal_to_car_park_shuttle_time:
          form.terminal_to_car_park_shuttle_time,

        extra_passenger_count: extraPassengerCount,
        extra_passenger_fee: extraPassengerFee,
        parking_price: originalPrice,
        add_on_vehicle_original_price: addOnVehicleOriginalPrice,
        add_on_vehicle_discount_percent: form.add_on_vehicle_enabled
          ? ADD_ON_VEHICLE_DISCOUNT_PERCENT
          : 0,
        add_on_vehicle_discount_amount: addOnVehicleDiscountAmount,
        add_on_vehicle_price: addOnVehiclePrice,
        total_before_discount: totalPrice,

        details: {
          pricing: {
            price_rule_id: priceRule?._id,
            calculated_days: cruiseDays,
            parking_price: originalPrice,
            included_shuttle_passengers: INCLUDED_SHUTTLE_PASSENGERS,
            extra_passenger_unit_fee: EXTRA_PASSENGER_FEE,
            extra_passenger_count: extraPassengerCount,
            extra_passenger_fee: extraPassengerFee,
            add_on_vehicle_original_price: addOnVehicleOriginalPrice,
            add_on_vehicle_discount_percent: form.add_on_vehicle_enabled
              ? ADD_ON_VEHICLE_DISCOUNT_PERCENT
              : 0,
            add_on_vehicle_discount_amount: addOnVehicleDiscountAmount,
            add_on_vehicle_price: addOnVehiclePrice,
            total_before_discount: totalPrice,
          },
          cruise: {
            car_park_to_terminal_passengers: carParkToTerminalPassengerCount,
            car_park_to_terminal_shuttle_slot_id:
              form.car_park_to_terminal_shuttle_slot_id,
            car_park_to_terminal_shuttle_time:
              form.car_park_to_terminal_shuttle_time,

            terminal_to_car_park_passengers: terminalToCarParkPassengerCount,
            terminal_to_car_park_shuttle_slot_id:
              form.terminal_to_car_park_shuttle_slot_id,
            terminal_to_car_park_shuttle_time:
              form.terminal_to_car_park_shuttle_time,

            extra_passenger_count: extraPassengerCount,
            extra_passenger_fee: extraPassengerFee,
            add_on_vehicle: {
              enabled: Boolean(form.add_on_vehicle_enabled),
              type: form.add_on_vehicle_enabled
                ? form.add_on_vehicle_type
                : "",
              license_plate: form.add_on_vehicle_enabled
                ? form.add_on_vehicle_license_plate.trim().toUpperCase()
                : "",
              discount_percent: form.add_on_vehicle_enabled
                ? ADD_ON_VEHICLE_DISCOUNT_PERCENT
                : 0,
              original_price: addOnVehicleOriginalPrice,
              discount_amount: addOnVehicleDiscountAmount,
              price: addOnVehiclePrice,
            },
          },
        },

        parking_slot: String(form.parking_slot || "").trim(),

        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),

        license_plate: form.license_plate.trim(),

        add_on_vehicle_enabled: Boolean(form.add_on_vehicle_enabled),
        add_on_vehicle_type: form.add_on_vehicle_enabled
          ? form.add_on_vehicle_type
          : "",
        add_on_vehicle_license_plate: form.add_on_vehicle_enabled
          ? form.add_on_vehicle_license_plate.trim().toUpperCase()
          : "",
        add_on_vehicle_discount_percent: form.add_on_vehicle_enabled
          ? ADD_ON_VEHICLE_DISCOUNT_PERCENT
          : 0,
        add_on_vehicle_original_price: addOnVehicleOriginalPrice,
        add_on_vehicle_discount_amount: addOnVehicleDiscountAmount,
        add_on_vehicle_price: addOnVehiclePrice,

        interlock: Boolean(form.interlock),
        source: form.source || "admin",
        notes: form.notes,

        price: totalPrice,
        original_price: totalPrice,
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
        reference: form.transaction_reference.trim() || undefined,
        manual_payment_reference:
          form.transaction_reference.trim() || undefined,

        send_confirmation_email: Boolean(form.send_confirmation_email),
        resend_confirmation_email: Boolean(form.send_confirmation_email),

        price_rule_id: priceRule?._id,
        calculated_days: cruiseDays,
        admin_create: true,
      };

      const res = await axios.post("/admin/bookings/cruise", payload, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to create admin cruise booking."
        );
      }

      alert(res.data.message || "Cruise booking created successfully.");

      if (onCreated) {
        await onCreated(res.data.data);
      }
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to create booking."
      );
    } finally {
      setSaving(false);
    }
  }

  function renderDirectionShuttleSection(directionKey) {
    const direction = shuttleDirections[directionKey];
    const directionSlots = getDirectionShuttleSlots(directionKey);
    const passengerCount = Number(form[direction.passengerField] || 0);
    const selectedSlotId = form[direction.slotIdField];
    const selectedTime = form[direction.timeField];

    const extraCount = getPassengerExtraCount(passengerCount);
    const directionExtraFee = extraCount * EXTRA_PASSENGER_FEE;

    return (
      <div className="rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full">
            <label className="text-sm font-semibold text-gray-700">
              {direction.label} passengers *
            </label>

            <input
              type="number"
              min="1"
              value={form[direction.passengerField]}
              onChange={(event) =>
                handleDirectionPassengerChange(directionKey, event.target.value)
              }
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              required
            />

            {extraCount > 0 && (
              <p className="mt-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                {extraCount} extra passenger(s) × {money(EXTRA_PASSENGER_FEE)} =
                <strong> {money(directionExtraFee)}</strong>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => loadAvailableShuttleSlots(directionKey)}
            disabled={shuttleLoading}
            className="shrink-0 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {shuttleLoading ? "Loading..." : "Load Shuttle Options"}
          </button>
        </div>

        {showShuttleSlots[directionKey] && directionSlots.length > 0 && (
          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-700">
              {direction.label} shuttle option *
            </label>

            <select
              value={selectedSlotId}
              onChange={(event) =>
                handleDirectionShuttleSlotChange(
                  directionKey,
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
            >
              <option value="">Select shuttle option</option>

              {directionSlots.map((slot) => {
                const remaining = getDirectionRemaining(slot, directionKey);
                const bookedCount = getDirectionBookedCount(slot, directionKey);
                const disabled = remaining < Number(passengerCount || 1);

                return (
                  <option
                    key={`${directionKey}-${getSlotId(slot)}`}
                    value={getSlotId(slot)}
                    disabled={disabled}
                  >
                    {getSlotTime(slot)} — remaining {remaining} / capacity{" "}
                    {Number(slot.capacity || 0)}
                    {bookedCount > 0 ? ` — booked ${bookedCount}` : ""}
                    {disabled ? " (not enough capacity)" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {selectedTime && (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Selected {direction.label} shuttle: <strong>{selectedTime}</strong>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">
              Create Cruise Booking
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Admin manual booking. Payment method and reference are recorded
              only; no Stripe or PayPal redirect is triggered.
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

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <section className="rounded-3xl border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-950">
              Cruise Schedule
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">
                  Cruise Schedule *
                </label>

                <select
                  value={form.schedule_id}
                  onChange={(event) => handleScheduleChange(event.target.value)}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                >
                  <option value="">
                    {schedulesLoading
                      ? "Loading schedules..."
                      : "Select cruise schedule"}
                  </option>

                  {schedules.map((schedule) => (
                    <option key={schedule._id} value={schedule._id}>
                      {getScheduleTitle(schedule)} —{" "}
                      {formatDate(schedule.departure_date)} to{" "}
                      {formatDate(schedule.return_date)}
                    </option>
                  ))}
                </select>

                {schedulesError && (
                  <p className="mt-2 text-sm text-red-600">{schedulesError}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Ship Departure Date *
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
                  Ship Arrival Date *
                </label>

                <input
                  type="date"
                  value={form.end_date}
                  onChange={(event) =>
                    updateField("end_date", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Parking Slot Optional
                </label>

                <input
                  value={form.parking_slot}
                  onChange={(event) =>
                    updateField("parking_slot", event.target.value)
                  }
                  placeholder="Enter parking slot"
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Selected Car Park
                </label>

                <input
                  value={
                    selectedSchedule ? getLocationName(selectedSchedule) : "-"
                  }
                  readOnly
                  className="mt-2 w-full rounded-2xl border bg-gray-50 px-4 py-3 text-sm text-gray-600"
                />
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 md:col-span-2">
                <label className="flex items-start gap-3 text-sm font-semibold text-blue-950">
                  <input
                    type="checkbox"
                    checked={form.add_on_vehicle_enabled}
                    onChange={(event) =>
                      updateField(
                        "add_on_vehicle_enabled",
                        event.target.checked
                      )
                    }
                    className="mt-1"
                  />

                  <span>
                    Add On Vehicle
                    <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
                      add {ADD_ON_VEHICLE_DISCOUNT_PERCENT}% Discount
                    </span>
                  </span>
                </label>

                {form.add_on_vehicle_enabled && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">
                        Select Vehicle *
                      </label>

                      <select
                        value={form.add_on_vehicle_type}
                        onChange={(event) =>
                          updateField("add_on_vehicle_type", event.target.value)
                        }
                        className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none focus:border-blue-600"
                        required={form.add_on_vehicle_enabled}
                      >
                        {addOnVehicleOptions.map((option) => (
                          <option
                            key={option.value || "select-add-on-vehicle"}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-2xl bg-white p-4 text-sm text-gray-700">
                      <p>
                        Add-on price:
                        <strong className="ml-2">{money(addOnVehiclePrice)}</strong>
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Based on {money(addOnVehicleOriginalPrice)} -{" "}
                        {ADD_ON_VEHICLE_DISCOUNT_PERCENT}% discount.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
              <p>
                <strong>Charged Days:</strong> {cruiseDays || "-"}
              </p>

              {priceLoading && (
                <p className="mt-2 text-blue-700">Loading cruise price...</p>
              )}

              {priceError && <p className="mt-2 text-red-700">{priceError}</p>}

              {priceRule && (
                <p className="mt-2 text-green-700">
                  Price rule: <strong>{priceRule.label}</strong> —{" "}
                  <strong>{money(priceRule.price)}</strong>
                </p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 p-5">
            <div>
              <h3 className="text-lg font-bold text-gray-950">
                Shuttle Details
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Choose separate passenger counts and shuttle options for both
                cruise directions.
              </p>
            </div>

            {shuttleError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {shuttleError}
              </div>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {renderDirectionShuttleSection("carParkToTerminal")}
              {renderDirectionShuttleSection("terminalToCarPark")}
            </div>

            {extraPassengerFee > 0 && (
              <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                <p className="font-bold">Extra Passenger Fee</p>
                <p className="mt-1">
                  {extraPassengerCount} extra passenger(s) ×{" "}
                  {money(EXTRA_PASSENGER_FEE)} ={" "}
                  <strong>{money(extraPassengerFee)}</strong>
                </p>
              </div>
            )}
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

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  License Plate *
                </label>

                <input
                  value={form.license_plate}
                  onChange={(event) =>
                    updateField("license_plate", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm uppercase outline-none focus:border-blue-600"
                  required
                />
              </div>

              {form.add_on_vehicle_enabled && form.add_on_vehicle_type && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    {form.add_on_vehicle_type} License Plate *
                  </label>

                  <input
                    value={form.add_on_vehicle_license_plate}
                    onChange={(event) =>
                      updateField(
                        "add_on_vehicle_license_plate",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm uppercase outline-none focus:border-blue-600"
                    required={form.add_on_vehicle_enabled}
                  />
                </div>
              )}

              <div>
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
                  <strong>{cruiseDays || 0}</strong>
                </div>

                <div className="flex justify-between">
                  <span>Parking Subtotal</span>
                  <strong>{money(originalPrice)}</strong>
                </div>

                <div className="flex justify-between">
                  <span>Extra Passenger Fee</span>
                  <strong>{money(extraPassengerFee)}</strong>
                </div>

                {form.add_on_vehicle_enabled && (
                  <>
                    <div className="flex justify-between">
                      <span>
                        Add On Vehicle
                        {form.add_on_vehicle_type
                          ? ` (${form.add_on_vehicle_type})`
                          : ""}
                      </span>
                      <strong>{money(addOnVehiclePrice)}</strong>
                    </div>

                    <div className="flex justify-between text-xs text-blue-700">
                      <span>
                        Add-on discount ({ADD_ON_VEHICLE_DISCOUNT_PERCENT}%)
                      </span>
                      <strong>- {money(addOnVehicleDiscountAmount)}</strong>
                    </div>
                  </>
                )}

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
                  <option value="online">Full Payment</option>
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