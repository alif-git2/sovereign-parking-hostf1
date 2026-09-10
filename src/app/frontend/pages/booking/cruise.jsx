"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";
import { useBookingStore } from "@/app/frontend/store/bookingStore";
import { useScheduleStore } from "@/app/frontend/store/scheduleStore";
import { useCouponStore } from "@/app/frontend/store/couponStore";
import Input from "../../component/global/Input";
import {
  User,
  CalendarCheck,
  SquareParking,
  Users,
  Mail,
  Phone,
  Bandage,
  FileText,
  PanelsTopLeft,
  UserStar,
  Tornado,
  LayoutGrid,
  MoveLeft,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import Div from "../../component/global/Div";
import SelectOption from "../../component/global/SelectOption";
import TextArea from "../../component/global/TextArea";
import {
  GoogleIcon,
  FacebookIcon,
  InstagramIcon,
} from "../../component/global/CustomIcon";
import TextCard from "../../component/global/TextCard";
import BoxCard from "../../component/global/BoxCard";
import NavigationButton from "../../component/global/NavigationButton";
import PaymentButton from "../../component/global/PaymentButton";
import BookingButton from "../../component/global/BookingButton";
import Navbar from "../../component/global/NavBar";
import Footer from "../../component/global/Footer";

const HOLDING_DEPOSIT_AMOUNT = 20;
const INCLUDED_SHUTTLE_PASSENGERS = 4;
const EXTRA_PASSENGER_FEE = 5;
const ADD_ON_VEHICLE_DISCOUNT_PERCENT = 10;
const ADD_ON_VEHICLE_OPTIONS = ["Car", "SUV", "Van", "Ute", "Truck", "Other"];
const CHECKOUT_DRAFT_API_URL = "/bookings/checkout-drafts";
const STRIPE_PAYMENT_PAGE_URL = "/booking/payment";
const PAYPAL_PAYMENT_PAGE_URL = "/booking/paypal";

const shuttleDirections = {
  carParkToTerminal: {
    label: "Car park to terminal",
    passengerField: "car_park_to_terminal_passengers",
    slotIdField: "car_park_to_terminal_shuttle_slot_id",
    timeField: "car_park_to_terminal_shuttle_time",
  },
  terminalToCarPark: {
    label: "Terminal to car park",
    passengerField: "terminal_to_car_park_passengers",
    slotIdField: "terminal_to_car_park_shuttle_slot_id",
    timeField: "terminal_to_car_park_shuttle_time",
  },
};

const sourceOptions = [
  { value: "web", label: "Website", icon: <PanelsTopLeft /> },
  { value: "google", label: "Google", icon: <GoogleIcon /> },
  { value: "facebook", label: "Facebook", icon: <FacebookIcon size={30} /> },
  { value: "instagram", label: "Instagram", icon: <InstagramIcon /> },
  { value: "friend", label: "Friend / Referral", icon: <Users /> },
  {
    value: "returning_customer",
    label: "Returning Customer",
    icon: <UserStar />,
  },
  { value: "other", label: "Other", icon: <Tornado /> },
];

function formatTableDate(date) {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "-";

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function money(amount) {
  return `A$${Number(amount || 0).toFixed(2)}`;
}

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null;
}

function normalizeAuthenticatedCustomer(value) {
  const customer =
    value?.data?.user ||
    value?.data?.customer ||
    value?.user ||
    value?.customer ||
    value;

  if (!customer || typeof customer !== "object") {
    return null;
  }

  const email = String(customer.email || "")
    .trim()
    .toLowerCase();

  if (!email) {
    return null;
  }

  return {
    ...customer,
    email,
  };
}

function getStoredAuthenticatedCustomer() {
  if (typeof window === "undefined" || !getToken()) {
    return null;
  }

  try {
    const rawUser = localStorage.getItem("user");

    if (!rawUser) {
      return null;
    }

    return normalizeAuthenticatedCustomer(JSON.parse(rawUser));
  } catch {
    return null;
  }
}

function getCustomerNameParts(customer) {
  const explicitFirstName = String(
    customer?.first_name || customer?.firstName || ""
  ).trim();

  const explicitLastName = String(
    customer?.last_name || customer?.lastName || ""
  ).trim();

  if (explicitFirstName || explicitLastName) {
    return {
      firstName: explicitFirstName,
      lastName: explicitLastName,
    };
  }

  const nameParts = String(customer?.name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: nameParts.shift() || "",
    lastName: nameParts.join(" "),
  };
}

function getAuthHeaders() {
  const token = getToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
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

function getTodayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isScheduleFromToday(schedule) {
  const departureDate = parseDateOnly(schedule?.departure_date);

  if (!departureDate) {
    return false;
  }

  const today = getTodayDateOnly();

  return departureDate >= today;
}


function calculateCruiseDays(schedule) {
  const departureDate = parseDateOnly(schedule?.departure_date);
  const arrivalDate = parseDateOnly(schedule?.return_date);

  if (!departureDate || !arrivalDate || arrivalDate <= departureDate) {
    return 0;
  }

  const diffMs = arrivalDate.getTime() - departureDate.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return days > 0 ? days : 0;
}

function getSlotId(slot) {
  return String(slot?._id || slot?.id || slot?.slot_id || slot?.time || "");
}

function getSlotTime(slot) {
  return String(slot?.time || slot?.shuttle_time || "").trim();
}

function normalizeCount(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
}

function getSlotRemaining(slot) {
  if (slot?.remaining !== undefined && slot.remaining !== null) {
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

function getLocationName(schedule) {
  const location = schedule?.location_id;

  if (!location) return "-";
  if (typeof location === "string") return location;

  return location.name || "-";
}

function getScheduleName(schedule) {
  return String(
    schedule?.schedule_name || schedule?.ship_name || "Unnamed Cruise"
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeShipName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getPassengerExtraCount(passengers) {
  return Math.max(Number(passengers || 0) - INCLUDED_SHUTTLE_PASSENGERS, 0);
}

export default function CruiseBookingPage() {
  const router = useRouter();
  const bookingTopRef = useRef(null);
  const shipFilterRef = useRef(null);

  const { createBooking, loading: bookingLoading } = useBookingStore();

  const {
    schedules,
    loading: scheduleLoading,
    loaded: scheduleLoaded,
    error: scheduleError,
    fetchSchedules,
  } = useScheduleStore();

  const {
    coupon,
    loading: couponLoading,
    validateCoupon,
    clearCoupon,
  } = useCouponStore();

  const [mounted, setMounted] = useState(false);
  const [loggedInCustomer, setLoggedInCustomer] = useState(null);
  const [customerAccountLoading, setCustomerAccountLoading] = useState(false);

  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedShip, setSelectedShip] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [sortConfig, setSortConfig] = useState({
    key: "departure_date",
    direction: "asc",
  });

  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  const [showShuttleOptions, setShowShuttleOptions] = useState({
    carParkToTerminal: false,
    terminalToCarPark: false,
  });

  const [cruisePriceRule, setCruisePriceRule] = useState(null);
  const [cruisePriceLoading, setCruisePriceLoading] = useState(false);
  const [cruisePriceError, setCruisePriceError] = useState("");

  const [cruiseShuttleSlots, setCruiseShuttleSlots] = useState([]);
  const [cruiseShuttleError, setCruiseShuttleError] = useState("");
  const [cruiseShuttleLoading, setCruiseShuttleLoading] = useState(false);

  const [paymentProviderPopupOpen, setPaymentProviderPopupOpen] =
    useState(false);
  const [poaProviderPopupOpen, setPoaProviderPopupOpen] = useState(false);
  const [onlinePaymentLoading, setOnlinePaymentLoading] = useState(false);

  const [form, setForm] = useState({
    type: "cruise",
    schedule_id: "",

    car_park_to_terminal_passengers: 0,
    car_park_to_terminal_shuttle_slot_id: "",
    car_park_to_terminal_shuttle_time: "",

    terminal_to_car_park_passengers: 0,
    terminal_to_car_park_shuttle_slot_id: "",
    terminal_to_car_park_shuttle_time: "",

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

    coupon_code: "",

    reference: "",

    payment_flow: "",
    payment_method: "",
    deposit_type: "",
    holding_deposit_amount: 0,
  });

    useEffect(() => {
    if (!selectedSchedule) return;

    scrollToBookingTop();
  }, [selectedSchedule, currentStep]);

  useEffect(() => {
    let active = true;

    setMounted(true);

    const token = getToken();

    if (!token) {
      setLoggedInCustomer(null);
      setCustomerAccountLoading(false);

      return () => {
        active = false;
      };
    }

    function applyCustomer(customerValue) {
      const customer = normalizeAuthenticatedCustomer(customerValue);

      if (!customer || !active) {
        return false;
      }

      const { firstName, lastName } = getCustomerNameParts(customer);

      setLoggedInCustomer(customer);

      setForm((prev) => ({
        ...prev,
        first_name: prev.first_name || firstName,
        last_name: prev.last_name || lastName,
        email: customer.email,
        phone: prev.phone || String(customer.phone || "").trim(),
      }));

      return true;
    }

    const cachedCustomer = getStoredAuthenticatedCustomer();

    applyCustomer(cachedCustomer);

    async function loadAuthenticatedCustomer() {
      try {
        setCustomerAccountLoading(true);

        const res = await axios.get("/customer/dashboard", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.data?.success) {
          throw new Error(
            res.data?.message ||
              res.data?.error ||
              "Failed to load customer account."
          );
        }

        const customer = normalizeAuthenticatedCustomer(
          res.data?.data?.user
        );

        if (!customer || !active) {
          return;
        }

        localStorage.setItem("user", JSON.stringify(customer));
        applyCustomer(customer);
      } catch {
        if (!cachedCustomer && active) {
          setLoggedInCustomer(null);
        }
      } finally {
        if (active) {
          setCustomerAccountLoading(false);
        }
      }
    }

    loadAuthenticatedCustomer();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    clearCoupon();

    return () => {
      clearCoupon();
    };
  }, [clearCoupon]);

  useEffect(() => {
    fetchSchedules().catch(() => {
      // The schedule table handles fetch errors inline.
    });
  }, [fetchSchedules]);

  useEffect(() => {
    async function fetchWallet() {
      try {
        const token = getToken();

        if (!token) {
          setWallet(null);
          return;
        }

        setWalletLoading(true);
        setWalletError("");

        const res = await axios.get("/wallet/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.data.success) {
          throw new Error(
            res.data.message || res.data.error || "Failed to load wallet"
          );
        }

        setWallet(res.data.data?.wallet || null);
      } catch (error) {
        setWallet(null);
        setWalletError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Wallet could not be loaded"
        );
      } finally {
        setWalletLoading(false);
      }
    }

    fetchWallet();
  }, []);

  const cruiseDays = useMemo(() => {
    return calculateCruiseDays(selectedSchedule);
  }, [selectedSchedule]);

  const activeShuttleSlots = useMemo(() => {
    return cruiseShuttleSlots.filter(
      (slot) => slot && slot.type !== "airport" && slot.is_active !== false
    );
  }, [cruiseShuttleSlots]);

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

  const originalPrice = useMemo(() => {
    return Number(cruisePriceRule?.price || 0);
  }, [cruisePriceRule]);

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

  const addOnVehicleEnabled = Boolean(form.add_on_vehicle_enabled);
  const addOnVehicleOriginalPrice = addOnVehicleEnabled ? originalPrice : 0;
  const addOnVehicleDiscountAmount = addOnVehicleEnabled
    ? (addOnVehicleOriginalPrice * ADD_ON_VEHICLE_DISCOUNT_PERCENT) / 100
    : 0;
  const addOnVehiclePrice = addOnVehicleEnabled
    ? Math.max(addOnVehicleOriginalPrice - addOnVehicleDiscountAmount, 0)
    : 0;

  const priceBeforeDiscount =
    originalPrice + addOnVehiclePrice + extraPassengerFee;

  const discountAmount = Number(coupon?.discount_amount || 0);

  const finalPrice = coupon
    ? Number(
        coupon.final_price || Math.max(priceBeforeDiscount - discountAmount, 0)
      )
    : priceBeforeDiscount;

  const poaDepositAmount = Math.min(HOLDING_DEPOSIT_AMOUNT, finalPrice || 0);

  const hasLoggedInCustomer = mounted && Boolean(getToken());

  const lockedCustomerEmail = String(loggedInCustomer?.email || "")
    .trim()
    .toLowerCase();

  const effectiveCustomerEmail = hasLoggedInCustomer
    ? lockedCustomerEmail
    : String(form.email || "").trim().toLowerCase();

  const walletBalance = Number(wallet?.balance || 0);
  const walletStatus = wallet?.status || "active";
  const walletIsActive = walletStatus === "active";

  const walletCanPay =
    hasLoggedInCustomer && walletIsActive && walletBalance >= finalPrice;

  const walletCanPayDeposit =
    hasLoggedInCustomer &&
    walletIsActive &&
    walletBalance >= poaDepositAmount &&
    poaDepositAmount > 0;

  useEffect(() => {
    async function fetchCruisePriceRule() {
      try {
        setCruisePriceRule(null);
        setCruisePriceError("");

        if (!selectedSchedule || !cruiseDays || cruiseDays < 1) {
          return;
        }

        setCruisePriceLoading(true);

        const res = await axios.get("/settings/price-rules", {
          params: {
            type: "cruise",
            days: cruiseDays,
          },
        });

        if (!res.data?.success) {
          throw new Error(
            res.data?.message ||
              res.data?.error ||
              "Failed to load cruise price"
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

        setCruisePriceRule(matchedRule);
      } catch (error) {
        setCruisePriceRule(null);
        setCruisePriceError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Cruise price could not be loaded."
        );
      } finally {
        setCruisePriceLoading(false);
      }
    }

    fetchCruisePriceRule();
  }, [selectedSchedule, cruiseDays]);

  useEffect(() => {
    async function loadCruiseShuttleSlots() {
      try {
        setCruiseShuttleError("");
        setCruiseShuttleSlots([]);

        if (!selectedSchedule?._id) {
          return;
        }

        setCruiseShuttleLoading(true);

        const res = await axios.get("/settings/shuttle-time-slots", {
          params: {
            type: "cruise",
            schedule_id: selectedSchedule._id,
            departure_date: selectedSchedule.departure_date,
          },
        });

        if (!res.data?.success) {
          throw new Error(
            res.data?.message ||
              res.data?.error ||
              "Failed to load cruise shuttle slots"
          );
        }

        const settingSlots =
          res.data.data?.available_shuttle_slots ||
          res.data.data?.shuttle_time_slots ||
          [];

        const normalizedSettingSlots = settingSlots
          .map(normalizeCruiseShuttleSlot)
          .filter((slot) => slot.time && slot.is_active !== false);

        if (normalizedSettingSlots.length === 0) {
          setCruiseShuttleError(
            "No cruise shuttle slots are configured in Settings."
          );
          return;
        }

        const hasCarParkToTerminal = normalizedSettingSlots.some(
          (slot) => slot.show_car_park_to_terminal !== false
        );

        const hasTerminalToCarPark = normalizedSettingSlots.some(
          (slot) => slot.show_terminal_to_car_park !== false
        );

        if (!hasCarParkToTerminal && !hasTerminalToCarPark) {
          setCruiseShuttleError(
            "No cruise shuttle slots are enabled for this cruise booking."
          );
          return;
        }

        setCruiseShuttleSlots(normalizedSettingSlots);
      } catch (error) {
        setCruiseShuttleSlots([]);
        setCruiseShuttleError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Cruise shuttle slots could not be loaded."
        );
      } finally {
        setCruiseShuttleLoading(false);
      }
    }

    loadCruiseShuttleSlots();
  }, [selectedSchedule]);

  const availableShipNames = useMemo(() => {
    const uniqueShips = new Map();

    (schedules || [])
      .filter(
        (schedule) =>
          schedule?.is_active !== false && isScheduleFromToday(schedule)
      )
      .forEach((schedule) => {
        const shipName = getScheduleName(schedule);
        const normalizedName = normalizeShipName(shipName);

        if (
          normalizedName &&
          normalizedName !== normalizeShipName("Unnamed Cruise") &&
          !uniqueShips.has(normalizedName)
        ) {
          uniqueShips.set(normalizedName, shipName);
        }
      });

    return Array.from(uniqueShips.values()).sort((a, b) =>
      a.localeCompare(b, "en", {
        sensitivity: "base",
      })
    );
  }, [schedules]);

  useEffect(() => {
    if (!selectedShip) return;

    const stillExists = availableShipNames.some(
      (shipName) =>
        normalizeShipName(shipName) === normalizeShipName(selectedShip)
    );

    if (!stillExists) {
      setSelectedShip("");
      setCurrentPage(1);
    }
  }, [availableShipNames, selectedShip]);

  const filteredSchedules = useMemo(() => {
    const searchValue = search.toLowerCase().trim();
    const selectedShipValue = normalizeShipName(selectedShip);

    let result = (schedules || []).filter((schedule) => {
      return schedule?.is_active !== false && isScheduleFromToday(schedule);
    });

    if (selectedShipValue) {
      result = result.filter(
        (schedule) =>
          normalizeShipName(getScheduleName(schedule)) === selectedShipValue
      );
    }

    if (searchValue) {
      result = result.filter((schedule) => {
        return (
          getScheduleName(schedule).toLowerCase().includes(searchValue) ||
          formatTableDate(schedule.departure_date).includes(searchValue) ||
          formatTableDate(schedule.return_date).includes(searchValue)
        );
      });
    }

    result = [...result].sort((a, b) => {
      const key = sortConfig.key;

      let valueA =
        key === "schedule_name" ? getScheduleName(a) : a?.[key];
      let valueB =
        key === "schedule_name" ? getScheduleName(b) : b?.[key];

      if (key === "departure_date" || key === "return_date") {
        valueA = new Date(valueA).getTime();
        valueB = new Date(valueB).getTime();
      } else {
        valueA = String(valueA || "").toLowerCase();
        valueB = String(valueB || "").toLowerCase();
      }

      if (valueA < valueB) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }

      if (valueA > valueB) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }

      return 0;
    });

    return result;
  }, [schedules, search, selectedShip, sortConfig]);

  const totalPages = Math.ceil(filteredSchedules.length / entriesPerPage) || 1;

  const paginatedSchedules = useMemo(() => {
    const startIndex = (currentPage - 1) * entriesPerPage;
    const endIndex = startIndex + entriesPerPage;

    return filteredSchedules.slice(startIndex, endIndex);
  }, [filteredSchedules, currentPage, entriesPerPage]);

  function getDirectionShuttleSlots(directionKey) {
    if (directionKey === "carParkToTerminal") {
      return carParkToTerminalShuttleSlots;
    }

    if (directionKey === "terminalToCarPark") {
      return terminalToCarParkShuttleSlots;
    }

    return [];
  }

  function clearPaymentFields(nextForm) {
    return {
      ...nextForm,
      payment_flow: "",
      payment_method: "",
      deposit_type: "",
      holding_deposit_amount: 0,
    };
  }

  function resetPaymentSelection() {
    setPaymentProviderPopupOpen(false);
    setPoaProviderPopupOpen(false);

    setForm((prev) =>
      clearPaymentFields({
        ...prev,
      })
    );
  }

  function updateField(name, value) {
    if (name === "email" && hasLoggedInCustomer) {
      return;
    }

    if (name === "add_on_vehicle_enabled") {
      clearCoupon();

      setForm((prev) =>
        clearPaymentFields({
          ...prev,
          add_on_vehicle_enabled: Boolean(value),
          add_on_vehicle_type: value ? prev.add_on_vehicle_type : "",
          add_on_vehicle_license_plate: value
            ? prev.add_on_vehicle_license_plate
            : "",
          coupon_code: "",
        })
      );

      return;
    }

    if (name === "add_on_vehicle_type") {
      setForm((prev) => ({
        ...prev,
        add_on_vehicle_type: value,
        add_on_vehicle_license_plate: "",
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "coupon_code") {
      clearCoupon();
    }
  }

  function selectStripeFullPayment() {
    setForm((prev) => ({
      ...prev,
      payment_flow: "full_online",
      payment_method: "stripe",
      deposit_type: "full",
      holding_deposit_amount: 0,
    }));

    setPaymentProviderPopupOpen(false);
  }

  function selectPaypalFullPayment() {
    setForm((prev) => ({
      ...prev,
      payment_flow: "full_online",
      payment_method: "paypal",
      deposit_type: "full",
      holding_deposit_amount: 0,
    }));

    setPaymentProviderPopupOpen(false);
  }

  function selectWalletFullPayment() {
    if (!hasLoggedInCustomer) {
      alert("Wallet payment is available for existing logged-in customers only.");
      return;
    }

    if (!walletIsActive) {
      alert("Your wallet is not active. Please contact support.");
      return;
    }

    if (walletBalance < finalPrice) {
      alert(
        `You do not have enough wallet balance for this booking. Required: ${money(
          finalPrice
        )}, available: ${money(walletBalance)}`
      );
      return;
    }

    setForm((prev) => ({
      ...prev,
      payment_flow: "full_online",
      payment_method: "wallet",
      deposit_type: "full",
      holding_deposit_amount: 0,
    }));

    setPaymentProviderPopupOpen(false);
  }

  function selectPoaStripeDeposit() {
    setForm((prev) => ({
      ...prev,
      payment_flow: "poa_deposit",
      payment_method: "stripe",
      deposit_type: "poa",
      holding_deposit_amount: poaDepositAmount,
    }));

    setPoaProviderPopupOpen(false);
  }

  function selectPoaPaypalDeposit() {
    setForm((prev) => ({
      ...prev,
      payment_flow: "poa_deposit",
      payment_method: "paypal",
      deposit_type: "poa",
      holding_deposit_amount: poaDepositAmount,
    }));

    setPoaProviderPopupOpen(false);
  }

  function selectPoaWalletDeposit() {
    if (!hasLoggedInCustomer) {
      alert("Wallet payment is available for existing logged-in customers only.");
      return;
    }

    if (!walletIsActive) {
      alert("Your wallet is not active. Please contact support.");
      return;
    }

    if (walletBalance < poaDepositAmount) {
      alert(
        `You do not have enough wallet balance for this deposit. Required: ${money(
          poaDepositAmount
        )}, available: ${money(walletBalance)}`
      );
      return;
    }

    setForm((prev) => ({
      ...prev,
      payment_flow: "poa_deposit",
      payment_method: "wallet",
      deposit_type: "poa",
      holding_deposit_amount: poaDepositAmount,
    }));

    setPoaProviderPopupOpen(false);
  }

  function getSelectedPaymentLabel() {
    if (form.payment_flow === "poa_deposit") {
      if (form.payment_method === "stripe") return "Pay on Arrival - Stripe";
      if (form.payment_method === "paypal") return "Pay on Arrival - PayPal";
      if (form.payment_method === "wallet") return "Pay on Arrival - Wallet";

      return "Pay on Arrival";
    }

    if (form.payment_method === "stripe") return "Full Payment - Stripe";
    if (form.payment_method === "paypal") return "Full Payment - PayPal";
    if (form.payment_method === "wallet") return "Full Payment - Wallet";

    return "No payment method selected";
  }

  function getFinalButtonLabel() {
    if (bookingLoading) return "Creating Booking...";
    if (onlinePaymentLoading) return "Preparing Payment...";

    if (form.payment_flow === "poa_deposit") {
      if (form.payment_method === "stripe") return "Continue to Stripe";
      if (form.payment_method === "paypal") return "Continue to PayPal";
      if (form.payment_method === "wallet") return "Pay with Wallet";

      return "Select Deposit Payment";
    }

    if (form.payment_method === "paypal") return "Continue to PayPal";
    if (form.payment_method === "stripe") return "Continue to Stripe";
    if (form.payment_method === "wallet") return "Pay with Wallet";

    return "Select Payment Method";
  }

  function scrollShipFilters(direction) {
    const container = shipFilterRef.current;

    if (!container) return;

    container.scrollBy({
      left: direction === "left" ? -280 : 280,
      behavior: "smooth",
    });
  }

  function handleSort(key) {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: "asc",
      };
    });
  }

  function resetShuttleFields() {
    return {
      car_park_to_terminal_passengers: 0,
      car_park_to_terminal_shuttle_slot_id: "",
      car_park_to_terminal_shuttle_time: "",
      terminal_to_car_park_passengers: 0,
      terminal_to_car_park_shuttle_slot_id: "",
      terminal_to_car_park_shuttle_time: "",
    };
  }


  function scrollToBookingTop() {
    if (typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      const element = bookingTopRef.current;

      if (!element) {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
        return;
      }

      const headerOffset = 90;
      const elementTop = element.getBoundingClientRect().top + window.scrollY;

      window.scrollTo({
        top: Math.max(elementTop - headerOffset, 0),
        behavior: "smooth",
      });
    });
  }

  function handleSelectSchedule(schedule) {
    clearCoupon();

    setSelectedSchedule(schedule);
    setCurrentStep(1);
    setShowShuttleOptions({
      carParkToTerminal: false,
      terminalToCarPark: false,
    });
    setPaymentProviderPopupOpen(false);
    setPoaProviderPopupOpen(false);
    setCruisePriceRule(null);
    setCruisePriceError("");
    setCruiseShuttleSlots([]);
    setCruiseShuttleError("");

    setForm((prev) => ({
      ...prev,
      schedule_id: schedule._id,
      ...resetShuttleFields(),
      coupon_code: "",
      add_on_vehicle_enabled: false,
      add_on_vehicle_type: "",
      add_on_vehicle_license_plate: "",
      payment_flow: "",
      payment_method: "",
      deposit_type: "",
      holding_deposit_amount: 0,
    }));
  }

  function goBackToScheduleList() {
    clearCoupon();

    setSelectedSchedule(null);
    setCurrentStep(1);
    setShowShuttleOptions({
      carParkToTerminal: false,
      terminalToCarPark: false,
    });
    setPaymentProviderPopupOpen(false);
    setPoaProviderPopupOpen(false);
    setCruisePriceRule(null);
    setCruisePriceError("");
    setCruiseShuttleSlots([]);
    setCruiseShuttleError("");

    setForm((prev) => ({
      ...prev,
      schedule_id: "",
      ...resetShuttleFields(),
      coupon_code: "",
      add_on_vehicle_enabled: false,
      add_on_vehicle_type: "",
      add_on_vehicle_license_plate: "",
      payment_flow: "",
      payment_method: "",
      deposit_type: "",
      holding_deposit_amount: 0,
    }));
  }

  function handlePassengerChange(directionKey, value) {
    const direction = shuttleDirections[directionKey];
    const passengerCount = Number(value || 0);
    const directionSlots = getDirectionShuttleSlots(directionKey);

    clearCoupon();

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

      return clearPaymentFields({
        ...prev,
        [direction.passengerField]: value,
        [direction.slotIdField]: shouldClearShuttle
          ? ""
          : prev[direction.slotIdField],
        [direction.timeField]: shouldClearShuttle
          ? ""
          : prev[direction.timeField],
        coupon_code: "",
      });
    });

    if (passengerCount < 1) {
      setShowShuttleOptions((prev) => ({
        ...prev,
        [directionKey]: false,
      }));
    }
  }

  function handleSeeShuttleOptions(directionKey) {
    const direction = shuttleDirections[directionKey];
    const directionSlots = getDirectionShuttleSlots(directionKey);

    if (cruiseShuttleLoading) {
      alert("Please wait while shuttle options are loading.");
      return;
    }

    if (cruiseShuttleError) {
      alert(cruiseShuttleError);
      return;
    }

    if (directionSlots.length === 0) {
      alert(`No ${direction.label} shuttle slots are available.`);
      return;
    }

    const passengerCount = Number(form[direction.passengerField] || 0);

    if (passengerCount < 1) {
      alert(`Please enter ${direction.label} passengers at least 1.`);
      return;
    }

    setShowShuttleOptions((prev) => ({
      ...prev,
      [directionKey]: true,
    }));
  }

  function selectShuttleSlot(directionKey, slot) {
    const direction = shuttleDirections[directionKey];
    const slotId = getSlotId(slot);
    const slotTime = getSlotTime(slot);

    setForm((prev) => ({
      ...prev,
      [direction.slotIdField]: slotId,
      [direction.timeField]: slotTime,
    }));
  }

  async function handleApplyCoupon() {
    try {
      if (!form.coupon_code) {
        alert("Please enter coupon code.");
        return;
      }

      if (!selectedSchedule) {
        alert("Please select a cruise schedule first.");
        return;
      }

      if (!cruisePriceRule) {
        alert(
          cruisePriceError ||
            `No cruise price rule found for ${cruiseDays} day(s). Please add it from Settings.`
        );
        return;
      }

      if (priceBeforeDiscount <= 0) {
        alert("Price must be greater than 0 before applying coupon.");
        return;
      }

      resetPaymentSelection();

      const result = await validateCoupon({
        code: form.coupon_code,
        booking_type: "cruise",
        amount: priceBeforeDiscount,
      });

      alert(`Coupon applied. Discount: ${money(result.discount_amount)}`);
    } catch (error) {
      alert(error.message);
    }
  }

  function handleRemoveCoupon() {
    clearCoupon();

    setForm((prev) =>
      clearPaymentFields({
        ...prev,
        coupon_code: "",
      })
    );
  }

  function validateDirectionSelection(directionKey) {
    const direction = shuttleDirections[directionKey];
    const directionSlots = getDirectionShuttleSlots(directionKey);
    const passengerCount = Number(form[direction.passengerField] || 0);
    const selectedSlotId = form[direction.slotIdField];
    const selectedTime = form[direction.timeField];

    if (!passengerCount || passengerCount < 1) {
      alert(`Please enter ${direction.label} passengers at least 1.`);
      return false;
    }

    if (directionSlots.length === 0) {
      alert(`No ${direction.label} shuttle slots are available.`);
      return false;
    }

    if (!selectedTime || !selectedSlotId) {
      alert(`Please select ${direction.label} shuttle option.`);
      return false;
    }

    const selectedSlot = directionSlots.find(
      (slot) => String(getSlotId(slot)) === String(selectedSlotId)
    );

    if (!selectedSlot) {
      alert(
        `${direction.label} shuttle slot was not found. Please select again.`
      );
      return false;
    }

    const remaining = getDirectionRemaining(selectedSlot, directionKey);

    if (remaining < passengerCount) {
      alert(
        `${direction.label} shuttle slot has only ${remaining} remaining seat(s). Please choose another shuttle time.`
      );
      return false;
    }

    return true;
  }

  function validateStep(step) {
    if (step === 1) {
      if (!selectedSchedule) {
        alert("Please select a cruise schedule.");
        return false;
      }

      if (cruiseDays < 1) {
        alert("Invalid cruise departure and arrival dates.");
        return false;
      }

      if (!cruisePriceRule) {
        alert(
          cruisePriceError ||
            `No cruise price rule found for ${cruiseDays} day(s). Please add it from Settings.`
        );
        return false;
      }

      if (form.add_on_vehicle_enabled && !form.add_on_vehicle_type) {
        alert("Please select add-on vehicle.");
        return false;
      }
    }

    if (step === 2) {
      if (cruiseShuttleError) {
        alert(cruiseShuttleError);
        return false;
      }

      if (activeShuttleSlots.length === 0) {
        alert("No shuttle slots are available for this cruise schedule.");
        return false;
      }

      if (carParkToTerminalShuttleSlots.length === 0) {
        alert("No Car park to terminal shuttle slots are available.");
        return false;
      }

      if (terminalToCarParkShuttleSlots.length === 0) {
        alert("No Terminal to car park shuttle slots are available.");
        return false;
      }

      if (!validateDirectionSelection("carParkToTerminal")) {
        return false;
      }

      if (!validateDirectionSelection("terminalToCarPark")) {
        return false;
      }
    }

    if (step === 3) {
      if (!form.first_name || !form.last_name) {
        alert("Please enter first name and last name.");
        return false;
      }

      if (hasLoggedInCustomer && customerAccountLoading) {
        alert("Please wait while your customer account is loading.");
        return false;
      }

      if (hasLoggedInCustomer && !lockedCustomerEmail) {
        alert(
          "Your logged-in account email could not be verified. Please log out and log in again."
        );
        return false;
      }

      if (!effectiveCustomerEmail || !form.phone) {
        alert("Please enter email and phone.");
        return false;
      }

      if (!form.license_plate) {
        alert("Please enter license plate.");
        return false;
      }

      if (
        form.add_on_vehicle_enabled &&
        !String(form.add_on_vehicle_license_plate || "").trim()
      ) {
        alert(
          `Please enter ${
            form.add_on_vehicle_type || "Add On Vehicle"
          } license plate.`
        );
        return false;
      }

      if (!form.source) {
        alert("Please select how you heard about us.");
        return false;
      }
    }

    return true;
  }

  function goNext() {
    if (!validateStep(currentStep)) return;

    setCurrentStep((prev) => Math.min(prev + 1, 4));
  }

  function goPrevious() {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }

  async function createCheckoutDraft(payload) {
    const amountDueNow =
      payload.payment_flow === "poa_deposit"
        ? Number(payload.holding_deposit_amount || poaDepositAmount)
        : finalPrice;

    const balanceDueOnArrival =
      payload.payment_flow === "poa_deposit"
        ? Math.max(finalPrice - amountDueNow, 0)
        : 0;

    const res = await axios.post(
      CHECKOUT_DRAFT_API_URL,
      {
        type: "cruise",

        booking_payload: payload,
        bookingPayload: payload,

        payment_method: payload.payment_method,
        payment_flow: payload.payment_flow,
        deposit_type: payload.deposit_type,

        price: finalPrice,
        final_price: finalPrice,
        total_amount: finalPrice,
        amount_due_now: amountDueNow,
        due_amount: amountDueNow,
        holding_deposit_amount:
          payload.payment_flow === "poa_deposit" ? amountDueNow : 0,
        balance_due_on_arrival: balanceDueOnArrival,

        coupon_code: coupon?.code || coupon?.coupon_code || "",
        discount_amount: discountAmount,
        add_on_vehicle_enabled: addOnVehicleEnabled,
        add_on_vehicle_price: addOnVehiclePrice,
        add_on_vehicle_discount_amount: addOnVehicleDiscountAmount,

        currency: "aud",
      },
      {
        headers: getAuthHeaders(),
      }
    );

    if (!res.data?.success) {
      throw new Error(
        res.data?.message ||
          res.data?.error ||
          "Checkout draft could not be created."
      );
    }

    const draftId =
      res.data?.checkoutDraftId ||
      res.data?.checkout_draft_id ||
      res.data?.draftId ||
      res.data?.draft_id ||
      res.data?.data?.draft?.draft_reference ||
      res.data?.draft?.draft_reference ||
      "";

    if (!draftId) {
      throw new Error("Checkout draft reference is missing.");
    }

    return {
      draftId,
      redirectUrl: res.data?.redirectUrl || "",
    };
  }

async function handleCreateBooking() {
  try {
    if (!validateStep(1)) return;
    if (!validateStep(2)) return;
    if (!validateStep(3)) return;

    if (priceBeforeDiscount <= 0) {
      alert("Booking price must be greater than 0.");
      return;
    }

    if (form.coupon_code && !coupon) {
      alert("Please apply the coupon before proceeding.");
      return;
    }

    if (!form.payment_flow || !form.payment_method || !form.deposit_type) {
      alert("Please select a payment method.");
      return;
    }

    const isWalletPayment = form.payment_method === "wallet";
    const isStripePayment = form.payment_method === "stripe";
    const isPaypalPayment = form.payment_method === "paypal";

    const requiredWalletAmount =
      form.payment_flow === "poa_deposit"
        ? Number(form.holding_deposit_amount || poaDepositAmount)
        : finalPrice;

    if (isWalletPayment) {
      if (!hasLoggedInCustomer) {
        alert("Wallet payment is available for existing logged-in customers only.");
        return;
      }

      if (!walletIsActive) {
        alert("Your wallet is not active. Please contact support.");
        return;
      }

      if (walletBalance < requiredWalletAmount) {
        alert(
          `You do not have enough wallet balance. Required: ${money(
            requiredWalletAmount
          )}, available: ${money(walletBalance)}`
        );
        return;
      }
    }

    const maxDirectionPassengers = Math.max(
      carParkToTerminalPassengerCount,
      terminalToCarParkPassengerCount
    );

    const payload = {
      type: "cruise",
      schedule_id: selectedSchedule._id,

      shuttle_slot_id: form.car_park_to_terminal_shuttle_slot_id,
      shuttle_time: form.car_park_to_terminal_shuttle_time,
      pax: maxDirectionPassengers,

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
      add_on_vehicle_enabled: addOnVehicleEnabled,
      add_on_vehicle_type: addOnVehicleEnabled ? form.add_on_vehicle_type : "",
      add_on_vehicle_license_plate: addOnVehicleEnabled
        ? form.add_on_vehicle_license_plate.trim()
        : "",
      add_on_vehicle_discount_percent: ADD_ON_VEHICLE_DISCOUNT_PERCENT,
      add_on_vehicle_original_price: addOnVehicleOriginalPrice,
      add_on_vehicle_discount_amount: addOnVehicleDiscountAmount,
      add_on_vehicle_price: addOnVehiclePrice,
      total_before_discount: priceBeforeDiscount,

      details: {
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
            enabled: addOnVehicleEnabled,
            type: addOnVehicleEnabled ? form.add_on_vehicle_type : "",
            license_plate: addOnVehicleEnabled
              ? form.add_on_vehicle_license_plate.trim()
              : "",
            discount_percent: ADD_ON_VEHICLE_DISCOUNT_PERCENT,
            original_price: addOnVehicleOriginalPrice,
            discount_amount: addOnVehicleDiscountAmount,
            price: addOnVehiclePrice,
          },
        },
      },

      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: effectiveCustomerEmail,
      phone: form.phone.trim(),

      license_plate: form.license_plate.trim(),
      interlock: Boolean(form.interlock),

      source: form.source,
      notes: form.notes,

      coupon_code: coupon?.code || coupon?.coupon_code || undefined,

      reference: form.reference,

      payment_flow: form.payment_flow,
      holding_deposit_amount: form.holding_deposit_amount,
      deposit_type: form.deposit_type,
      payment_method: form.payment_method,

      price_rule_id: cruisePriceRule?._id,
      calculated_days: cruiseDays,
    };

    /**
     * IMPORTANT:
     * Wallet can create booking immediately because wallet payment is completed
     * inside bookingservice.js transaction.
     */
    if (isWalletPayment) {
      const result = await createBooking(payload);

      clearCoupon();

      if (result?.redirectUrl) {
        router.push(result.redirectUrl);
        return;
      }

      const bookingId =
        result?.data?.booking_id ||
        result?.booking?.booking_id ||
        result?.booking_id;

      if (bookingId) {
        router.push(`/booking/success?bookingId=${bookingId}`);
        return;
      }

      router.push("/booking/success");
      return;
    }

    /**
     * IMPORTANT:
     * Do NOT call createBooking(payload) for Stripe/PayPal here.
     *
     * Stripe/PayPal now create a checkout draft first. The real booking should
     * only be created after successful payment from Stripe webhook or PayPal
     * capture.
     */
    if (isStripePayment || isPaypalPayment) {
      setOnlinePaymentLoading(true);

      const draftResult = await createCheckoutDraft(payload);
      const draftId = draftResult.draftId;

      clearCoupon();

      if (isStripePayment) {
        router.push(
          `${STRIPE_PAYMENT_PAGE_URL}?draftId=${encodeURIComponent(draftId)}`
        );
        return;
      }

      router.push(
        `${PAYPAL_PAYMENT_PAGE_URL}?draftId=${encodeURIComponent(draftId)}`
      );
      return;
    }

    alert("Invalid payment method selected.");
  } catch (error) {
    setOnlinePaymentLoading(false);

    alert(
      error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        "Booking could not be created."
    );
  }
}

  const reviewData = [
    { key: "Ship", value: getScheduleName(selectedSchedule) },
    { key: "Car Park", value: getLocationName(selectedSchedule) },
    {
      key: "Departure",
      value: formatTableDate(selectedSchedule?.departure_date),
    },
    {
      key: "Arrival",
      value: formatTableDate(selectedSchedule?.return_date),
    },
    {
      key: "Price For",
      value: cruiseDays
        ? `${cruiseDays} ${cruiseDays === 1 ? "Day" : "Days"}`
        : "-",
    },
    {
      key: "Car Park To Terminal Passengers",
      value: form.car_park_to_terminal_passengers || "-",
    },
    {
      key: "Car Park To Terminal Shuttle",
      value: form.car_park_to_terminal_shuttle_time || "-",
    },
    {
      key: "Terminal To Car Park Passengers",
      value: form.terminal_to_car_park_passengers || "-",
    },
    {
      key: "Terminal To Car Park Shuttle",
      value: form.terminal_to_car_park_shuttle_time || "-",
    },
    {
      key: "Extra Passenger Fee",
      value: extraPassengerFee > 0 ? money(extraPassengerFee) : money(0),
    },
    { key: "Name", value: form.first_name + " " + form.last_name },
    { key: "Email", value: effectiveCustomerEmail || "-" },
    { key: "Phone", value: form.phone },
    { key: "License Plate", value: form.license_plate },
    ...(addOnVehicleEnabled
      ? [
          { key: "Add On Vehicle", value: form.add_on_vehicle_type || "-" },
          {
            key: `${form.add_on_vehicle_type || "Add On Vehicle"} License Plate`,
            value: form.add_on_vehicle_license_plate || "-",
          },
          // {
          //   key: "Add On Vehicle Discount",
          //   value: `${ADD_ON_VEHICLE_DISCOUNT_PERCENT}% (${money(
          //     addOnVehicleDiscountAmount
          //   )})`,
          // },
          // { key: "Add On Vehicle Price", value: money(addOnVehiclePrice) },
        ]
      : []),
    { key: "Interlock", value: form.interlock ? "Yes" : "No" },
    { key: "Source", value: form.source },
    { key: "Vehicle Info", value: form.notes || "-" },
  ];

  function renderShuttleDirectionSelector(directionKey) {
    const direction = shuttleDirections[directionKey];
    const directionSlots = getDirectionShuttleSlots(directionKey);
    const passengerCount = Number(form[direction.passengerField] || 0);
    const selectedSlotId = form[direction.slotIdField];
    const selectedTime = form[direction.timeField];
    const extraCount = getPassengerExtraCount(passengerCount);
    const extraFee = extraCount * EXTRA_PASSENGER_FEE;

    return (
      <BoxCard>
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-semibold">{direction.label}</h3>
            <p className="mt-1 text-xs text-gray-500">
              First {INCLUDED_SHUTTLE_PASSENGERS} passengers are included.
              Extra passengers are {money(EXTRA_PASSENGER_FEE)} each.
            </p>
          </div>

          <div>
            <label className="font-medium">
              {direction.label} passengers
            </label>

            <Input
              type="number"
              min="1"
              value={form[direction.passengerField]}
              onChange={(e) =>
                handlePassengerChange(directionKey, e.target.value)
              }
              Icon={<Users />}
            />

            {extraCount > 0 && (
              <p className="mt-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                {extraCount} extra passenger(s) × {money(EXTRA_PASSENGER_FEE)} =
                {" "}
                <strong>{money(extraFee)}</strong>
              </p>
            )}
          </div>

          <BookingButton
            text={`See ${direction.label} Shuttle Options`}
            onClick={() => handleSeeShuttleOptions(directionKey)}
          />

          {showShuttleOptions[directionKey] && directionSlots.length === 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              No {direction.label} shuttle slots are available.
            </div>
          )}

{showShuttleOptions[directionKey] && directionSlots.length > 0 && (
  <div>
    <h3 className="text-lg font-medium text-black">Select Shuttle Option</h3>

    <div className="mt-3 grid gap-3">
      {directionSlots.map((slot) => {
        const remaining = getDirectionRemaining(slot, directionKey);
        const disabled = remaining < Number(passengerCount || 1);
        const slotId = getSlotId(slot);
        const slotTime = getSlotTime(slot);
        const selected = String(selectedSlotId) === String(slotId);

        return (
          <button
            key={`${directionKey}-${slotId}`}
            type="button"
            disabled={disabled}
            onClick={() => selectShuttleSlot(directionKey, slot)}
            className={`w-full rounded-md border-2 px-4 py-3 text-left text-base font-normal transition-all duration-200 ${
              selected
            ? "border-blue-600 bg-blue-600 text-white"
    : "border-blue-400 bg-white text-blue-500 hover:bg-blue-50"
            } ${
              disabled
                ? "cursor-not-allowed border-gray-300 bg-gray-50 text-gray-300 opacity-60"
                : ""
            }`}
          >
            {slotTime} — remaining {remaining}
          </button>
        );
      })}
    </div>
  </div>
)}

          {selectedTime && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              Selected {direction.label} shuttle:{" "}
              <strong>{selectedTime}</strong>
            </div>
          )}
        </div>
      </BoxCard>
    );
  }

  function renderPaymentMethodSelector() {
    const isOnlineSelected = form.payment_flow === "full_online";
    const isPoaDepositSelected = form.payment_flow === "poa_deposit";

    return (
      <BoxCard>
        <h3 className="font-semibold">Payment Method</h3>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setPaymentProviderPopupOpen(true)}
            className={`rounded-lg border-2 p-4 text-left transition ${
              isOnlineSelected
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 bg-white hover:border-blue-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full border border-gray-400">
                {isOnlineSelected && (
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                )}
              </span>

              <div>
                <p className="text-lg font-semibold">Full Payment</p>

                <p className="mt-1 text-sm text-gray-600">
                  {form.payment_method === "stripe" &&
                  form.payment_flow === "full_online"
                    ? "Selected: Stripe"
                    : form.payment_method === "paypal" &&
                      form.payment_flow === "full_online"
                    ? "Selected: PayPal"
                    : form.payment_method === "wallet" &&
                      form.payment_flow === "full_online"
                    ? "Selected: Wallet"
                    : hasLoggedInCustomer
                    ? "Choose Stripe, PayPal, or Wallet."
                    : "Choose Stripe or PayPal."}
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPoaProviderPopupOpen(true)}
            className={`relative rounded-lg border-2 p-4 text-left transition ${
              isPoaDepositSelected
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 bg-white"
            }`}
          >
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[10px] text-white">
                i
              </span>
              Non-refundable
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full border border-gray-400">
                {isPoaDepositSelected && (
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                )}
              </span>

              <div className="flex-1 pr-24">
                <p className="text-lg font-semibold">Pay on Arrival</p>

                <p className="mt-1 text-sm font-medium text-gray-600">
                  {money(poaDepositAmount)} holding deposit
                </p>
              </div>
            </div>
          </button>
        </div>

        {isPoaDepositSelected && (
          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            <p className="font-semibold">Holding deposit required</p>

            <p className="mt-1">
              A small holding deposit of {money(poaDepositAmount)} will be
              charged now to secure your spot and it&apos;s a non-refundable
              deposit. The remaining balance will be paid on arrival.
            </p>
          </div>
        )}

        {form.payment_flow && (
          <Div>
            <div className="rounded-lg p-3 text-sm text-blue-700">
              <strong>Selected: {getSelectedPaymentLabel()}</strong>
            </div>
          </Div>
        )}

        {paymentProviderPopupOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md">
              <BoxCard bgWhite={true}>
                <div className="flex min-w-0 items-center justify-between gap-1">
                  <h3 className="text-xl font-bold">Choose Payment Provider</h3>

                  <button
                    type="button"
                    onClick={() => setPaymentProviderPopupOpen(false)}
                    className="rounded-full border-2 border-gray-300 p-1 transition-all duration-200 hover:border-blue-400 cursor-pointer"
                  >
                    <X size={14} color="red" strokeWidth={4} />
                  </button>
                </div>

                <div className="mt-6 grid gap-3">
                  <button
                    type="button"
                    onClick={selectStripeFullPayment}
                    className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left hover:border-blue-600"
                  >
                    <p className="text-lg font-bold text-blue-700">
                      Pay with Stripe
                    </p>

                    <p className="mt-1 text-sm text-blue-700">
                      Pay securely by card.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={selectPaypalFullPayment}
                    className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-left hover:border-yellow-500"
                  >
                    <p className="text-lg font-bold text-yellow-800">
                      Pay with PayPal
                    </p>

                    <p className="mt-1 text-sm text-yellow-800">
                      Pay using your PayPal account.
                    </p>
                  </button>

                  {hasLoggedInCustomer && (
                    <button
                      type="button"
                      onClick={selectWalletFullPayment}
                      disabled={!walletCanPay}
                      className={`rounded-xl border p-4 text-left ${
                        walletCanPay
                          ? "border-green-200 bg-green-50 hover:border-green-600"
                          : "cursor-not-allowed border-gray-200 bg-gray-50 opacity-70"
                      }`}
                    >
                      <p
                        className={`text-lg font-bold ${
                          walletCanPay ? "text-green-700" : "text-gray-500"
                        }`}
                      >
                        Pay with Wallet
                      </p>

                      <p
                        className={`mt-1 text-sm ${
                          walletCanPay ? "text-green-700" : "text-gray-500"
                        }`}
                      >
                        {walletLoading
                          ? "Checking wallet balance..."
                          : walletError
                          ? walletError
                          : !walletIsActive
                          ? "Your wallet is not active."
                          : walletBalance < finalPrice
                          ? `Insufficient wallet balance. Available: ${money(
                              walletBalance
                            )}. Required: ${money(finalPrice)}.`
                          : `Available balance: ${money(walletBalance)}.`}
                      </p>
                    </button>
                  )}
                </div>
              </BoxCard>
            </div>
          </div>
        )}

        {poaProviderPopupOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md">
              <BoxCard bgWhite={true}>
                <div className="flex min-w-0 items-center justify-between gap-1">
                  <h3 className="text-xl font-bold">Choose Payment Provider</h3>

                  <button
                    type="button"
                    onClick={() => setPoaProviderPopupOpen(false)}
                    className="rounded-full border-2 border-gray-300 p-1.5 transition-all duration-200 hover:border-blue-400 cursor-pointer"
                  >
                    <X color={"red"} size={14} strokeWidth={4} />
                  </button>
                </div>

                <p className="mt-3 text-sm text-gray-600">
                  Pay a holding deposit of {money(poaDepositAmount)} now. It is
                  a non-refundable deposit. The remaining balance will be paid
                  on arrival.
                </p>

                <div className="mt-6 grid gap-3">
                  <button
                    type="button"
                    onClick={selectPoaStripeDeposit}
                    className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left hover:border-blue-600"
                  >
                    <p className="text-lg font-bold text-blue-700">
                      Pay with Stripe
                    </p>

                    <p className="mt-1 text-sm text-blue-700">
                      Pay securely by card.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={selectPoaPaypalDeposit}
                    className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-left hover:border-yellow-500"
                  >
                    <p className="text-lg font-bold text-yellow-800">
                      Pay with PayPal
                    </p>

                    <p className="mt-1 text-sm text-yellow-800">
                      Pay using your PayPal account.
                    </p>
                  </button>

                  {hasLoggedInCustomer && (
                    <button
                      type="button"
                      onClick={selectPoaWalletDeposit}
                      disabled={!walletCanPayDeposit}
                      className={`rounded-xl border p-4 text-left ${
                        walletCanPayDeposit
                          ? "border-green-200 bg-green-50 hover:border-green-600"
                          : "cursor-not-allowed border-gray-200 bg-gray-50 opacity-70"
                      }`}
                    >
                      <p
                        className={`text-lg font-bold ${
                          walletCanPayDeposit
                            ? "text-green-700"
                            : "text-gray-500"
                        }`}
                      >
                        Pay with Wallet
                      </p>

                      <p
                        className={`mt-1 text-sm ${
                          walletCanPayDeposit
                            ? "text-green-700"
                            : "text-gray-500"
                        }`}
                      >
                        {walletLoading
                          ? "Checking wallet balance..."
                          : walletError
                          ? walletError
                          : !walletIsActive
                          ? "Your wallet is not active."
                          : walletBalance < poaDepositAmount
                          ? `Insufficient wallet balance. Available: ${money(
                              walletBalance
                            )}. Required: ${money(poaDepositAmount)}.`
                          : `Available balance: ${money(walletBalance)}.`}
                      </p>
                    </button>
                  )}
                </div>
              </BoxCard>
            </div>
          </div>
        )}
      </BoxCard>
    );
  }

  if (!selectedSchedule) {
    return (
      <>
        <Navbar />
        <main className="h-auto w-full overflow-x-hidden bg-white px-2 py-4 sm:px-3">
          {/* <p className="mx-auto mb-5 max-w-5xl text-center text-sm text-gray-600 md:text-base">
            We recommend choosing a shuttle at least 30 minutes before your final
            cruise check-in time to ensure you arrive comfortably and on time.
          </p> */}

          <div className="mx-auto w-full max-w-6xl min-w-0 rounded-xl border border-blue-100 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-4 grid min-w-0 gap-3 lg:grid-cols-[90px_minmax(0,1fr)_220px] lg:items-center lg:gap-4">
              <div className="text-gray-600">
                <label className="block text-sm">Show</label>

                <select
                  value={entriesPerPage}
                  onChange={(e) => {
                    setEntriesPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm outline-none focus:border-[#1c6de0]"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>

                <div className="mt-1 text-xs">entries</div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollShipFilters("left")}
                    aria-label="Scroll ship filters left"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white text-[#1c6de0] transition hover:border-[#1c6de0] hover:bg-blue-50"
                  >
                    <ChevronLeft size={16} strokeWidth={2.5} />
                  </button>

                  <div
                    ref={shipFilterRef}
                    className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    style={{
                      msOverflowStyle: "none",
                      scrollbarWidth: "none",
                    }}
                  >
                    {availableShipNames.map((shipName) => {
                      const active =
                        normalizeShipName(selectedShip) ===
                        normalizeShipName(shipName);

                      return (
                        <button
                          key={normalizeShipName(shipName)}
                          type="button"
                          onClick={() => {
                            setSelectedShip((currentShip) =>
                              normalizeShipName(currentShip) ===
                              normalizeShipName(shipName)
                                ? ""
                                : shipName
                            );
                            setSearch("");
                            setCurrentPage(1);
                          }}
                          className={`m-0 h-7 shrink-0 whitespace-nowrap rounded-lg border px-[5px] py-[2px] text-[12px] font-semibold leading-none transition ${
                            active
                              ? "border-[#1c6de0] bg-[#1c6de0] text-white shadow-sm"
                              : "border-blue-200 bg-white text-[#1c6de0] hover:border-[#1c6de0] hover:bg-blue-50"
                          }`}
                        >
                          {shipName}
                        </button>
                      );
                    })}

                    {scheduleLoaded &&
                      !scheduleLoading &&
                      availableShipNames.length === 0 && (
                      <span className="m-0 h-7 shrink-0 whitespace-nowrap rounded-lg border border-gray-200 bg-gray-50 px-[5px] py-[2px] text-[12px] leading-6 text-gray-500">
                        No ships available
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollShipFilters("right")}
                    aria-label="Scroll ship filters right"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white text-[#1c6de0] transition hover:border-[#1c6de0] hover:bg-blue-50"
                  >
                    <ChevronRight size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search ship or date"
                  className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#1c6de0]"
                />
              </div>
            </div>

            <div className="w-full min-w-0 overflow-hidden">
              <table className="w-full table-fixed border-collapse text-left text-[11px] sm:text-sm">
                <thead>
                  <tr className="border bg-white text-gray-900">
                    <th
                      onClick={() => handleSort("schedule_name")}
                      className="w-[25%] cursor-pointer border px-1.5 py-2.5 font-bold sm:px-3"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-1">
                        Ship Name
                        <span className="text-gray-300">↕</span>
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort("departure_date")}
                      className="w-[25%] cursor-pointer border px-1.5 py-2.5 font-bold sm:px-3"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-1">
                        Ship Departure Date
                        <span className="text-gray-300">↕</span>
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort("return_date")}
                      className="w-[25%] cursor-pointer border px-1.5 py-2.5 font-bold sm:px-3"
                    >
                      <div className="flex items-center justify-between">
                        Ship Arrival Date
                        <span className="text-gray-300">↕</span>
                      </div>
                    </th>

                    <th className="w-[25%] border px-1.5 py-2.5 font-bold sm:px-3">
                      <div className="flex items-center justify-between">
                        Book
                        <span className="text-gray-300">↕</span>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {scheduleLoading &&
                    !scheduleLoaded &&
                    paginatedSchedules.length === 0 && (
                      <tr>
                        <td
                          className="border px-3 py-4 text-center text-sm font-semibold text-blue-700"
                          colSpan="4"
                        >
                          Please Wait Schedules Are Loading...
                        </td>
                      </tr>
                    )}

                  {scheduleLoaded &&
                    scheduleError &&
                    paginatedSchedules.length === 0 && (
                      <tr>
                        <td className="border px-3 py-3 text-red-600" colSpan="4">
                          Cruise schedules could not be loaded. Please refresh the page.
                        </td>
                      </tr>
                    )}

                  {scheduleLoaded &&
                    !scheduleError &&
                    paginatedSchedules.length === 0 && (
                      <tr>
                        <td className="border px-3 py-3" colSpan="4">
                          No cruise schedules found.
                        </td>
                      </tr>
                    )}

                  {paginatedSchedules.map((schedule, index) => (
                      <tr
                        key={schedule._id}
                        className={index % 2 === 0 ? "bg-gray-100" : "bg-white"}
                      >
                        <td className="break-words border px-1.5 py-3 text-gray-600 sm:px-3">
                          {getScheduleName(schedule)}
                        </td>

                        <td className="break-words border px-1.5 py-3 text-gray-600 sm:px-3">
                          {formatTableDate(schedule.departure_date)}
                        </td>

                        <td className="break-words border px-1.5 py-3 text-gray-600 sm:px-3">
                          {formatTableDate(schedule.return_date)}
                        </td>

                        <td className="border px-1 py-3 align-middle sm:px-3">
                          <div className="mx-auto flex w-full min-w-0 justify-center overflow-hidden [&_button]:max-w-full [&_button]:min-w-0 [&_button]:whitespace-normal [&_button]:px-1.5 [&_button]:py-2 [&_button]:text-[10px] sm:[&_button]:px-3 sm:[&_button]:text-sm">
                            <BookingButton
                              text={"Book Parking"}
                              onClick={() => handleSelectSchedule(schedule)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-gray-600">
                Showing{" "}
                {filteredSchedules.length === 0
                  ? 0
                  : (currentPage - 1) * entriesPerPage + 1}{" "}
                to{" "}
                {Math.min(
                  currentPage * entriesPerPage,
                  filteredSchedules.length
                )}{" "}
                of {filteredSchedules.length} entries
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="rounded border px-3 py-1 text-xs disabled:opacity-50"
                >
                  Previous
                </button>

                <span className="rounded border bg-blue-600 px-3 py-1 text-xs text-white">
                  {currentPage}
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  className="rounded border px-3 py-1 text-xs disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
   <main ref={bookingTopRef} className="h-auto w-full overflow-x-hidden px-3 py-6 sm:px-4 sm:py-10">
        <div className="mx-auto mb-5 flex w-full max-w-6xl min-w-0 items-center gap-2 rounded-md border-s-4 border-blue-400 bg-gray-400/10 px-2.5 py-3 shadow-md sm:gap-4 sm:px-5">
          <button
            type="button"
            onClick={goBackToScheduleList}
            aria-label="Back to cruise list"
            title="Back to cruise list"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pink-200 bg-white text-pink-500 shadow-sm transition hover:border-pink-400 hover:bg-pink-50 focus:outline-none focus:ring-2 focus:ring-pink-300 sm:h-10 sm:w-10"
          >
            <MoveLeft size={19} strokeWidth={2.5} />
          </button>

          <div className="grid min-w-0 flex-1 grid-cols-4 gap-1 sm:gap-3">
            {[
              "Selected Cruise",
              "Shuttle Details",
              "Customer Details",
              "Review Booking",
            ].map((label, index) => {
              const step = index + 1;
              const active = currentStep === step;
              const completed = currentStep > step;

              return (
                <div key={label} className="min-w-0 text-center">
                  <div
                    className={`mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs sm:mb-2 sm:text-sm ${
                      active
                        ? "border-blue-600 text-blue-600"
                        : completed
                        ? "border-green-500 text-green-600"
                        : "border-gray-300 text-gray-500"
                    }`}
                  >
                    {step}
                  </div>

                  <div
                    className={`break-words text-[9px] font-medium leading-tight sm:text-xs md:text-sm ${
                      active
                        ? "text-blue-600"
                        : completed
                        ? "text-green-600"
                        : "text-gray-600"
                    }`}
                  >
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl min-w-0">
          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
            <section
              className={`min-w-0 ${currentStep > 3 && "-mt-7"} ${
                currentStep < 4 &&
                "p-5 h-auto rounded-md border-t-4 border-green-400 shadow-md bg-gray-400/10"
              }`}
            >
              {currentStep === 1 && (
                <div className="mt-8 space-y-6">
                  <div>
                    <label className="text-sm text-gray-600">
                      Ship Departure Date
                    </label>
                    <Input
                      value={formatTableDate(selectedSchedule.departure_date)}
                      readOnly={true}
                      Icon={<CalendarCheck />}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">
                      Ship Arrival Date
                    </label>
                    <Input
                      value={formatTableDate(selectedSchedule.return_date)}
                      readOnly={true}
                      Icon={<CalendarCheck />}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">
                      Selected Car Park
                    </label>
                    <Input
                      value={getLocationName(selectedSchedule)}
                      readOnly={true}
                      Icon={<SquareParking />}
                    />
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={form.add_on_vehicle_enabled}
                        onChange={(e) =>
                          updateField(
                            "add_on_vehicle_enabled",
                            e.target.checked
                          )
                        }
                        className="mt-1 h-4 w-4"
                      />

                      <span className="flex-1">
                        <span className="flex flex-wrap items-center gap-2 font-semibold text-gray-800">
                          Add On Vehicle
                          <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700 ring-1 ring-green-200">
                            {ADD_ON_VEHICLE_DISCOUNT_PERCENT}% Discount
                          </span>
                        </span>
                        <span className="mt-1 block text-sm text-gray-500">
                          Add one extra vehicle for the same cruise parking
                          period with a discounted price.
                        </span>
                      </span>
                    </label>

                    {form.add_on_vehicle_enabled && (
                      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px] md:items-end">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            Select Vehicle
                          </label>
                          <select
                            value={form.add_on_vehicle_type}
                            onChange={(e) =>
                              updateField("add_on_vehicle_type", e.target.value)
                            }
                            className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
                          >
                            <option value="">Select vehicle</option>
                            {ADD_ON_VEHICLE_OPTIONS.map((vehicleName) => (
                              <option key={vehicleName} value={vehicleName}>
                                {vehicleName}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                          <p className="font-semibold">Add-on price</p>
                          <p className="mt-1">
                            {money(addOnVehiclePrice)}
                            <span className="ml-1 text-xs text-green-600">
                              saved {money(addOnVehicleDiscountAmount)}
                            </span>
                          </p>
                        </div> */}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <NavigationButton text="Next Step" onClick={goNext} />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="mt-8 space-y-6">
                  <Div>
                    <div className="rounded-lg w-full p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Car Park</p>
                          <p className="font-medium">
                            {getLocationName(selectedSchedule)}
                          </p>
                          {/* <p className="mt-1 text-xs text-gray-500">
                            Both shuttle directions are required.
                          </p> */}
                        </div>
                        <p className="font-semibold">{money(originalPrice)}</p>
                      </div>
                    </div>
                  </Div>

                  {cruiseShuttleLoading && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                      Loading cruise shuttle slots...
                    </div>
                  )}

                  {cruiseShuttleError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {cruiseShuttleError}
                    </div>
                  )}

                  {!cruiseShuttleLoading &&
                    !cruiseShuttleError &&
                    activeShuttleSlots.length === 0 && (
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                        No shuttle slots are available for this cruise schedule.
                      </div>
                    )}

                  {!cruiseShuttleLoading &&
                    !cruiseShuttleError &&
                    carParkToTerminalShuttleSlots.length === 0 && (
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                        No Car park to terminal shuttle slots are enabled in
                        Admin Settings.
                      </div>
                    )}

                  {!cruiseShuttleLoading &&
                    !cruiseShuttleError &&
                    terminalToCarParkShuttleSlots.length === 0 && (
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                        No Terminal to car park shuttle slots are enabled in
                        Admin Settings.
                      </div>
                    )}

                  {renderShuttleDirectionSelector("carParkToTerminal")}
                  {renderShuttleDirectionSelector("terminalToCarPark")}

                  {extraPassengerFee > 0 && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                      <p className="font-semibold">Extra Passenger Fee</p>
                      <p className="mt-1">
                        {extraPassengerCount} extra passenger(s) ×{" "}
                        {money(EXTRA_PASSENGER_FEE)} ={" "}
                        <strong>{money(extraPassengerFee)}</strong>
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <NavigationButton
                      text="Back"
                      direction="reverse"
                      onClick={goPrevious}
                    />
                    <NavigationButton text="Next Step" onClick={goNext} />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="mt-8 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      type={"text"}
                      placeholder="First Name*"
                      value={form.first_name}
                      onChange={(e) => updateField("first_name", e.target.value)}
                      Icon={<User />}
                      label={"First Name"}
                    />

                    <Input
                      type={"text"}
                      placeholder="Last Name*"
                      value={form.last_name}
                      onChange={(e) => updateField("last_name", e.target.value)}
                      label={"Last Name"}
                    />

                    <div>
                      <Input
                        type="email"
                        placeholder={
                          customerAccountLoading
                            ? "Loading account email..."
                            : "Email*"
                        }
                        value={
                          hasLoggedInCustomer
                            ? lockedCustomerEmail
                            : form.email
                        }
                        onChange={(e) =>
                          updateField("email", e.target.value)
                        }
                        readOnly={hasLoggedInCustomer}
                        disabled={
                          hasLoggedInCustomer && customerAccountLoading
                        }
                        aria-readonly={hasLoggedInCustomer}
                        Icon={<Mail />}
                        label={
                          hasLoggedInCustomer
                            ? "Email (logged-in account)"
                            : "Email"
                        }
                      />

                      {hasLoggedInCustomer && (
                        <p className="mt-1 text-xs text-gray-500">
                          This booking will use your logged-in account email.
                        </p>
                      )}
                    </div>

                    <Input
                      placeholder="Phone Number*"
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      Icon={<Phone />}
                      label={"Phone"}
                    />

                    <div className="md:col-span-2">
                      <Input
                        type={"text"}
                        placeholder="License Plate*"
                        value={form.license_plate}
                        onChange={(e) =>
                          updateField("license_plate", e.target.value)
                        }
                        Icon={<Bandage />}
                        required={true}
                        label={"License Plate*"}
                      />
                    </div>

                    {form.add_on_vehicle_enabled && (
                      <div className="md:col-span-2">
                        <Input
                          type={"text"}
                          placeholder={`${
                            form.add_on_vehicle_type || "Add On Vehicle"
                          } License Plate*`}
                          value={form.add_on_vehicle_license_plate}
                          onChange={(e) =>
                            updateField(
                              "add_on_vehicle_license_plate",
                              e.target.value
                            )
                          }
                          Icon={<Bandage />}
                          required={true}
                          label={`${
                            form.add_on_vehicle_type || "Add On Vehicle"
                          } License Plate*`}
                        />
                      </div>
                    )}
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.interlock}
                      onChange={(e) =>
                        updateField("interlock", e.target.checked)
                      }
                    />
                    Interlock fitted vehicle
                  </label>

                  <h3
                    className="text-gray-600 text-md pl-0.5 inline-block"
                    style={{ marginBottom: 0 }}
                  >
                    How did you hear about us?*
                  </h3>

                  <SelectOption
                    placeholder="select a source"
                    options={sourceOptions}
                    value={form.source}
                    onChange={(e) => updateField("source", e)}
                    selectIcon={<LayoutGrid />}
                  />

                  <TextArea
                    placeholder="Vehicle Type/Other Info"
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    Icon={<FileText />}
                    rows={5}
                    label={"Vehicle Type/Other Info"}
                  />

                  <div className="flex justify-between">
                    <NavigationButton
                      text="Back"
                      onClick={goPrevious}
                      direction="reverse"
                    />
                    <NavigationButton text="Review Booking" onClick={goNext} />
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="mt-8 space-y-6">
                  <div className="rounded-xl">
                    <BoxCard>
                      <h2 className="text-xl font-semibold mb-5">
                        Review Booking
                      </h2>
                      <div className="grid gap-3 text-sm md:grid-cols-2">
                        {reviewData.map((data, index) => (
                          <TextCard key={index} data={data} />
                        ))}
                      </div>
                    </BoxCard>

                    <div className="flex flex-col md:flex-row justify-between gap-5">
                      <BoxCard>
                        <h3 className="font-semibold">Coupon</h3>
                        <div className="mt-3 flex flex-col gap-3">
                          <Input
                            value={form.coupon_code}
                            onChange={(e) =>
                              updateField(
                                "coupon_code",
                                e.target.value.toUpperCase()
                              )
                            }
                            placeholder="ENTER COUPON CODE"
                          />

                          {!coupon ? (
                            <button
                              type="button"
                              onClick={handleApplyCoupon}
                              disabled={couponLoading}
                              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60 w-full"
                            >
                              {couponLoading ? "Applying..." : "Apply Coupon"}
                            </button>
                          ) : (
                            <BookingButton
                              text={"Remove"}
                              onClick={handleRemoveCoupon}
                            />
                          )}
                        </div>

                        {coupon && (
                          <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                            Coupon{" "}
                            <strong>{coupon.code || coupon.coupon_code}</strong>{" "}
                            applied. You saved{" "}
                            <strong>{money(coupon.discount_amount)}</strong>.
                          </p>
                        )}
                      </BoxCard>

                      <BoxCard>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Parking Subtotal</span>
                            <strong>{money(originalPrice)}</strong>
                          </div>

                          {addOnVehicleEnabled && (
                            <div className="flex justify-between text-green-700">
                              <span>
                                Add On Vehicle ({ADD_ON_VEHICLE_DISCOUNT_PERCENT}%
                                off)
                              </span>
                              <strong>{money(addOnVehiclePrice)}</strong>
                            </div>
                          )}

                          <div className="flex justify-between">
                            <span>Extra Passenger Fee</span>
                            <strong>{money(extraPassengerFee)}</strong>
                          </div>

                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <strong>{money(priceBeforeDiscount)}</strong>
                          </div>

                          <div className="flex justify-between text-green-700">
                            <span>Discount</span>
                            <strong>-{money(discountAmount)}</strong>
                          </div>

                          <div className="border-t pt-3 text-lg font-bold">
                            <div className="flex justify-between">
                              <span>Total</span>
                              <span>{money(finalPrice)}</span>
                            </div>
                          </div>
                        </div>
                      </BoxCard>
                    </div>

                    {renderPaymentMethodSelector()}
                  </div>

                  <div className="flex justify-between">
                    <NavigationButton
                      text="Back"
                      onClick={goPrevious}
                      direction="reverse"
                    />

                    <PaymentButton
                      text={getFinalButtonLabel()}
                      onClick={handleCreateBooking}
                    />
                  </div>
                </div>
              )}
            </section>

            <aside className="min-w-0 rounded-2xl bg-blue-50 p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-gray-700">Booking Dates</h2>

              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <span className="rounded-lg bg-black px-3 py-2 text-sm font-bold text-white">
                    Ship Departure
                  </span>
                  <span className="ml-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold">
                    {formatTableDate(selectedSchedule.departure_date)}
                  </span>
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <span className="rounded-lg bg-black px-3 py-2 text-sm font-bold text-white">
                    Ship Arrival
                  </span>
                  <span className="ml-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold">
                    {formatTableDate(selectedSchedule.return_date)}
                  </span>
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-semibold">Selected Car Park</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {getLocationName(selectedSchedule)}
                  </p>
                </div>

                {/* {addOnVehicleEnabled && (
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="font-semibold">Add On Vehicle</p>
                    <p className="mt-1 text-sm text-gray-600">
                      Vehicle: {form.add_on_vehicle_type || "Not selected"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Price: {money(addOnVehiclePrice)} ({ADD_ON_VEHICLE_DISCOUNT_PERCENT}%
                      discount)
                    </p>
                  </div>
                )} */}

                {cruisePriceLoading && (
                  <div className="rounded-xl bg-white p-4 text-sm text-blue-700 shadow-sm">
                    Loading cruise price...
                  </div>
                )}

                {cruisePriceError && (
                  <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                    {cruisePriceError}
                  </div>
                )}

                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-semibold">Car park to terminal</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Passengers: {form.car_park_to_terminal_passengers || 0}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Shuttle:{" "}
                    {form.car_park_to_terminal_shuttle_time ||
                      "No shuttle selected"}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-semibold">Terminal to car park</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Passengers: {form.terminal_to_car_park_passengers || 0}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Shuttle:{" "}
                    {form.terminal_to_car_park_shuttle_time ||
                      "No shuttle selected"}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-semibold">Price Summary</p>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Price For</span>
                      <span>{cruiseDays}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Parking Subtotal</span>
                      <span>{money(originalPrice)}</span>
                    </div>

                    {addOnVehicleEnabled && (
                      <div className="flex justify-between text-green-700">
                        <span>
                          Add On Vehicle ({ADD_ON_VEHICLE_DISCOUNT_PERCENT}%
                          off)
                        </span>
                        <span>{money(addOnVehiclePrice)}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>Extra Passenger Fee</span>
                      <span>{money(extraPassengerFee)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{money(priceBeforeDiscount)}</span>
                    </div>

                    <div className="flex justify-between text-green-700">
                      <span>Discount</span>
                      <span>-{money(discountAmount)}</span>
                    </div>

                    <div className="border-t pt-2 text-base font-bold">
                      <div className="flex justify-between">
                        <span>Total</span>
                        <span>{money(finalPrice)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {mounted && hasLoggedInCustomer && (
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="font-semibold">Wallet</p>
                    <p className="mt-1 text-sm text-gray-600">
                      Balance: {money(walletBalance)}
                    </p>
                  </div>
                )}

                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-semibold">Payment</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {getSelectedPaymentLabel()}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}