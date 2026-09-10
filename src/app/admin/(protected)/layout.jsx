"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import axios from "@/app/frontend/utils/axios";

const navItems = [
  {
    label: "Overview",
    href: "/admin/dashboard",
    roles: ["admin", "manager"],
  },
  {
    label: "Calendar",
    href: "/admin/calendar",
    roles: ["admin", "manager"],
  },
  {
    label: "Bookings",
    href: "/admin/bookings",
    roles: ["admin", "manager"],
    children: [
      {
        label: "Cruise Bookings",
        href: "/admin/bookings/cruise",
        roles: ["admin", "manager"],
      },
      {
        label: "Storage Bookings",
        href: "/admin/bookings/storage",
        roles: ["admin", "manager"],
      },
      {
        label: "Airport Bookings",
        href: "/admin/bookings/airport",
        roles: ["admin", "manager"],
      },
    ],
  },
 
  {
    label: "Payments",
    href: "/admin/payments",
    roles: ["admin"],
  },

  {
    label: "Cruise",
    href: "/admin/cruise-schedules",
    roles: ["admin"],
  },
  {
    label: "Storage",
    href: "/admin/storage",
    roles: ["admin"],
  },
  {
    label: "Airport",
    href: "/admin/airport",
    roles: ["admin"],
  },
  {
    label: "Coupons",
    href: "/admin/coupons",
    roles: ["admin"],
  },
  {
    label: "Wallets",
    href: "/admin/wallets",
    roles: ["admin"],
  },
  {
    label: "Locations",
    href: "/admin/locations",
    roles: ["admin"],
  },
  {
    label: "Customers",
    href: "/admin/customers",
    roles: ["admin"],
  },
  {
    label: "Bulk Import",
    href: "/admin/import",
    roles: ["admin"],
  },
  {
  label: "Reports",
  href: "/admin/reports",
  roles: ["admin"],
},

 {
    label: "User Management",
    href: "/admin/users",
    roles: ["admin"],
  },
    {
    label: "Support Tickets",
    href: "/admin/support-tickets",
    roles: ["admin"],
  },
  
{
  label: "SEO Manager",
  href: "/admin/seo",
  roles: ["admin"],
},

{
  label: "Blog Post",
  href: "/admin/blog-posts",
  roles: ["admin"],
},

  {
    label: "Settings",
    href: "/admin/settings",
    roles: ["admin"],
  },
];

const managerAllowedPrefixes = [
  "/admin/dashboard",
  "/admin/calendar",
  "/admin/bookings",
];

const emptyProfileForm = {
  name: "",
  email: "",
  phone: "",
  role: "",
};

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

function getAdminUser() {
  if (typeof window === "undefined") return null;

  const rawUser = localStorage.getItem("adminUser");

  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

function setStoredAdminUser(user) {
  if (typeof window === "undefined" || !user) return;

  localStorage.setItem("adminUser", JSON.stringify(user));
}

function clearAdminSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
}

function isActivePath(pathname, href) {
  if (href === "/admin/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function canAccessNavItem(item, role) {
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.includes(role);
}

function getVisibleNavItems(role) {
  return navItems
    .filter((item) => canAccessNavItem(item, role))
    .map((item) => {
      if (!Array.isArray(item.children)) return item;

      return {
        ...item,
        children: item.children.filter((child) =>
          canAccessNavItem(child, role)
        ),
      };
    });
}

function canManagerAccessPath(pathname) {
  return managerAllowedPrefixes.some((prefix) => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

function normalizeProfileForm(user) {
  return {
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    role: user?.role || "",
  };
}

function getProfileFromResponse(response, fallbackUser) {
  return (
    response?.data?.data?.user ||
    response?.data?.data ||
    response?.data?.user ||
    fallbackUser ||
    null
  );
}

function ProfileModal({
  open,
  form,
  setForm,
  loading,
  saving,
  error,
  onClose,
  onSubmit,
  onForgotPassword,
}) {
  if (!open) return null;

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-3 py-4">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Profile Settings
            </h2>

            <p className="mt-0.5 text-xs text-gray-500">
              Update your profile information.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="p-5 text-sm font-semibold text-gray-600">
            Loading profile...
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 p-5">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-700">
                Name
              </label>

              <input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-600"
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">
                Email
              </label>

              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-600"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">
                Phone
              </label>

              <input
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-600"
                placeholder="Phone number"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">
                Role
              </label>

              <input
                value={form.role}
                disabled
                className="mt-1.5 w-full rounded-xl border bg-gray-100 px-3 py-2 text-sm capitalize text-gray-600"
              />

              <p className="mt-1 text-[11px] text-gray-500">
                Role cannot be changed from profile settings.
              </p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-900">
                Want to change your password?
              </p>

              <p className="mt-1 text-[11px] leading-5 text-blue-800">
                Use forgot password to receive a secure password reset link.
              </p>

              <button
                type="button"
                onClick={onForgotPassword}
                className="mt-3 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
              >
                Forgot Password
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AdminProtectedLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bookingsOpen, setBookingsOpen] = useState(false);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const visibleNavItems = useMemo(() => {
    return getVisibleNavItems(adminUser?.role || "manager");
  }, [adminUser?.role]);

  useEffect(() => {
    setMounted(true);

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    const currentAdminUser = getAdminUser();

    if (
      !currentAdminUser ||
      !["admin", "manager"].includes(currentAdminUser.role)
    ) {
      clearAdminSession();
      router.replace("/admin/login");
      return;
    }

    setAdminUser(currentAdminUser);

    if (
      currentAdminUser.role === "manager" &&
      !canManagerAccessPath(pathname)
    ) {
      router.replace("/admin/dashboard");
      return;
    }

    if (pathname.startsWith("/admin/bookings")) {
      setBookingsOpen(true);
    }
  }, [router, pathname]);

  function handleLogout() {
    clearAdminSession();
    router.replace("/admin/login");
  }

  async function openProfileModal() {
    setProfileModalOpen(true);
    setProfileError("");
    setProfileForm(normalizeProfileForm(adminUser));

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setProfileLoading(true);

      const res = await axios.get("/admin/profile", {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to load profile."
        );
      }

      const loadedUser = getProfileFromResponse(res, adminUser);

      if (loadedUser) {
        setAdminUser(loadedUser);
        setStoredAdminUser(loadedUser);
        setProfileForm(normalizeProfileForm(loadedUser));
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Profile could not be loaded.";

      setProfileError(message);

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        router.replace("/admin/login");
      }
    } finally {
      setProfileLoading(false);
    }
  }

  function closeProfileModal() {
    if (profileSaving) return;

    setProfileModalOpen(false);
    setProfileError("");
    setProfileForm(emptyProfileForm);
  }

  function handleForgotPassword() {
    const email = String(profileForm.email || adminUser?.email || "").trim();
    const query = email ? `?email=${encodeURIComponent(email)}` : "";

    setProfileModalOpen(false);
    router.push(`/admin/forgot-password${query}`);
  }

  async function handleSaveProfile(event) {
    event.preventDefault();

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    const payload = {
      name: String(profileForm.name || "").trim(),
      email: String(profileForm.email || "").trim().toLowerCase(),
      phone: String(profileForm.phone || "").trim(),
    };

    if (!payload.name) {
      setProfileError("Name is required.");
      return;
    }

    if (!payload.email) {
      setProfileError("Email is required.");
      return;
    }

    try {
      setProfileSaving(true);
      setProfileError("");

      const res = await axios.patch("/admin/profile", payload, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to save profile."
        );
      }

      const updatedUser = getProfileFromResponse(res, {
        ...adminUser,
        ...payload,
      });

      setAdminUser(updatedUser);
      setStoredAdminUser(updatedUser);
      setProfileForm(normalizeProfileForm(updatedUser));

      alert(res.data.message || "Profile updated successfully.");
      closeProfileModal();
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Profile could not be saved.";

      setProfileError(message);

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        router.replace("/admin/login");
      }
    } finally {
      setProfileSaving(false);
    }
  }

  if (!mounted) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-lg border px-3 py-2 text-sm font-semibold lg:hidden"
            >
              Menu
            </button>

            <div>
              <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
                Admin Panel
              </h1>

              {/* <p className="mt-1 hidden text-sm text-gray-500 md:block">
                {adminUser?.role === "manager"
                  ? "Manage and review bookings and calendar."
                  : "Manage bookings, payments, wallets, customers, users, and settings."}
              </p> */}
            </div>
          </div>

          <div className="flex items-center gap-3">

<button
  type="button"
  onClick={openProfileModal}
  className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 transition hover:bg-gray-50 sm:flex"
  title="Profile settings"
>
  <div className="leading-tight">
    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
      {adminUser?.role || "Admin"}
    </p>

    <p className="text-sm font-semibold text-gray-800">
      {adminUser?.name || "Admin"}
    </p>
  </div>

  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-gray-600 transition hover:bg-gray-200">
    ⚙
  </div>
</button>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-white p-4 shadow-xl transition-transform lg:sticky lg:top-[88px] lg:h-[calc(100vh-112px)] lg:w-auto lg:translate-x-0 lg:rounded-2xl lg:border lg:shadow-sm ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-4 flex shrink-0 items-center justify-between lg:hidden">
            <p className="text-lg font-bold">Admin Menu</p>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg border px-3 py-1 text-sm"
            >
              Close
            </button>
          </div>

          <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm">
            {visibleNavItems.map((item) => {
              const hasChildren = Array.isArray(item.children);
              const active = isActivePath(pathname, item.href);

              if (hasChildren) {
                return (
                  <div
                    key={item.href}
                    className="group"
                    onMouseEnter={() => setBookingsOpen(true)}
                  >
                    <button
                      type="button"
                      onClick={() => setBookingsOpen((prev) => !prev)}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 font-semibold ${
                        active
                          ? "bg-blue-600 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span>{item.label}</span>
                      <span>{bookingsOpen ? "−" : "+"}</span>
                    </button>

                    {(bookingsOpen || active) && (
                      <div className="mt-2 space-y-1 rounded-xl bg-gray-50 p-2">
                        {item.children.map((child) => {
                          const childActive = pathname === child.href;

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`block rounded-lg px-4 py-2 text-sm font-semibold ${
                                childActive
                                  ? "bg-blue-100 text-blue-700"
                                  : "text-gray-600 hover:bg-white hover:text-gray-900"
                              }`}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`block rounded-xl px-4 py-3 font-semibold ${
                    active
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          />
        )}

        <section className="min-w-0">{children}</section>
      </div>

      <ProfileModal
        open={profileModalOpen}
        form={profileForm}
        setForm={setProfileForm}
        loading={profileLoading}
        saving={profileSaving}
        error={profileError}
        onClose={closeProfileModal}
        onSubmit={handleSaveProfile}
        onForgotPassword={handleForgotPassword}
      />
    </main>
  );
}