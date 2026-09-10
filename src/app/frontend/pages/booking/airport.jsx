"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";

import axios from "@/app/frontend/utils/axios";
import { useBookingStore } from "@/app/frontend/store/bookingStore";
import { useLocationStore } from "@/app/frontend/store/locationStore";
import { useCouponStore } from "@/app/frontend/store/couponStore";

import {
  GoogleIcon,
  FacebookIcon,
  InstagramIcon,
} from "../../component/global/CustomIcon";

import {
  User,
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
  X,
  MapPin,
} from "lucide-react";

import TextCard from "../../component/global/TextCard";
import Div from "../../component/global/Div";
import SelectOption from "../../component/global/SelectOption";
import BookingButton from "../../component/global/BookingButton";
import NavigationButton from "../../component/global/NavigationButton";
import Input from "../../component/global/Input";
import TextArea from "../../component/global/TextArea";
import PaymentButton from "../../component/global/PaymentButton";
import BoxCard from "../../component/global/BoxCard";
import Navbar from "../../component/global/NavBar";
import Footer from "../../component/global/Footer";

const HOLDING_DEPOSIT_AMOUNT = 20;
const CHECKOUT_DRAFT_API_URL = "/bookings/checkout-drafts";
const STRIPE_PAYMENT_PAGE_URL = "/booking/payment";
const PAYPAL_PAYMENT_PAGE_URL = "/booking/paypal";

const steps = ["Location", "Dates", "Customer Details", "Review Booking"];

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

function formatDateInput(date) {
  const value = parseLocalDate(date);

  if (!value) return "";

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateInput, days) {
  const date = parseLocalDate(dateInput);

  if (!date) return null;

  date.setDate(date.getDate() + days);

  return date;
}

function formatDisplayDate(dateString) {
  const date = parseLocalDate(dateString);

  if (!date) return "-";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function normalizeDateKey(value) {
  return formatDateInput(value);
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

  // Airport uses inclusive calendar-day counting:
  // 09 -> 09 = 1 day
  // 04 -> 05 = 2 days
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

export default function AirportBookingPage() {
  const router = useRouter();

  const { createBooking, loading: bookingLoading } = useBookingStore();
  const { locations, fetchLocations } = useLocationStore();

  const {
    coupon,
    loading: couponLoading,
    validateCoupon,
    clearCoupon,
  } = useCouponStore();

  const [mounted, setMounted] = useState(false);
  const [loggedInCustomer, setLoggedInCustomer] = useState(null);
  const [customerAccountLoading, setCustomerAccountLoading] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [showShuttleOptions, setShowShuttleOptions] = useState(false);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeDateField, setActiveDateField] = useState("entry");
  const [calendarMessage, setCalendarMessage] = useState("");

  const [paymentProviderPopupOpen, setPaymentProviderPopupOpen] =
    useState(false);
  const [poaProviderPopupOpen, setPoaProviderPopupOpen] = useState(false);

  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");

  const [airportPriceRule, setAirportPriceRule] = useState(null);
  const [airportPriceLoading, setAirportPriceLoading] = useState(false);
  const [airportPriceError, setAirportPriceError] = useState("");

  const [airportShuttleSlots, setAirportShuttleSlots] = useState([]);
  const [airportShuttleLoading, setAirportShuttleLoading] = useState(false);
  const [airportShuttleError, setAirportShuttleError] = useState("");
  const [checkoutDraftLoading, setCheckoutDraftLoading] = useState(false);

  const [form, setForm] = useState({
    type: "airport",

    location_id: "",

    start_date: "",
    end_date: "",

    needs_shuttle: false,
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

    coupon_code: "",

    payment_flow: "",
    payment_method: "",
    deposit_type: "",
    holding_deposit_amount: 0,
  });

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

        const customer = normalizeAuthenticatedCustomer(res.data);

        if (!customer || !active) {
          throw new Error("Authenticated customer email was not returned.");
        }

        localStorage.setItem("user", JSON.stringify(customer));
        applyCustomer(customer);
      } catch {
        /*
         * Keep the cached account when it exists. When no verified account
         * email is available, step validation blocks checkout instead of
         * accepting a different email for the logged-in customer.
         */
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
    fetchLocations("airport").catch((error) => {
      alert(error.message);
    });
  }, [fetchLocations]);

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
    if (!selectedLocation?.show_shuttle_options) {
      return [];
    }

    return airportShuttleSlots.filter(
      (slot) => slot && slot.type === "airport" && slot.is_active !== false
    );
  }, [selectedLocation, airportShuttleSlots]);

  const hasAirportShuttleOptions =
    Boolean(selectedLocation?.show_shuttle_options) &&
    activeShuttleSlots.length > 0;

  const originalPrice = useMemo(() => {
    return Number(airportPriceRule?.price || 0);
  }, [airportPriceRule]);

  const discountAmount = Number(coupon?.discount_amount || 0);

  const finalPrice = coupon
    ? Number(coupon.final_price || originalPrice)
    : originalPrice;

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
    async function fetchAirportPriceRule() {
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
              "Failed to load airport price"
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

    fetchAirportPriceRule();
  }, [selectedLocation, estimatedDays]);

  useEffect(() => {
    async function fetchAirportShuttleSlots() {
      try {
        setAirportShuttleSlots([]);
        setAirportShuttleError("");
        setShowShuttleOptions(false);

        setForm((prev) => ({
          ...prev,
          shuttle_slot_id: "",
          shuttle_time: "",
        }));

        if (!selectedLocation?.show_shuttle_options) {
          return;
        }

        if (!form.start_date) {
          return;
        }

        setAirportShuttleLoading(true);

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
              "Failed to load shuttle slots"
          );
        }

        const rawSlots =
          res.data.data?.available_shuttle_slots ||
          res.data.data?.shuttle_time_slots ||
          [];

        setAirportShuttleSlots(normalizeAirportShuttleSlots(rawSlots));
      } catch (error) {
        setAirportShuttleSlots([]);
        setAirportShuttleError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Airport shuttle slots could not be loaded."
        );
      } finally {
        setAirportShuttleLoading(false);
      }
    }

    fetchAirportShuttleSlots();
  }, [selectedLocation, form.start_date]);

  useEffect(() => {
    if (hasAirportShuttleOptions) {
      setForm((prev) => ({
        ...prev,
        needs_shuttle: true,
        pax: Number(prev.pax || 0) >= 1 ? prev.pax : 1,
      }));

      return;
    }

    setShowShuttleOptions(false);

    setForm((prev) => ({
      ...prev,
      needs_shuttle: false,
      pax: 1,
      shuttle_slot_id: "",
      shuttle_time: "",
    }));
  }, [hasAirportShuttleOptions]);

  function resetPaymentSelection() {
    setPaymentProviderPopupOpen(false);
    setPoaProviderPopupOpen(false);

    setForm((prev) => ({
      ...prev,
      payment_flow: "",
      payment_method: "",
      deposit_type: "",
      holding_deposit_amount: 0,
    }));
  }

  function updateField(name, value) {
    if (name === "email" && hasLoggedInCustomer) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (
      name === "coupon_code" ||
      name === "location_id" ||
      name === "start_date" ||
      name === "end_date"
    ) {
      clearCoupon();
    }

    if (name === "location_id" || name === "start_date" || name === "end_date") {
      resetPaymentSelection();
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
    if (checkoutDraftLoading) return "Preparing Payment...";

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

  function handleLocationChange(value) {
    clearCoupon();
    setShowShuttleOptions(false);
    setCalendarOpen(false);
    setCalendarMessage("");
    setPaymentProviderPopupOpen(false);
    setPoaProviderPopupOpen(false);
    setAirportPriceRule(null);
    setAirportPriceError("");
    setAirportShuttleSlots([]);
    setAirportShuttleError("");

    setForm((prev) => ({
      ...prev,
      location_id: value,
      start_date: "",
      end_date: "",
      needs_shuttle: false,
      pax: 1,
      shuttle_slot_id: "",
      shuttle_time: "",
      coupon_code: "",
      payment_flow: "",
      payment_method: "",
      deposit_type: "",
      holding_deposit_amount: 0,
    }));
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
          coupon_code: "",
          payment_flow: "",
          payment_method: "",
          deposit_type: "",
          holding_deposit_amount: 0,
        };
      });

      setShowShuttleOptions(false);
      clearCoupon();
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
        coupon_code: "",
        payment_flow: "",
        payment_method: "",
        deposit_type: "",
        holding_deposit_amount: 0,
      }));

      clearCoupon();
      setCalendarOpen(false);
      setCalendarMessage("");
    }
  }

  function handlePassengerChange(value) {
    const passengerCount = Number(value || 0);

    setForm((prev) => {
      let shouldClearShuttle = passengerCount < 1;

      if (
        passengerCount >= 1 &&
        prev.shuttle_slot_id &&
        activeShuttleSlots.length > 0
      ) {
        const selectedSlot = activeShuttleSlots.find(
          (slot) => String(getSlotId(slot)) === String(prev.shuttle_slot_id)
        );

        if (selectedSlot) {
          const remaining = getSlotRemaining(selectedSlot);

          if (remaining < passengerCount) {
            shouldClearShuttle = true;
          }
        }
      }

      return {
        ...prev,
        pax: value,
        shuttle_slot_id: shouldClearShuttle ? "" : prev.shuttle_slot_id,
        shuttle_time: shouldClearShuttle ? "" : prev.shuttle_time,
      };
    });

    if (passengerCount < 1) {
      setShowShuttleOptions(false);
    }
  }

  function handleSeeShuttleOptions() {
    if (airportShuttleLoading) {
      alert("Please wait while shuttle options are loading.");
      return;
    }

    if (!selectedLocation) {
      alert("Please select location first.");
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

    if (!hasAirportShuttleOptions) {
      alert(
        airportShuttleError ||
          "This airport does not have shuttle options available for the selected entry date."
      );
      return;
    }

    const passengerCount = Number(form.pax || 0);

    if (passengerCount < 1) {
      alert("Please enter passengers at least 1.");
      return;
    }

    setShowShuttleOptions(true);
  }

  function handleClearShuttle() {
    setShowShuttleOptions(false);

    setForm((prev) => ({
      ...prev,
      needs_shuttle: hasAirportShuttleOptions,
      pax: hasAirportShuttleOptions ? prev.pax || 1 : 1,
      shuttle_slot_id: "",
      shuttle_time: "",
    }));
  }

  function validateStep(step) {
    if (step === 1) {
      if (!form.location_id) {
        alert("Please select an airport parking location.");
        return false;
      }
    }

    if (step === 2) {
      if (!form.start_date || !form.end_date) {
        alert("Please select entry date and exit date.");
        return false;
      }

      const startDate = parseLocalDate(form.start_date);
      const endDate = parseLocalDate(form.end_date);

      if (!startDate || !endDate) {
        alert("Invalid date format.");
        return false;
      }

      if (endDate < startDate) {
        alert("Exit date cannot be before entry date.");
        return false;
      }

      if (blockedDateConflict) {
        alert(blockedDateConflict);
        return false;
      }

      if (estimatedDays < 1) {
        alert("Selected date range does not include any available booking days.");
        return false;
      }

      if (airportPriceLoading) {
        alert("Please wait while airport price is loading.");
        return false;
      }

      if (!airportPriceRule) {
        alert(
          airportPriceError ||
            `No airport price rule found for ${estimatedDays} day(s). Please add it from Settings.`
        );
        return false;
      }

      if (selectedLocation?.show_shuttle_options) {
        if (airportShuttleLoading) {
          alert("Please wait while shuttle options are loading.");
          return false;
        }

        if (!hasAirportShuttleOptions) {
          alert(
            airportShuttleError ||
              "No airport shuttle options are available for the selected entry date."
          );
          return false;
        }

        if (!form.pax || Number(form.pax) < 1) {
          alert("Please enter passengers at least 1 for shuttle.");
          return false;
        }

        if (!form.shuttle_time || !form.shuttle_slot_id) {
          alert("Please select a shuttle option.");
          return false;
        }

        const selectedSlot = activeShuttleSlots.find(
          (slot) => String(getSlotId(slot)) === String(form.shuttle_slot_id)
        );

        if (!selectedSlot) {
          alert("Selected shuttle option was not found. Please select again.");
          return false;
        }

        const remaining = getSlotRemaining(selectedSlot);

        if (remaining < Number(form.pax || 0)) {
          alert(
            `Selected shuttle option has only ${remaining} remaining seat(s). Please choose another time.`
          );
          return false;
        }
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

  async function handleApplyCoupon() {
    try {
      if (!form.coupon_code) {
        alert("Please enter coupon code.");
        return;
      }

      if (!form.location_id || !form.start_date || !form.end_date) {
        alert("Please select location and dates first.");
        return;
      }

      if (blockedDateConflict) {
        alert(blockedDateConflict);
        return;
      }

      if (!airportPriceRule) {
        alert(
          airportPriceError ||
            `No airport price rule found for ${estimatedDays} day(s). Please add it from Settings.`
        );
        return;
      }

      if (originalPrice <= 0) {
        alert("Price must be greater than 0 before applying coupon.");
        return;
      }

      resetPaymentSelection();

      const result = await validateCoupon({
        code: form.coupon_code,
        booking_type: "airport",
        amount: originalPrice,
      });

      alert(`Coupon applied. Discount: ${money(result.discount_amount)}`);
    } catch (error) {
      alert(error.message);
    }
  }

  function handleRemoveCoupon() {
    clearCoupon();

    setForm((prev) => ({
      ...prev,
      coupon_code: "",
      payment_flow: "",
      payment_method: "",
      deposit_type: "",
      holding_deposit_amount: 0,
    }));
  }

  async function createCheckoutDraft(payload) {
    const token = getToken();
    const amountDueNow =
      form.payment_flow === "poa_deposit"
        ? Number(form.holding_deposit_amount || poaDepositAmount)
        : finalPrice;

    const res = await axios.post(
      CHECKOUT_DRAFT_API_URL,
      {
        type: "airport",
        booking_payload: payload,
        payment_method: form.payment_method,
        payment_flow: form.payment_flow,
        deposit_type: form.deposit_type,
        currency: "aud",
        price: finalPrice,
        final_price: finalPrice,
        amount_due_now: amountDueNow,
        holding_deposit_amount:
          form.payment_flow === "poa_deposit" ? amountDueNow : 0,
        balance_due_on_arrival:
          form.payment_flow === "poa_deposit"
            ? Math.max(finalPrice - amountDueNow, 0)
            : 0,
        coupon_code: coupon?.code || coupon?.coupon_code || "",
        discount_amount: discountAmount,
      },
      {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
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
      res.data?.draftId ||
      res.data?.draft_id ||
      res.data?.checkoutDraftId ||
      res.data?.checkout_draft_id ||
      res.data?.data?.draft?.draft_reference ||
      res.data?.draft?.draft_reference ||
      "";

    if (!draftId) {
      throw new Error("Checkout draft ID was not returned.");
    }

    return {
      draftId,
      redirectUrl: res.data?.redirectUrl || res.data?.redirect_url || "",
    };
  }

  async function handleCreateBooking() {
    try {
      if (bookingLoading || checkoutDraftLoading) return;

      if (!validateStep(1)) return;
      if (!validateStep(2)) return;
      if (!validateStep(3)) return;

      if (originalPrice <= 0) {
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

      const hasShuttle = Boolean(
        selectedLocation?.show_shuttle_options &&
          hasAirportShuttleOptions &&
          form.shuttle_time
      );

      const payload = {
        type: "airport",

        location_id: form.location_id,
        start_date: form.start_date,
        end_date: form.end_date,

        shuttle_slot_id: hasShuttle
          ? form.shuttle_slot_id || undefined
          : undefined,
        shuttle_time: hasShuttle ? form.shuttle_time : undefined,
        pax: hasShuttle ? Number(form.pax || 1) : 0,

        details: {
          airport: {
            needs_shuttle: hasShuttle,
            shuttle_slot_id: hasShuttle
              ? form.shuttle_slot_id || undefined
              : undefined,
            shuttle_time: hasShuttle ? form.shuttle_time : undefined,
            pickup_pax: hasShuttle ? Number(form.pax || 1) : 0,
          },
        },

        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        name: `${form.first_name} ${form.last_name}`.trim(),
        email: effectiveCustomerEmail,
        phone: form.phone.trim(),

        license_plate: form.license_plate.trim(),
        interlock: Boolean(form.interlock),

        source: form.source,
        notes: form.notes,

        coupon_code: coupon?.code || coupon?.coupon_code || undefined,

        payment_flow: form.payment_flow,
        holding_deposit_amount: form.holding_deposit_amount,
        deposit_type: form.deposit_type,
        payment_method: form.payment_method,

        price_rule_id: airportPriceRule?._id,
        calculated_days: estimatedDays,
      };

      /**
       * Wallet creates the real booking immediately because wallet payment is
       * completed in the booking service transaction.
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
       * Stripe/PayPal must not create a real booking before payment.
       * They create a checkout draft first, then payment success creates BK...
       */
      if (isStripePayment || isPaypalPayment) {
        try {
          setCheckoutDraftLoading(true);

          const { draftId, redirectUrl } = await createCheckoutDraft(payload);

          clearCoupon();

          if (isStripePayment) {
            router.push(
              redirectUrl ||
                `${STRIPE_PAYMENT_PAGE_URL}?draftId=${encodeURIComponent(
                  draftId
                )}`
            );
            return;
          }

          router.push(
            `${PAYPAL_PAYMENT_PAGE_URL}?draftId=${encodeURIComponent(draftId)}`
          );
          return;
        } finally {
          setCheckoutDraftLoading(false);
        }
      }

      alert("Invalid payment method selected.");
    } catch (error) {
      alert(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error.message ||
          "Booking could not be created."
      );
    }
  }

  function renderPaymentMethodSelector() {
    const isOnlineSelected = form.payment_flow === "full_online";
    const isPoaDepositSelected = form.payment_flow === "poa_deposit";

    return (
      <BoxCard>
        <div>
          <h3 className="font-semibold">Payment Method</h3>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setPaymentProviderPopupOpen(true)}
              className={`rounded-lg border-2 p-4 text-left ${
                isOnlineSelected
                  ? "border-blue-500 bg-blue-100"
                  : "border-gray-300 bg-white"
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
  {/* Top right notification */}
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
      <p className="text-lg font-semibold">
        Pay on Arrival
      </p>

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
                charged now to secure your spot and it's non-refundable deposit. The remaining balance will be
                paid on arrival.
              </p>
            </div>
          )}

          {form.payment_flow && (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
              Selected: <strong>{getSelectedPaymentLabel()}</strong>
            </div>
          )}

          {paymentProviderPopupOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-md">
                <BoxCard bgWhite={true}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">
                      Choose Payment Provider
                    </h3>

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
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">
                      Choose Payment Provider
                    </h3>

                    <button
                      type="button"
                      onClick={() => setPoaProviderPopupOpen(false)}
                      className="rounded-full border-2 border-gray-300 p-1 transition-all duration-200 hover:border-blue-400 cursor-pointer"
                    >
                      <X size={14} color="red" strokeWidth={4} />
                    </button>
                  </div>

                  <p className="mt-3 text-sm text-gray-600">
                    Pay a holding deposit of {money(poaDepositAmount)} now and it's non-refundable deposit
. The
                    remaining balance will be paid on arrival.
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
        </div>
      </BoxCard>
    );
  }

  const reviewData = [
    { key: "Location", value: selectedLocation?.name || "-" },
    {
      key: "Shuttle",
      value: selectedLocation?.show_shuttle_options
        ? form.shuttle_time || "Required - not selected"
        : "No shuttle",
    },
    {
      key: "Shuttle Passengers",
      value: selectedLocation?.show_shuttle_options ? form.pax || "-" : "No shuttle",
    },
    { key: "Entry Date", value: formatDisplayDate(form.start_date) },
    { key: "Exit Date", value: formatDisplayDate(form.end_date) },
{ 
  key: "Price for", 
  value: `${estimatedDays} ${estimatedDays === 1 ? "day" : "days"}`
},

    { key: "Name", value: form.first_name + " " + form.last_name },
    { key: "Email", value: effectiveCustomerEmail || "-" },
    { key: "Phone", value: form.phone },
    { key: "License Plate", value: form.license_plate },
    { key: "Interlock", value: form.interlock ? "Yes" : "No" },
    { key: "Source", value: form.source },
    { key: "Vehicle Info", value: form.notes || "-" },
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen w-full overflow-x-hidden bg-gray-50 px-3 py-6 sm:px-4 sm:py-10">
      <div className="mx-auto mb-5 flex w-full max-w-6xl min-w-0 items-center gap-2 rounded-md border-s-4 border-blue-400 bg-gray-400/10 px-2.5 py-3 shadow-md sm:gap-4 sm:px-5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back to airport parking list"
          title="Back to airport parking list"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pink-200 bg-white text-pink-500 shadow-sm transition hover:border-pink-400 hover:bg-pink-50 focus:outline-none focus:ring-2 focus:ring-pink-300 sm:h-10 sm:w-10"
        >
          <MoveLeft size={19} strokeWidth={2.5} />
        </button>

        <div className="grid min-w-0 flex-1 grid-cols-4 gap-1 sm:gap-3">
          {steps.map((label, index) => {
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
                    Airport Parking Location
                  </label>

                  <SelectOption
                    value={form.location_id}
                    isBackupPlaceholder={true}
                    onChange={(e) => handleLocationChange(e)}
                    placeholder="Select airport parking location"
                    optionIcon={<MapPin />}
                    selectIcon={<MapPin />}
                    options={locations}
                  />
                </div>

                {selectedLocation && (
                  <Div>
                    <div className="flex items-center justify-between w-full p-3">
                      <div>
                        <p className="text-sm text-gray-600">
                          Selected Location
                        </p>
                        <p className="font-medium">{selectedLocation.name}</p>

                        <p className="mt-1 text-xs text-gray-500">
                          Price is calculated from Settings after selecting
                          entry and exit dates.
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold">Shuttle Options</p>

                        <p
                          className={`mt-1 rounded-full px-3 py-1 text-xs font-semibold ${
                            selectedLocation.show_shuttle_options
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {selectedLocation.show_shuttle_options
                            ? "Enabled"
                            : "Not enabled"}
                        </p>
                      </div>
                    </div>
                  </Div>
                )}

                <div className="flex justify-end">
                  <NavigationButton text="Next Step" onClick={goNext} />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="mt-8 space-y-6">
                <div className="relative">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Entry Date
                      </label>

                      <Div isPadding={false}>
                        <button
                          type="button"
                          onClick={() => openDatePopup("entry")}
                          className={`w-full text-left px-3 py-2 h-full ${
                            activeDateField === "entry" && calendarOpen
                              ? "bg-blue-300"
                              : "bg-white"
                          }`}
                        >
                          {form.start_date
                            ? formatDisplayDate(form.start_date)
                            : "Select date"}
                        </button>
                      </Div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Exit Date
                      </label>

                      <Div isPadding={false}>
                        <button
                          type="button"
                          onClick={() => openDatePopup("exit")}
                          disabled={!form.start_date}
                          className={`w-full px-3 py-2 text-left ${
                            !form.start_date
                              ? "cursor-not-allowed text-gray-400"
                              : activeDateField === "exit" && calendarOpen
                              ? "bg-blue-300"
                              : "bg-white"
                          }`}
                        >
                          {form.end_date
                            ? formatDisplayDate(form.end_date)
                            : "Select date"}
                        </button>
                      </Div>

                      {form.start_date && (
                        <p className="mt-1 text-xs text-gray-500">
                          Same-day booking is allowed. Entry and exit dates are both counted.
                        </p>
                      )}
                    </div>
                  </div>

                  {calendarOpen && (
                    <div
                      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 px-3 py-4 sm:px-4"
                      onClick={() => {
                        setCalendarOpen(false);
                        setCalendarMessage("");
                      }}
                    >
                      <div
                        className="w-full max-w-[360px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl">
                          <BoxCard bgWhite={true} padding={"p-3"}>
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">
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
                              className="rounded-full border-2 border-gray-300 transition-all duration-200 hover:border-blue-400 p-1 cursor-pointer"
                            >
                              <X size={14} color="red" strokeWidth={4} />
                            </button>
                          </div>

                          <div className="flex w-full justify-center overflow-hidden">
                            <DayPicker
                              mode="single"
                              selected={selectedCalendarDate || undefined}
                              onDayClick={handlePopupDateSelect}
                              disabled={
                                activeDateField === "exit" && minimumExitDate
                                  ? [
                                      { before: minimumExitDate },
                                      ...blockedDayModifiers,
                                    ]
                                  : blockedDayModifiers
                              }
                              modifiers={{
                                blocked: blockedDayModifiers,
                              }}
                              modifiersClassNames={{
                                blocked: "rdp-day_blocked",
                              }}
                              className="airport-date-picker m-0 max-w-full"
                            />
                          </div>

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
                          </BoxCard>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {blockedDateConflict && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {blockedDateConflict}
                  </div>
                )}

                {airportPriceLoading && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                    Loading airport price...
                  </div>
                )}

                {airportPriceError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {airportPriceError}
                  </div>
                )}

                {selectedLocation?.show_shuttle_options && !form.start_date && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                    Select entry date first to load real shuttle availability.
                  </div>
                )}

                {airportShuttleLoading &&
                  selectedLocation?.show_shuttle_options && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                      Loading shuttle availability...
                    </div>
                  )}

                {airportShuttleError &&
                  selectedLocation?.show_shuttle_options && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {airportShuttleError}
                    </div>
                  )}

                {selectedLocation?.show_shuttle_options &&
                  form.start_date &&
                  !airportShuttleLoading &&
                  !hasAirportShuttleOptions &&
                  !airportShuttleError && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                      Shuttle options are enabled for this airport, but no
                      airport shuttle slots are available for this entry date.
                    </div>
                  )}

                {hasAirportShuttleOptions && (
                  <div className="mt-5 space-y-5">
                    <div>
                      <label className="font-medium">Passengers</label>

                      <Input
                        type="number"
                        min="1"
                        value={form.pax}
                        onChange={(e) => handlePassengerChange(e.target.value)}
                        Icon={<Users />}
                      />

                      <p className="mt-1 text-xs text-gray-500">
                        Enter passengers first, then view available shuttle
                        options.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <BookingButton
                        onClick={handleSeeShuttleOptions}
                        text={"See Shuttle Options"}
                      />

                      {form.shuttle_time && (
                        <BookingButton
                          onClick={handleClearShuttle}
                          text={"Clear Shuttle"}
                        />
                      )}
                    </div>

                    {showShuttleOptions && (
                      <div>
                        <h4 className="font-medium">Select Shuttle Option</h4>

                        <div className="mt-3 grid gap-3">
                          {activeShuttleSlots.map((slot) => {
                            const slotId = getSlotId(slot);
                            const slotTime = getSlotTime(slot);
                            const remaining = getSlotRemaining(slot);
                            const disabled = remaining < Number(form.pax || 1);
                            const selected =
                              String(form.shuttle_slot_id) === String(slotId);

                            return (
                              <button
                                key={slotId}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  setForm((prev) => ({
                                    ...prev,
                                    shuttle_slot_id: slotId,
                                    shuttle_time: slotTime,
                                  }));
                                }}
                                className={`w-full rounded-lg border-2 px-4 py-3 text-left text-sm font-semibold transition-all duration-200 ${
                                  selected
                                    ? "border-[#1c6de0] bg-blue-50 text-[#1c6de0] shadow-sm ring-1 ring-blue-100"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-[#1c6de0] hover:bg-blue-50 hover:text-[#1c6de0]"
                                } ${
                                  disabled
                                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-400"
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

{form.shuttle_time && (
  <div className="w-full rounded-lg border border-gray-200 border-r-4 border-r-[#1c6de0] bg-white px-4 py-3 shadow-sm">
    <p className="text-sm font-semibold text-gray-950">
      Selected shuttle option:{" "}
      <span className="font-bold">{form.shuttle_time}</span>
    </p>
  </div>
)}
                  </div>
                )}

                <div className="flex justify-between">
                  <NavigationButton
                    text={"Back"}
                    onClick={goPrevious}
                    direction="reverse"
                  />

                  <NavigationButton text={"Next Step"} onClick={goNext} />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="mt-8 space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    placeholder="First Name*"
                    value={form.first_name}
                    onChange={(e) => updateField("first_name", e.target.value)}
                    Icon={<User />}
                    type={"text"}
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
                      type={"email"}
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
                    type={"text"}
                    placeholder="Phone Number*"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    Icon={<Phone />}
                    label={"Phone"}
                  />

                  <div className="w-[204.5%]">
                    <Input
                      type={"text"}
                      placeholder="License Plate*"
                      value={form.license_plate}
                      onChange={(e) =>
                        updateField("license_plate", e.target.value)
                      }
                      Icon={<Bandage />}
                      required={true}
                      label={"License Plate"}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.interlock}
                    onChange={(e) => updateField("interlock", e.target.checked)}
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
                    text={"Back"}
                    onClick={goPrevious}
                    direction="reverse"
                  />

                  <NavigationButton text={"Next Step"} onClick={goNext} />
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="mt-8 space-y-6">
                <div className="-mt-1">
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
                    <div className="w-full">
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
                            <BookingButton
                              text={
                                couponLoading ? "Applying..." : "Apply Coupon"
                              }
                              onClick={handleApplyCoupon}
                            />
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
                    </div>

                    <BoxCard>
                      <div className="space-y-2 text-sm w-full">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <strong>{money(originalPrice)}</strong>
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
                    direction={"reverse"}
                    onClick={goPrevious}
                    text="Back"
                  />

                  <PaymentButton
                    text={getFinalButtonLabel()}
                    onClick={handleCreateBooking}
                  />
                </div>
              </div>
            )}
          </section>

          <aside className="h-fit min-w-0 rounded-2xl bg-blue-50 p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-gray-700">Booking Dates</h2>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <span className="rounded-lg bg-black px-3 py-2 text-sm font-bold text-white">
                  Entry Date
                </span>

                <span className="ml-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold">
                  {formatDisplayDate(form.start_date)}
                </span>
              </div>

              <div className="rounded-xl bg-white p-4 shadow-sm">
                <span className="rounded-lg bg-black px-3 py-2 text-sm font-bold text-white">
                  Exit Date
                </span>

                <span className="ml-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold">
                  {formatDisplayDate(form.end_date)}
                </span>
              </div>

              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="font-semibold">Selected Airport Parking</p>

                <p className="mt-1 text-sm text-gray-600">
                  {selectedLocation?.name || "-"}
                </p>
              </div>

              {airportPriceLoading && (
                <div className="rounded-xl bg-white p-4 text-sm text-blue-700 shadow-sm">
                  Loading airport price...
                </div>
              )}

              {selectedLocation?.show_shuttle_options && (
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-semibold">Selected Shuttle</p>

                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium text-gray-700">Shuttle:</span>{" "}
                      {form.shuttle_time ? form.shuttle_time : "No shuttle"}
                    </p>

                    <p>
                      <span className="font-medium text-gray-700">
                        Passengers:
                      </span>{" "}
                      {form.shuttle_time ? Number(form.pax || 0) : 0}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="font-semibold">Price Summary</p>

                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Price for</span>
                <strong>
  {estimatedDays} {estimatedDays === 1 ? "day" : "days"}
</strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{money(originalPrice)}</span>
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