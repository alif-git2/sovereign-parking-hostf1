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

const STORAGE_TYPES_API = "/backend/router/storagetypes";
const STORAGE_AVAILABILITY_API_URL = "/storage-availability";
const CHECKOUT_DRAFT_API_URL = "/bookings/checkout-drafts";
const STRIPE_PAYMENT_PAGE_URL = "/booking/payment";
const PAYPAL_PAYMENT_PAGE_URL = "/booking/paypal";

const HOLDING_DEPOSIT_AMOUNT = 20;

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

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null;
}

function getCustomerEmail(value) {
  const customer =
    value?.data?.user ||
    value?.data?.customer ||
    value?.user ||
    value?.customer ||
    value;

  return String(customer?.email || "")
    .trim()
    .toLowerCase();
}

function getStoredCustomerEmail() {
  if (typeof window === "undefined" || !getToken()) {
    return "";
  }

  try {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return "";
    }

    return getCustomerEmail(JSON.parse(storedUser));
  } catch {
    return "";
  }
}

function getAuthHeaders() {
  const token = getToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function getCheckoutDraftId(data) {
  return (
    data?.draftId ||
    data?.draft_id ||
    data?.checkoutDraftId ||
    data?.checkout_draft_id ||
    data?.draft?.draft_reference ||
    data?.data?.draft?.draft_reference ||
    data?.draft?._id ||
    data?.data?.draft?._id ||
    ""
  );
}

function extractStorageTypes(result) {
  const data = result?.data;

  if (Array.isArray(data)) return data;

  return (
    data?.storageTypes ||
    data?.storage_types ||
    data?.types ||
    data?.data ||
    []
  );
}

function getOptionName(item) {
  if (!item) return "-";

  return item.name || item.title || item.label || item.storage_type_name || "-";
}

export default function StorageBookingPage() {
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
  const [loggedInCustomerEmail, setLoggedInCustomerEmail] = useState("");
  const [customerEmailLoading, setCustomerEmailLoading] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeDateField, setActiveDateField] = useState("entry");
  const [calendarMessage, setCalendarMessage] = useState("");

  const [storageTypes, setStorageTypes] = useState([]);
  const [storageTypesLoading, setStorageTypesLoading] = useState(false);
  const [storageAvailabilityLoading, setStorageAvailabilityLoading] =
    useState(false);
  const [storageAvailabilityError, setStorageAvailabilityError] = useState("");

  const [storagePriceRule, setStoragePriceRule] = useState(null);
  const [storagePriceLoading, setStoragePriceLoading] = useState(false);
  const [storagePriceError, setStoragePriceError] = useState("");

  const [checkoutDraftLoading, setCheckoutDraftLoading] = useState(false);

  const [paymentProviderPopupOpen, setPaymentProviderPopupOpen] =
    useState(false);
  const [poaProviderPopupOpen, setPoaProviderPopupOpen] = useState(false);

  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");

  const [form, setForm] = useState({
    type: "storage",

    storage_type_id: "",
    location_id: "",

    start_date: "",
    end_date: "",

    first_name: "",
    last_name: "",
    email: "",
    phone: "",

    reference: "",
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
      setLoggedInCustomerEmail("");
      setCustomerEmailLoading(false);

      return () => {
        active = false;
      };
    }

    const cachedEmail = getStoredCustomerEmail();

    if (cachedEmail) {
      setLoggedInCustomerEmail(cachedEmail);

      setForm((prev) => ({
        ...prev,
        email: cachedEmail,
      }));
    }

    async function loadLoggedInCustomerEmail() {
      try {
        setCustomerEmailLoading(true);

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

        const accountEmail = getCustomerEmail(res.data);

        if (!accountEmail || !active) {
          throw new Error(
            "The logged-in customer email was not returned."
          );
        }

        setLoggedInCustomerEmail(accountEmail);

        setForm((prev) => ({
          ...prev,
          email: accountEmail,
        }));
      } catch {
        if (!cachedEmail && active) {
          setLoggedInCustomerEmail("");
        }
      } finally {
        if (active) {
          setCustomerEmailLoading(false);
        }
      }
    }

    loadLoggedInCustomerEmail();

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
    fetchLocations("storage").catch((error) => {
      alert(error.message);
    });
  }, [fetchLocations]);

  useEffect(() => {
    async function fetchStorageTypes() {
      try {
        setStorageTypesLoading(true);

        const response = await fetch(STORAGE_TYPES_API, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();

        if (!response.ok || result.success === false) {
          throw new Error(
            result.message || result.error || "Failed to fetch storage types"
          );
        }

        setStorageTypes(extractStorageTypes(result));
      } catch (error) {
        alert(error.message);
      } finally {
        setStorageTypesLoading(false);
      }
    }

    fetchStorageTypes();
  }, []);

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
    return (locations || []).find(
      (location) => String(location._id) === String(form.location_id)
    );
  }, [locations, form.location_id]);

  const selectedStorageType = useMemo(() => {
    return storageTypes.find(
      (type) => String(type._id) === String(form.storage_type_id)
    );
  }, [storageTypes, form.storage_type_id]);

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

    // Same-day Storage booking is allowed.
    return entryDateObject;
  }, [entryDateObject]);

  const estimatedDays = useMemo(() => {
    if (!form.start_date || !form.end_date) return 0;

    const startDate = new Date(form.start_date);
    const endDate = new Date(form.end_date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return 0;
    }

    const diff = endDate - startDate;

    // Inclusive calendar-day counting:
    // 09 -> 09 = 1 day
    // 04 -> 05 = 2 days
    const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;

    return days > 0 ? days : 0;
  }, [form.start_date, form.end_date]);

  useEffect(() => {
    async function fetchStoragePriceRule() {
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
              "Failed to load storage price"
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

    fetchStoragePriceRule();
  }, [estimatedDays]);

  const originalPrice = useMemo(() => {
    return Number(storagePriceRule?.price || 0);
  }, [storagePriceRule]);

  const discountAmount = Number(coupon?.discount_amount || 0);

  const finalPrice = coupon
    ? Number(coupon.final_price || Math.max(originalPrice - discountAmount, 0))
    : originalPrice;

  const poaDepositAmount = Math.min(HOLDING_DEPOSIT_AMOUNT, finalPrice || 0);

  const hasLoggedInCustomer = mounted && Boolean(getToken());

  const effectiveCustomerEmail = hasLoggedInCustomer
    ? loggedInCustomerEmail
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
      name === "storage_type_id" ||
      name === "start_date" ||
      name === "end_date"
    ) {
      clearCoupon();
    }

    if (
      name === "location_id" ||
      name === "storage_type_id" ||
      name === "start_date" ||
      name === "end_date"
    ) {
      setStorageAvailabilityError("");
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

  function openDatePopup(field) {
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

    const selectedDate = formatDateInput(day);

    if (!selectedDate) {
      setCalendarMessage("Invalid date format.");
      return;
    }

    if (activeDateField === "entry") {
      setForm((prev) => {
        const selectedEntryDate = parseLocalDate(selectedDate);
        const oldExitDate = parseLocalDate(prev.end_date);

        let nextEndDate = prev.end_date;

        if (!oldExitDate || oldExitDate < selectedEntryDate) {
          nextEndDate = "";
        }

        return {
          ...prev,
          start_date: selectedDate,
          end_date: nextEndDate,
          coupon_code: "",
          payment_flow: "",
          payment_method: "",
          deposit_type: "",
          holding_deposit_amount: 0,
        };
      });

      clearCoupon();
      setStorageAvailabilityError("");
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
      setStorageAvailabilityError("");
      setCalendarOpen(false);
      setCalendarMessage("");
    }
  }

  function validateStep(step) {
    if (step === 1) {
      if (!form.start_date || !form.end_date) {
        alert("Please select entry date and exit date.");
        return false;
      }

      const startDate = new Date(form.start_date);
      const endDate = new Date(form.end_date);

      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        alert("Invalid date format.");
        return false;
      }

      if (endDate < startDate) {
        alert("Exit date cannot be before entry date.");
        return false;
      }

      if (estimatedDays < 1) {
        alert("Selected date range must be at least 1 day.");
        return false;
      }

      if (!storagePriceRule) {
        alert(
          storagePriceError ||
            `No storage price rule found for ${estimatedDays} day(s). Please add it from Settings.`
        );
        return false;
      }
    }

    if (step === 2) {
      if (!form.storage_type_id) {
        alert("Please select a storage type.");
        return false;
      }

      if (!form.location_id) {
        alert("Please select a storage location.");
        return false;
      }
    }

    if (step === 3) {
      if (!form.first_name || !form.last_name) {
        alert("Please enter first name and last name.");
        return false;
      }

      if (hasLoggedInCustomer && customerEmailLoading) {
        alert("Please wait while your account email is loading.");
        return false;
      }

      if (hasLoggedInCustomer && !loggedInCustomerEmail) {
        alert(
          "Your logged-in account email could not be verified. Please log out and log in again."
        );
        return false;
      }

      if (!effectiveCustomerEmail || !form.phone) {
        alert("Please enter email and phone.");
        return false;
      }

      if (!form.source) {
        alert("Please select how you heard about us.");
        return false;
      }
    }

    return true;
  }

  async function checkStorageAvailability({ showAlert = true } = {}) {
    if (storageAvailabilityLoading) {
      return false;
    }

    try {
      setStorageAvailabilityLoading(true);
      setStorageAvailabilityError("");

      const res = await axios.get(STORAGE_AVAILABILITY_API_URL, {
        params: {
          storage_type_id: form.storage_type_id,
          location_id: form.location_id,
          start_date: form.start_date,
          end_date: form.end_date,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Storage availability could not be checked."
        );
      }

      const availability = res.data?.data || res.data;
      const available =
        res.data?.available !== undefined
          ? Boolean(res.data.available)
          : Boolean(availability?.available);

      if (!available) {
        const message =
          res.data?.message ||
          availability?.message ||
          `${getOptionName(
            selectedStorageType
          )} storage is fully booked for the selected dates.`;

        setStorageAvailabilityError(message);

        if (showAlert) {
          alert(message);
        }

        return false;
      }

      setStorageAvailabilityError("");
      return true;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Storage availability could not be checked.";

      setStorageAvailabilityError(message);

      if (showAlert) {
        alert(message);
      }

      return false;
    } finally {
      setStorageAvailabilityLoading(false);
    }
  }

  async function goNext() {
    if (storageAvailabilityLoading) return;
    if (!validateStep(currentStep)) return;

    if (currentStep === 2) {
      const available = await checkStorageAvailability();

      if (!available) {
        return;
      }
    }

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
        alert("Please select dates and storage location first.");
        return;
      }

      if (!storagePriceRule) {
        alert(
          storagePriceError ||
            `No storage price rule found for ${estimatedDays} day(s). Please add it from Settings.`
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
        booking_type: "storage",
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

  async function handleCreateBooking() {
    try {
      if (bookingLoading || checkoutDraftLoading) return;

      if (!validateStep(1)) return;
      if (!validateStep(2)) return;
      if (!validateStep(3)) return;

      const storageAvailable = await checkStorageAvailability();

      if (!storageAvailable) {
        setCurrentStep(2);
        return;
      }

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

      const amountDueNow =
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

        if (walletBalance < amountDueNow) {
          alert(
            `You do not have enough wallet balance. Required: ${money(
              amountDueNow
            )}, available: ${money(walletBalance)}`
          );
          return;
        }
      }

      const payload = {
        type: "storage",

        storage_type_id: form.storage_type_id,
        location_id: form.location_id,

        start_date: form.start_date,
        end_date: form.end_date,

        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        name: `${form.first_name} ${form.last_name}`.trim(),
        email: effectiveCustomerEmail,
        phone: form.phone.trim(),

        reference: form.reference.trim(),
        source: form.source,
        notes: form.notes,

        coupon_code: coupon?.code || coupon?.coupon_code || undefined,

        payment_flow: form.payment_flow,
        holding_deposit_amount:
          form.payment_flow === "poa_deposit" ? amountDueNow : 0,
        deposit_type: form.deposit_type,
        payment_method: form.payment_method,

        price: finalPrice,
        total_amount: finalPrice,
        due_amount: amountDueNow,
        balance_due_on_arrival:
          form.payment_flow === "poa_deposit"
            ? Math.max(finalPrice - amountDueNow, 0)
            : 0,

        price_rule_id: storagePriceRule?._id,
        calculated_days: estimatedDays,
      };

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

      if (isStripePayment || isPaypalPayment) {
        setCheckoutDraftLoading(true);

        const draftResponse = await axios.post(
          CHECKOUT_DRAFT_API_URL,
          {
            type: "storage",
            payment_method: form.payment_method,
            payment_provider: form.payment_method,
            payment_flow: form.payment_flow,
            deposit_type: form.deposit_type,
            currency: "aud",

            price: finalPrice,
            total_amount: finalPrice,
            amount_due_now: amountDueNow,
            holding_deposit_amount:
              form.payment_flow === "poa_deposit" ? amountDueNow : 0,
            balance_due_on_arrival:
              form.payment_flow === "poa_deposit"
                ? Math.max(finalPrice - amountDueNow, 0)
                : 0,
            coupon_code: coupon?.code || coupon?.coupon_code || "",

            booking_payload: payload,
          },
          {
            headers: getAuthHeaders(),
          }
        );

        if (!draftResponse.data?.success) {
          throw new Error(
            draftResponse.data?.message ||
              draftResponse.data?.error ||
              "Checkout draft could not be created."
          );
        }

        const draftId = getCheckoutDraftId(draftResponse.data);

        if (!draftId) {
          throw new Error("Checkout draft ID was not returned.");
        }

        clearCoupon();

        const paymentPageUrl = isStripePayment
          ? STRIPE_PAYMENT_PAGE_URL
          : PAYPAL_PAYMENT_PAGE_URL;

        router.push(
          `${paymentPageUrl}?draftId=${encodeURIComponent(draftId)}`
        );

        return;
      }

      alert("Invalid payment method selected.");
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Booking could not be created."
      );
    } finally {
      setCheckoutDraftLoading(false);
    }
  }

  function renderPaymentMethodSelector() {
    const isOnlineSelected = form.payment_flow === "full_online";
    const isPoaDepositSelected = form.payment_flow === "poa_deposit";

    return (
      <BoxCard>
        <div className="">
          <h3 className="font-semibold">Payment Method</h3>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setPaymentProviderPopupOpen(true)}
              className={`rounded-lg border-2 p-4 text-left ${
                isOnlineSelected
                  ? "border-blue-500 bg-blue-50"
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
                      className="cursor-pointer rounded-full border-2 border-gray-300 p-1 transition-all duration-200 hover:border-blue-400"
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
                      className="cursor-pointer rounded-full border-2 border-gray-300 p-1 transition-all duration-200 hover:border-blue-400"
                    >
                      <X size={14} color="red" strokeWidth={4} />
                    </button>
                  </div>

                  <p className="mt-3 text-sm text-gray-600">
                    Pay a holding deposit of {money(poaDepositAmount)} now and it's non-refundable deposit. The
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
    { key: "Storage Type", value: getOptionName(selectedStorageType) },
    { key: "Location", value: getOptionName(selectedLocation) },
    { key: "Entry Date", value: formatDisplayDate(form.start_date) },
    { key: "Exit Date", value: formatDisplayDate(form.end_date) },
{ 
  key: "Price For", 
  value: estimatedDays
    ? `${estimatedDays} ${estimatedDays=== 1 ? "Day" : "Days"}` 
    : "-" 
},

    { key: "Name", value: form.first_name + " " + form.last_name },
    { key: "Email", value: effectiveCustomerEmail || "-" },
    { key: "Phone", value: form.phone },
    { key: "Vehicle Type", value: form.reference || "-" },
    { key: "Source", value: form.source },
    { key: "Storage Info", value: form.notes || "-" },
  ];

  return (
    <>
      <Navbar />

      <main className="min-h-screen w-full overflow-x-hidden bg-gray-50 px-3 py-6 sm:px-4 sm:py-10">
        <div className="mx-auto mb-5 flex w-full max-w-6xl min-w-0 items-center gap-2 rounded-md border-s-4 border-blue-400 bg-gray-400/10 px-2.5 py-3 shadow-md sm:gap-4 sm:px-5">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back to storage list"
            title="Back to storage list"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pink-200 bg-white text-pink-500 shadow-sm transition hover:border-pink-400 hover:bg-pink-50 focus:outline-none focus:ring-2 focus:ring-pink-300 sm:h-10 sm:w-10"
          >
            <MoveLeft size={19} strokeWidth={2.5} />
          </button>

          <div className="grid min-w-0 flex-1 grid-cols-4 gap-1 sm:gap-3">
            {[
              "Select Dates",
              "Storage Space",
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
                "h-auto rounded-md border-t-4 border-green-400 bg-gray-400/10 p-5 shadow-md"
              }`}
            >
              {currentStep === 1 && (
                <div className="mt-8 space-y-6">
                  <div className="relative">
                    <div className="grid min-w-0 gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Entry Date
                        </label>

                        <Div isPadding={false}>
                          <button
                            type="button"
                            onClick={() => openDatePopup("entry")}
                            className={`h-full w-full px-3 py-2 text-left ${
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
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl">
                            <BoxCard bgWhite={true} padding="p-3">
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
                                className="cursor-pointer rounded-full border-2 border-gray-300 p-1 transition-all duration-200 hover:border-blue-400"
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
                                    ? [{ before: minimumExitDate }]
                                    : undefined
                                }
                                className="airport-date-picker m-0 max-w-full"
                              />
                            </div>

                            {calendarMessage && (
                              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                                {calendarMessage}
                              </div>
                            )}
                            </BoxCard>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {storagePriceLoading && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                      Loading storage price...
                    </div>
                  )}

                  {storagePriceError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {storagePriceError}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <NavigationButton onClick={goNext} text="Book Now" />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="mt-8 space-y-6">
                  <div>
                    <label className="font-medium">Storage Type</label>

                    <SelectOption
                      options={storageTypes}
                      value={form.storage_type_id}
                      onChange={(e) => updateField("storage_type_id", e)}
                      disabled={storageTypesLoading}
                      placeholder="Select Storage Type"
                      isBackupPlaceholder={true}
                    />

                    {!storageTypesLoading && storageTypes.length === 0 && (
                      <p className="mt-1 text-xs text-red-500">
                        No storage types found. Please add storage types from
                        admin panel.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Storage Location</p>

                    <div className="flex flex-col items-center justify-center gap-3 md:flex-row md:justify-between md:gap-5">
                      <div className="w-full">
                        <SelectOption
                          isBackupPlaceholder={true}
                          options={locations}
                          value={form.location_id}
                          onChange={(e) => updateField("location_id", e)}
                          placeholder="Select storage location"
                          selectIcon={<MapPin />}
                          optionIcon={<MapPin />}
                        />
                      </div>
                    </div>
                  </div>

                  {storageAvailabilityLoading && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                      Checking storage availability...
                    </div>
                  )}

                  {storageAvailabilityError && !storageAvailabilityLoading && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {storageAvailabilityError}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <NavigationButton
                      text="Back"
                      direction="reverse"
                      onClick={goPrevious}
                    />

                    <NavigationButton
                      text={
                        storageAvailabilityLoading ? "Checking..." : "Next Step"
                      }
                      onClick={goNext}
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="mt-8 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      placeholder="First Name*"
                      value={form.first_name}
                      onChange={(e) =>
                        updateField("first_name", e.target.value)
                      }
                      Icon={<User />}
                      type="text"
                      label="First Name*"
                    />

                    <Input
                      placeholder="Last Name*"
                      value={form.last_name}
                      onChange={(e) => updateField("last_name", e.target.value)}
                      type="text"
                      label="Last Name*"
                    />

                    <div>
                      <Input
                        type="email"
                        placeholder={
                          customerEmailLoading
                            ? "Loading account email..."
                            : "Email*"
                        }
                        value={
                          hasLoggedInCustomer
                            ? loggedInCustomerEmail
                            : form.email
                        }
                        onChange={(e) =>
                          updateField("email", e.target.value)
                        }
                        readOnly={hasLoggedInCustomer}
                        disabled={
                          hasLoggedInCustomer && customerEmailLoading
                        }
                        aria-readonly={hasLoggedInCustomer}
                        Icon={<Mail />}
                        label={
                          hasLoggedInCustomer
                            ? "Email (logged-in account)"
                            : "Email*"
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
                      label="Phone"
                    />

                    <div className="md:col-span-2">
                      <Input
                        type="text"
                        placeholder="Vehicle type"
                        value={form.reference}
                        onChange={(e) =>
                          updateField("reference", e.target.value)
                        }
                        Icon={<Bandage />}
                        label="Vehicle type"
                      />
                    </div>
                  </div>

                  <h3
                    className="inline-block pl-0.5 text-md text-gray-600"
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
                    placeholder="Storage Type/Other Info"
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    Icon={<FileText />}
                    rows={5}
                    label="Storage Type/Other Info"
                  />

                  <div className="flex justify-between">
                    <NavigationButton
                      direction="reverse"
                      text="Back"
                      onClick={goPrevious}
                    />

                    <NavigationButton text="Review Booking" onClick={goNext} />
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="pt-[7px]">
                  <div className="rounded-xl bg-gray-50">
                    <BoxCard>
                      <h2 className="mb-5 text-xl font-semibold">
                        Review Booking
                      </h2>

                      <div className="grid gap-3 text-sm md:grid-cols-2">
                        {reviewData.map((data, index) => (
                          <TextCard key={index} data={data} />
                        ))}
                      </div>
                    </BoxCard>

                    <div className="flex flex-col justify-between gap-5 md:flex-row">
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
                                text="Remove"
                                onClick={handleRemoveCoupon}
                              />
                            )}
                          </div>

                          {coupon && (
                            <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                              Coupon{" "}
                              <strong>
                                {coupon.code || coupon.coupon_code}
                              </strong>{" "}
                              applied. You saved{" "}
                              <strong>{money(coupon.discount_amount)}</strong>.
                            </p>
                          )}
                        </BoxCard>
                      </div>

                      <BoxCard>
                        <div className="w-full space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Price for</span>
                          <strong>
  {estimatedDays} {estimatedDays === 1 ? "day" : "days"}
</strong>
                          </div>

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

                  <div className="mt-5 flex justify-between">
                    <NavigationButton
                      direction="reverse"
                      text="Back"
                      onClick={goPrevious}
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
                  <p className="font-semibold">Selected Storage</p>

                  <p className="mt-1 text-sm text-gray-600">
                    {getOptionName(selectedStorageType)}
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    {getOptionName(selectedLocation)}
                  </p>
                </div>

                {storagePriceRule && (
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="font-semibold">Applied Price Rule</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {storagePriceRule.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {money(storagePriceRule.price)}
                    </p>
                  </div>
                )}

                {storagePriceLoading && (
                  <div className="rounded-xl bg-white p-4 text-sm text-blue-700 shadow-sm">
                    Loading storage price...
                  </div>
                )}

                {storagePriceError && (
                  <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                    {storagePriceError}
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
