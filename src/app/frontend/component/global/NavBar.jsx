"use client";

import { useEffect, useState } from "react";
import {
  MapPin,
  Mail,
  Phone,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  UserRound,
  LogOut,
} from "lucide-react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const PageEntries = [
  {
    name: "Cruise Terminal Parking",
    link: "/",
  },
  {
    name: "Long-Term Airport Parking",
    link: "/services/long-term-airport-parking-brisbane/",
  },
  {
    name: "Long-Term Car Parking",
    link: "/services/long-term-parking/",
  },
  {
    name: "Caravan & Boat Storage",
    link: "/services/caravan-storage-brisbane/",
  },
  {
    name: "Car Storage",
    link: "/services/car-storage-brisbane/",
  },
];

const CONTACT = {
  address: "9 Harris Road, Pinkenba QLD 4008",
  mapUrl: "https://maps.app.goo.gl/n4DkhwVm49GsWc4f8",
  email: "hello@slateblue-dove-624316.hostingersite.com",
  phoneText: "0415 279 3472",
  phoneHref: "tel:+614152793472",
};

const Navbar = () => {
  const [isLogin, setIsLogin] = useState(false);
  const [isDashBoardPage, setIsDashBoardPage] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDropDown, setIsDropDown] = useState(false);

  const pathName = usePathname();
  const router = useRouter();

  useEffect(() => {
    const credentials =
      !!localStorage.getItem("token") &&
      !!localStorage.getItem("user");

    setIsLogin(credentials);

    setIsDashBoardPage(
      pathName === "/customer/dashboard" && credentials
    );

    setIsOpen(false);
    setIsDropDown(false);
  }, [pathName]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setIsLogin(false);
    setIsDashBoardPage(false);
    setIsOpen(false);
    setIsDropDown(false);

    router.push("/login");
  };

  const activeClass = (href) =>
    pathName === href
      ? "text-white font-semibold bg-white/15"
      : "text-white/90 hover:text-white hover:bg-white/15";

  return (
    <header className="sticky left-0 top-0 z-[9999] w-full bg-[#1C6DE0] font-sans shadow-[0_4px_24px_rgba(14,55,150,0.25)]">
      {/* =====================================================
          TOP INFO BAR
      ====================================================== */}

      <div className="hidden border-b border-white/10 bg-[#1456B8] sm:block">
        <div className="mx-auto flex h-9 max-w-[1200px] items-center justify-end gap-7 px-9 text-[12.5px] text-white/80">
          <a
            href={CONTACT.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 transition hover:text-white"
          >
            <MapPin size={13} />
            {CONTACT.address}
          </a>

          <a
            href={`mailto:${CONTACT.email}`}
            className="inline-flex items-center gap-2 transition hover:text-white"
          >
            <Mail size={13} />
            {CONTACT.email}
          </a>

          <a
            href={CONTACT.phoneHref}
            className="inline-flex items-center gap-2 transition hover:text-white"
          >
            <Phone size={13} />
            Call Us : {CONTACT.phoneText}
          </a>
        </div>
      </div>

      {/* =====================================================
          MAIN HEADER
      ====================================================== */}

      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center px-4 md:h-[84px] md:px-9">
        {/* LOGO */}

        <Link href="/" className="mr-auto flex items-center">
          <img
            src="/site-logo.svg"
            alt="Logo"
            className="h-[38px] w-auto object-contain md:h-[52px]"
          />
        </Link>

        {/* =================================================
            DESKTOP NAVIGATION
        ================================================= */}

        <nav className="hidden items-center gap-0.5 px-8 lg:flex">
          <Link
            href="/booking/cruise"
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${activeClass(
              "/booking/cruise"
            )}`}
          >
            Cruise Schedule
          </Link>

          {/* SERVICES */}

          <div className="group relative">
            <Link
              href="/services"
              className="!inline-flex !items-center !gap-1 !rounded-lg !border-0 !bg-transparent !px-3.5 !py-2 !text-sm !font-medium !text-white/90 !no-underline !shadow-none !transition hover:!bg-white/15 hover:!text-white"
            >
              Services

              <ChevronDown
                size={14}
                className="transition duration-200 group-hover:rotate-180"
              />
            </Link>

            {/* SERVICES DROPDOWN */}

            <div className="invisible pointer-events-none absolute left-1/2 top-full z-50 min-w-[220px] -translate-x-1/2 pt-2 opacity-0 transition-opacity duration-200 group-hover:visible group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto group-focus-within:opacity-100">
              <div className="!-translate-y-1.5 !rounded-xl !border !border-slate-200 !bg-white !p-2 !shadow-[0_12px_40px_rgba(14,55,150,0.22)] !transition-transform !duration-200 group-hover:!translate-y-0 group-focus-within:!translate-y-0">
                {PageEntries.map((item) => (
                  <Link
                    key={item.name}
                    href={item.link}
                    className="!flex !items-center !gap-2 !rounded-lg !bg-transparent !px-3 !py-2 !text-[13.5px] !font-normal !text-[#3A4A60] !no-underline !shadow-none !transition hover:!bg-[#E8F0FD] hover:!text-[#1C6DE0]"
                  >
                    <span className="!h-1.5 !w-1.5 !shrink-0 !rounded-full !bg-slate-200" />

                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Link
            href="/about"
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${activeClass(
              "/about"
            )}`}
          >
            About
          </Link>

          <Link
            href="/contact-us"
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${activeClass(
              "/contact-us"
            )}`}
          >
            Contact Us
          </Link>
        </nav>

        {/* =================================================
            DESKTOP / TABLET ACTIONS
        ================================================= */}

        <div className="flex items-center gap-2">
          <a
            href={CONTACT.phoneHref}
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-white/90 transition hover:bg-white/15 hover:text-white sm:inline-flex"
          >
            <Phone size={14} />
            {CONTACT.phoneText}
          </a>

          <span className="hidden h-5 w-px bg-white/25 sm:block" />

          {isLogin && !isDashBoardPage && (
            <Link
              href="/customer/dashboard"
              className="hidden items-center gap-1.5 rounded-lg border border-white/35 px-3 py-2 text-[13px] font-medium text-white/85 transition hover:border-white/70 hover:bg-white/15 hover:text-white lg:inline-flex"
            >
              <UserRound size={14} />
              My Account
            </Link>
          )}

          {isLogin && (
            <button
              type="button"
              onClick={handleLogout}
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/70 transition hover:bg-white/10 hover:text-red-300 lg:inline-flex"
            >
              <LogOut size={14} />
              Logout
            </button>
          )}

          {!isLogin && (
            <Link
              href="/login"
              className="hidden items-center gap-1.5 rounded-lg border border-white/35 px-3 py-2 text-[13px] font-medium text-white/85 transition hover:border-white/70 hover:bg-white/15 hover:text-white lg:inline-flex"
            >
              <UserRound size={14} />
              Login
            </Link>
          )}

          <span className="hidden h-5 w-px bg-white/25 sm:block" />

          {/* BOOK NOW */}

          <Link
            href="/booking"
            className="inline-flex items-center gap-2 rounded-lg bg-[#F89FD7] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(248,159,215,0.38)] transition hover:-translate-y-0.5 hover:brightness-95 hover:shadow-[0_6px_20px_rgba(248,159,215,0.48)] md:px-5 md:text-sm"
          >
            <CalendarDays size={15} />
            Book Now
          </Link>

          {/* =================================================
              MOBILE MENU BUTTON
          ================================================= */}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label="Toggle menu"
            aria-expanded={isOpen}
            className={`ml-1 flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-lg border p-2 transition lg:hidden ${
              isOpen
                ? "border-white bg-white/15"
                : "border-white/40 hover:border-white/80 hover:bg-white/15"
            }`}
          >
            <span
              className={`h-0.5 w-[18px] rounded bg-white transition ${
                isOpen ? "translate-y-[7px] rotate-45" : ""
              }`}
            />

            <span
              className={`h-0.5 w-[18px] rounded bg-white transition ${
                isOpen ? "scale-x-0 opacity-0" : ""
              }`}
            />

            <span
              className={`h-0.5 w-[18px] rounded bg-white transition ${
                isOpen ? "-translate-y-[7px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* =====================================================
          MOBILE BACKDROP
      ====================================================== */}

      <div
        onClick={() => setIsOpen(false)}
        className={`fixed bottom-0 left-0 right-0 top-[68px] z-[9980] bg-slate-950/40 backdrop-blur-[2px] transition-all duration-300 sm:top-[104px] md:top-[120px] lg:hidden ${
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* =====================================================
          MOBILE RIGHT DRAWER
      ====================================================== */}

      <nav
        className={`fixed bottom-0 right-0 top-[68px] z-[9990]
        flex w-[52%] min-w-[195px] max-w-[225px] flex-col
        border-l border-slate-200/80
        bg-white
        shadow-[-12px_8px_38px_rgba(15,23,42,0.18)]
        transition-transform duration-300 ease-out
        sm:top-[104px]
        md:top-[120px]
        lg:hidden
        ${
          isOpen
            ? "translate-x-0"
            : "translate-x-full"
        }`}
      >
        {/* =================================================
            MOBILE MENU
        ================================================= */}

        <div className=" overflow-y-auto px-3 pb-3 pt-3">
          {/* CRUISE SCHEDULE */}

          <Link
            href="/booking/cruise"
            className={`group mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[15px] font-medium transition-all duration-200 ${
              pathName === "/booking/cruise"
                ? "bg-[#E8F0FD] font-semibold text-[#1C6DE0]"
                : "text-[#3A4A60] hover:bg-[#F3F7FD] hover:text-[#1C6DE0]"
            }`}
          >
            <span className="leading-snug">
              Cruise Schedule
            </span>

            <ChevronRight
              size={15}
              strokeWidth={2}
              className={`shrink-0 transition-all duration-200 ${
                pathName === "/booking/cruise"
                  ? "translate-x-0 text-[#1C6DE0]"
                  : "text-slate-300 group-hover:translate-x-0.5 group-hover:text-[#1C6DE0]"
              }`}
            />
          </Link>

          {/* =================================================
              SERVICES
          ================================================= */}

          <div className="mb-0.5">
            <div
              className={`group flex w-full items-center rounded-lg transition-all duration-200 ${
                isDropDown
                  ? "bg-[#F3F7FD]"
                  : "hover:bg-[#F3F7FD]"
              }`}
            >
              <Link
                href="/services"
                className="!flex !min-w-0 !flex-1 !items-center !justify-start !bg-transparent !px-3 !py-2.5 !text-[15px] !font-medium !text-[#3A4A60] !no-underline !shadow-none !transition hover:!text-[#1C6DE0]"
              >
                Services
              </Link>

              <button
                type="button"
                onClick={() => setIsDropDown((prev) => !prev)}
                aria-label="Toggle services submenu"
                aria-expanded={isDropDown}
                className="!mr-1 !flex !h-9 !w-9 !shrink-0 !items-center !justify-center !rounded-lg !border-0 !bg-transparent !p-0 !text-slate-400 !shadow-none !transition hover:!bg-white hover:!text-[#1C6DE0]"
              >
                <ChevronDown
                  size={15}
                  strokeWidth={2}
                  className={`transition-transform duration-300 ${
                    isDropDown ? "rotate-180 text-[#1C6DE0]" : ""
                  }`}
                />
              </button>
            </div>

            {/* SERVICES SUBMENU */}

            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isDropDown
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="ml-3 mt-0.5 border-l-2 border-[#DCE9FB] pl-2">
                  {PageEntries.map((item) => (
                    <Link
                      key={item.name}
                      href={item.link}
                      className="!flex !w-full !items-center !justify-between !gap-1 !rounded-lg !bg-transparent !px-2.5 !py-1.5 !text-[13px] !font-normal !leading-[1.35] !text-[#6B7A92] !no-underline !shadow-none !transition hover:!bg-[#E8F0FD] hover:!text-[#1C6DE0]"
                    >
                      <span>
                        {item.name}
                      </span>

                      <ChevronRight
                        size={11}
                        className="shrink-0 text-slate-300"
                      />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ABOUT */}

          <Link
            href="/about"
            className={`group mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[15px] font-medium transition-all duration-200 ${
              pathName === "/about"
                ? "bg-[#E8F0FD] font-semibold text-[#1C6DE0]"
                : "text-[#3A4A60] hover:bg-[#F3F7FD] hover:text-[#1C6DE0]"
            }`}
          >
            <span>About</span>

            <ChevronRight
              size={15}
              strokeWidth={2}
              className={`shrink-0 transition-all duration-200 ${
                pathName === "/about"
                  ? "text-[#1C6DE0]"
                  : "text-slate-300 group-hover:translate-x-0.5 group-hover:text-[#1C6DE0]"
              }`}
            />
          </Link>

          {/* CONTACT */}

          <Link
            href="/contact-us"
            className={`group mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[15px] font-medium transition-all duration-200 ${
              pathName === "/contact-us"
                ? "bg-[#E8F0FD] font-semibold text-[#1C6DE0]"
                : "text-[#3A4A60] hover:bg-[#F3F7FD] hover:text-[#1C6DE0]"
            }`}
          >
            <span>Contact Us</span>

            <ChevronRight
              size={15}
              strokeWidth={2}
              className={`shrink-0 transition-all duration-200 ${
                pathName === "/contact-us"
                  ? "text-[#1C6DE0]"
                  : "text-slate-300 group-hover:translate-x-0.5 group-hover:text-[#1C6DE0]"
              }`}
            />
          </Link>

          {/* PHONE */}

          <a
            href={CONTACT.phoneHref}
            className="group mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[15px] font-medium text-[#3A4A60] transition-all duration-200 hover:bg-[#F3F7FD] hover:text-[#1C6DE0]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Phone
                size={16}
                strokeWidth={1.9}
                className="shrink-0"
              />

              <span className="whitespace-nowrap">
                {CONTACT.phoneText}
              </span>
            </span>

            <ChevronRight
              size={14}
              className="shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#1C6DE0]"
            />
          </a>
        </div>

        {/* =================================================
            BOTTOM ACTION AREA
        ================================================= */}

        <div className="shrink-0 border-t border-slate-100 bg-[#FCFDFE] px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5">
          {/* BOOK NOW */}

          <Link
            href="/booking"
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#F89FD7] px-3 py-2.5 text-[15px] font-bold text-white shadow-[0_3px_14px_rgba(248,159,215,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-95 hover:shadow-[0_5px_18px_rgba(248,159,215,0.42)]"
          >
            <CalendarDays size={15} />
            Book Now
          </Link>

          {/* =================================================
              LOGIN STATE
          ================================================= */}

          {isLogin ? (
            <>
              {!isDashBoardPage && (
                <Link
                  href="/customer/dashboard"
                  className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-[#6B7A92] transition hover:border-[#BFD5F5] hover:bg-[#F3F7FD] hover:text-[#1C6DE0]"
                >
                  <UserRound size={15} />
                  My Account
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-50 hover:text-red-500"
              >
                <LogOut size={15} />
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-[#6B7A92] transition hover:border-[#BFD5F5] hover:bg-[#F3F7FD] hover:text-[#1C6DE0]"
            >
              <UserRound size={15} />
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;