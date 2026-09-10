"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "@/app/frontend/utils/axios";

const tabs = [
  { key: "dashboard", label: "Dashboard" },
  { key: "global", label: "Global SEO" },
  { key: "pages", label: "Page SEO" },
  { key: "sitemap", label: "Sitemap" },
  { key: "robots", label: "Robots.txt" },
  { key: "audit", label: "SEO Audit" },
];

const defaultPublicPages = [
  { page_name: "Home", path: "/" },
  { page_name: "About", path: "/about" },
  { page_name: "Services", path: "/services" },
  { page_name: "Long Term Parking", path: "/services/long-term-parking" },
  {
    page_name: "Long Term Airport Parking Brisbane",
    path: "/services/long-term-airport-parking-brisbane",
  },
  { page_name: "Car Storage Brisbane", path: "/services/car-storage-brisbane" },
  {
    page_name: "Caravan Storage Brisbane",
    path: "/services/caravan-storage-brisbane",
  },
  { page_name: "Booking", path: "/booking" },
  { page_name: "Cruise Booking", path: "/booking/cruise" },
  { page_name: "Airport Booking", path: "/booking/airport" },
  { page_name: "Storage Booking", path: "/booking/storage" },
  { page_name: "Contact Us", path: "/contact-us" },
  { page_name: "Blog", path: "/blog" },
];

const changeFrequencyOptions = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
];

const defaultGlobalForm = {
  site_name: "",
  site_url: "",
  default_meta_title: "",
  default_meta_description: "",
  default_keywords: "",
  default_og_image: "",
  google_site_verification: "",
  google_analytics_id: "",
  facebook_pixel_id: "",
  default_noindex: false,
  default_nofollow: false,
  robots_txt: "",
  sitemap_enabled: true,
};

const defaultPageForm = {
  page_name: "",
  path: "",
  meta_title: "",
  meta_description: "",
  keywords: "",
  canonical_url: "",
  og_title: "",
  og_description: "",
  og_image: "",
  twitter_title: "",
  twitter_description: "",
  twitter_image: "",
  noindex: false,
  nofollow: false,
  sitemap_enabled: true,
  sitemap_priority: 0.8,
  sitemap_changefreq: "weekly",
  schema_json: "",
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

function clearAdminSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
}

function normalizeBoolean(value) {
  return Boolean(value);
}

function normalizeGlobalSeo(data) {
  const source =
    data?.data?.global ||
    data?.data?.setting ||
    data?.global ||
    data?.setting ||
    data ||
    {};

  return {
    ...defaultGlobalForm,
    ...source,
    default_noindex: normalizeBoolean(source.default_noindex),
    default_nofollow: normalizeBoolean(source.default_nofollow),
    sitemap_enabled: source.sitemap_enabled !== false,
  };
}

function normalizePageSeo(page) {
  return {
    ...defaultPageForm,
    ...page,
    noindex: normalizeBoolean(page?.noindex),
    nofollow: normalizeBoolean(page?.nofollow),
    sitemap_enabled: page?.sitemap_enabled !== false,
    sitemap_priority:
      page?.sitemap_priority === undefined || page?.sitemap_priority === null
        ? 0.8
        : Number(page.sitemap_priority),
    sitemap_changefreq: page?.sitemap_changefreq || "weekly",
    schema_json:
      typeof page?.schema_json === "string"
        ? page.schema_json
        : page?.schema_json
        ? JSON.stringify(page.schema_json, null, 2)
        : "",
  };
}

function extractPages(response) {
  const data = response?.data?.data;

  if (Array.isArray(data)) return data;

  return data?.pages || data?.seo_pages || response?.data?.pages || [];
}

function getErrorMessage(error, fallback = "Something went wrong.") {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

function buildCanonicalUrl(siteUrl, path) {
  const cleanSiteUrl = String(siteUrl || "").replace(/\/+$/, "");
  const cleanPath = String(path || "/").startsWith("/")
    ? String(path || "/")
    : `/${path}`;

  return cleanSiteUrl ? `${cleanSiteUrl}${cleanPath}` : cleanPath;
}

function countMissing(pages, key) {
  return pages.filter((page) => !String(page?.[key] || "").trim()).length;
}

function normalizePagePath(path) {
  let value = String(path || "").trim();

  if (!value) return "";

  try {
    if (/^https?:\/\//i.test(value)) {
      value = new URL(value).pathname;
    }
  } catch {
    // Keep the original value if it is not a valid absolute URL.
  }

  value = value.split("?")[0].split("#")[0] || "/";

  if (!value.startsWith("/")) {
    value = `/${value}`;
  }

  if (value.length > 1) {
    value = value.replace(/\/+$/, "");
  }

  return value || "/";
}

function isPrivatePath(path) {
  return (
    path.startsWith("/admin") ||
    path.startsWith("/backend") ||
    path.startsWith("/api") ||
    path.startsWith("/customer/dashboard") ||
    path.startsWith("/booking/payment") ||
    path.startsWith("/booking/paypal") ||
    path.startsWith("/booking/success")
  );
}

function getPageWarnings(page, allPages) {
  const warnings = [];
  const metaTitle = String(page.meta_title || "").trim();
  const metaDescription = String(page.meta_description || "").trim();
  const canonicalUrl = String(page.canonical_url || "").trim();

  if (!metaTitle) warnings.push("Meta title is missing.");
  if (metaTitle && metaTitle.length > 65) warnings.push("Meta title is too long.");
  if (!metaDescription) warnings.push("Meta description is missing.");
  if (
    metaDescription &&
    (metaDescription.length < 80 || metaDescription.length > 170)
  ) {
    warnings.push("Meta description should usually be between 80 and 170 characters.");
  }
  if (!canonicalUrl) warnings.push("Canonical URL is missing.");
  if (!String(page.og_image || "").trim()) warnings.push("OG image is missing.");
  if (page.noindex && page.sitemap_enabled) {
    warnings.push("Noindex page should not be included in sitemap.");
  }
  if (isPrivatePath(page.path) && !page.noindex) {
    warnings.push("Private/admin/payment pages should be noindex.");
  }

  if (page.schema_json) {
    try {
      JSON.parse(page.schema_json);
    } catch {
      warnings.push("Schema JSON is invalid.");
    }
  }

  const duplicateTitle = metaTitle
    ? allPages.filter(
        (item) =>
          item._id !== page._id &&
          String(item.meta_title || "").trim().toLowerCase() ===
            metaTitle.toLowerCase()
      ).length > 0
    : false;

  if (duplicateTitle) warnings.push("Duplicate meta title.");

  const duplicateDescription = metaDescription
    ? allPages.filter(
        (item) =>
          item._id !== page._id &&
          String(item.meta_description || "").trim().toLowerCase() ===
            metaDescription.toLowerCase()
      ).length > 0
    : false;

  if (duplicateDescription) warnings.push("Duplicate meta description.");

  return warnings;
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-700">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
    />
  );
}

function ImageUploadField({
  value,
  onChange,
  placeholder,
  uploadKey,
  uploading,
  onUpload,
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
        />

        <label
          className={`inline-flex cursor-pointer items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 ${
            uploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {uploading ? "Uploading..." : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                onUpload(uploadKey, file, onChange);
              }

              event.target.value = "";
            }}
          />
        </label>
      </div>

      {value && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
          <img
            src={value}
            alt="SEO preview"
            className="h-24 w-full rounded-lg object-cover"
          />
          <p className="mt-1 break-all text-[11px] text-gray-500">{value}</p>
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5"
      />
      <span>{label}</span>
    </label>
  );
}

export default function AdminSeoPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activePageSeoTab, setActivePageSeoTab] = useState("form");
  const [globalSeo, setGlobalSeo] = useState(defaultGlobalForm);
  const [pageForm, setPageForm] = useState(defaultPageForm);
  const [pages, setPages] = useState([]);
  const [editingPageId, setEditingPageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPage, setSavingPage] = useState(false);
  const [deletingPageId, setDeletingPageId] = useState("");
  const [uploadingImageField, setUploadingImageField] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const publicPageStatus = useMemo(() => {
    const pagesByPath = new Map();

    pages.forEach((page) => {
      const normalizedPath = normalizePagePath(page?.path);

      if (normalizedPath && !pagesByPath.has(normalizedPath)) {
        pagesByPath.set(normalizedPath, page);
      }
    });

    return defaultPublicPages.map((publicPage) => {
      const normalizedPath = normalizePagePath(publicPage.path);
      const seoPage = pagesByPath.get(normalizedPath) || null;

      return {
        ...publicPage,
        normalizedPath,
        configured: Boolean(seoPage),
        seoPage,
      };
    });
  }, [pages]);

  const configuredPublicPages = useMemo(
    () =>
      publicPageStatus
        .filter((page) => page.configured && page.seoPage)
        .map((page) => page.seoPage),
    [publicPageStatus]
  );

  const dashboardStats = useMemo(() => {
    const websitePages = defaultPublicPages.length;
    const configuredPages = configuredPublicPages.length;
    const seoMissing = Math.max(websitePages - configuredPages, 0);
    const missingTitle = countMissing(configuredPublicPages, "meta_title");
    const missingDescription = countMissing(
      configuredPublicPages,
      "meta_description"
    );
    const missingOgImage = countMissing(configuredPublicPages, "og_image");
    const sitemapPages = configuredPublicPages.filter(
      (page) => page.sitemap_enabled && !page.noindex
    ).length;
    const warnings = configuredPublicPages.reduce(
      (total, page) =>
        total + getPageWarnings(page, configuredPublicPages).length,
      0
    );

    return {
      websitePages,
      configuredPages,
      seoMissing,
      missingTitle,
      missingDescription,
      missingOgImage,
      sitemapPages,
      warnings,
    };
  }, [configuredPublicPages]);

  const robotsPreview = useMemo(() => {
    const customRobots = String(globalSeo.robots_txt || "").trim();

    if (customRobots) return customRobots;

    const sitemapUrl = buildCanonicalUrl(globalSeo.site_url, "/sitemap.xml");

    return [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin/",
      "Disallow: /backend/",
      "Disallow: /api/",
      "Disallow: /customer/dashboard",
      "Disallow: /booking/payment",
      "Disallow: /booking/paypal",
      "Disallow: /booking/success",
      "",
      `Sitemap: ${sitemapUrl}`,
    ].join("\n");
  }, [globalSeo.robots_txt, globalSeo.site_url]);

  const sitemapPages = useMemo(() => {
    return pages.filter((page) => page.sitemap_enabled && !page.noindex);
  }, [pages]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = getAdminToken();

    if (!token) {
      clearAdminSession();
      window.location.href = "/admin/login";
      return;
    }

    loadSeoData();
  }, [mounted]);

  async function loadSeoData() {
    try {
      setLoading(true);
      setError("");

      const [globalResponse, pagesResponse] = await Promise.all([
        axios.get("/admin/seo/global", {
          headers: getAuthHeaders(),
        }),
        axios.get("/admin/seo/pages", {
          headers: getAuthHeaders(),
        }),
      ]);

      if (globalResponse.data?.success === false) {
        throw new Error(
          globalResponse.data?.message ||
            globalResponse.data?.error ||
            "Failed to load global SEO."
        );
      }

      if (pagesResponse.data?.success === false) {
        throw new Error(
          pagesResponse.data?.message ||
            pagesResponse.data?.error ||
            "Failed to load page SEO."
        );
      }

      setGlobalSeo(normalizeGlobalSeo(globalResponse.data));
      setPages(extractPages(pagesResponse).map(normalizePageSeo));
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          "SEO API is not ready yet. Create the backend SEO routes next."
        )
      );

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        window.location.href = "/admin/login";
      }
    } finally {
      setLoading(false);
    }
  }

  function updateGlobalField(name, value) {
    setGlobalSeo((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
    setSuccessMessage("");
  }

  function updatePageField(name, value) {
    setPageForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
    setSuccessMessage("");
  }

  function resetPageForm() {
    setEditingPageId("");
    setPageForm(defaultPageForm);
    setError("");
    setSuccessMessage("");
  }

  function startEditPage(page) {
    setEditingPageId(page._id || page.id || "");
    setPageForm(normalizePageSeo(page));
    setActiveTab("pages");
    setActivePageSeoTab("form");
    setError("");
    setSuccessMessage("");
  }

  function selectDefaultPage(page) {
    const path = page.path;
    const canonicalUrl = buildCanonicalUrl(globalSeo.site_url, path);

    setEditingPageId("");
    setPageForm({
      ...defaultPageForm,
      page_name: page.page_name,
      path,
      canonical_url: canonicalUrl,
      meta_title: page.page_name
        ? `${page.page_name} | ${globalSeo.site_name || "Website"}`
        : "",
      og_title: page.page_name || "",
      twitter_title: page.page_name || "",
    });
    setActiveTab("pages");
    setActivePageSeoTab("form");
    setError("");
    setSuccessMessage("");
  }

  async function uploadSeoImage(uploadKey, file, onSuccess) {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, PNG, and WebP images are allowed.");
      return;
    }

    if (file.size > maxSize) {
      setError("Image size must be less than 5MB.");
      return;
    }

    try {
      setUploadingImageField(uploadKey);
      setError("");
      setSuccessMessage("");

      const formData = new FormData();
      formData.append("image", file);
      formData.append("field", uploadKey);

      const res = await axios.post("/admin/seo/upload-image", formData, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to upload image."
        );
      }

      const imageUrl =
        res.data?.data?.url ||
        res.data?.data?.secure_url ||
        res.data?.url ||
        "";

      if (!imageUrl) {
        throw new Error("Upload completed but image URL was not returned.");
      }

      onSuccess(imageUrl);
      setSuccessMessage("Image uploaded successfully.");
    } catch (error) {
      setError(getErrorMessage(error, "Failed to upload image."));

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        window.location.href = "/admin/login";
      }
    } finally {
      setUploadingImageField("");
    }
  }

  async function handleSaveGlobal(event) {
    event.preventDefault();

    try {
      setSavingGlobal(true);
      setError("");
      setSuccessMessage("");

      const res = await axios.patch("/admin/seo/global", globalSeo, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to save global SEO."
        );
      }

      setGlobalSeo(normalizeGlobalSeo(res.data));
      setSuccessMessage("Global SEO saved successfully.");
    } catch (error) {
      setError(getErrorMessage(error, "Failed to save global SEO."));

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        window.location.href = "/admin/login";
      }
    } finally {
      setSavingGlobal(false);
    }
  }

  async function handleSavePage(event) {
    event.preventDefault();

    const payload = {
      ...pageForm,
      page_name: String(pageForm.page_name || "").trim(),
      path: String(pageForm.path || "").trim(),
      meta_title: String(pageForm.meta_title || "").trim(),
      meta_description: String(pageForm.meta_description || "").trim(),
      canonical_url: String(pageForm.canonical_url || "").trim(),
      sitemap_priority: Number(pageForm.sitemap_priority || 0.8),
    };

    if (!payload.page_name) {
      setError("Page name is required.");
      return;
    }

    if (!payload.path || !payload.path.startsWith("/")) {
      setError("Page path must start with /.");
      return;
    }

    if (payload.schema_json) {
      try {
        JSON.parse(payload.schema_json);
      } catch {
        setError("Schema JSON is invalid.");
        return;
      }
    }

    try {
      setSavingPage(true);
      setError("");
      setSuccessMessage("");

      const request = editingPageId
        ? axios.patch(`/admin/seo/pages/${editingPageId}`, payload, {
            headers: getAuthHeaders(),
          })
        : axios.post("/admin/seo/pages", payload, {
            headers: getAuthHeaders(),
          });

      const res = await request;

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to save page SEO."
        );
      }

      setSuccessMessage("Page SEO saved successfully.");
      resetPageForm();
      setActivePageSeoTab("list");
      await loadSeoData();
    } catch (error) {
      setError(getErrorMessage(error, "Failed to save page SEO."));

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        window.location.href = "/admin/login";
      }
    } finally {
      setSavingPage(false);
    }
  }

  async function handleDeletePage(page) {
    const pageId = page._id || page.id;

    if (!pageId) return;

    const confirmed = window.confirm(
      `Delete SEO settings for "${page.page_name || page.path}"?`
    );

    if (!confirmed) return;

    try {
      setDeletingPageId(pageId);
      setError("");
      setSuccessMessage("");

      const res = await axios.delete(`/admin/seo/pages/${pageId}`, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to delete page SEO."
        );
      }

      setSuccessMessage("Page SEO deleted successfully.");
      await loadSeoData();
    } catch (error) {
      setError(getErrorMessage(error, "Failed to delete page SEO."));
    } finally {
      setDeletingPageId("");
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-5 text-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
          Admin
        </p>

        <h1 className="mt-1 text-xl font-bold text-gray-950 md:text-2xl">
          SEO Manager
        </h1>

        <p className="mt-2 text-xs text-gray-500">
          Manage page metadata, sitemap settings, robots.txt, social previews,
          and SEO warnings for public pages.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-700">
          Loading SEO settings...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-xs font-semibold text-green-700">
          {successMessage}
        </div>
      )}

      {activeTab === "dashboard" && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Website Pages", dashboardStats.websitePages],
              ["SEO Configured", dashboardStats.configuredPages],
              ["SEO Missing", dashboardStats.seoMissing],
              ["Missing Titles", dashboardStats.missingTitle],
              ["Missing Descriptions", dashboardStats.missingDescription],
              ["Missing OG Images", dashboardStats.missingOgImage],
              ["SEO Warnings", dashboardStats.warnings],
              ["Sitemap Pages", dashboardStats.sitemapPages],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-xl font-black text-gray-950">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-gray-950">
              Create SEO for Existing Pages
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              All public static pages from your project are listed here. Missing
              pages can be configured, and configured pages open directly for
              editing.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {publicPageStatus.map((page) => {
                const warningCount = page.seoPage
                  ? getPageWarnings(page.seoPage, configuredPublicPages).length
                  : 0;

                return (
                  <button
                    key={page.path}
                    type="button"
                    onClick={() =>
                      page.seoPage
                        ? startEditPage(page.seoPage)
                        : selectDefaultPage(page)
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900">
                          {page.page_name}
                        </p>
                        <p className="mt-1 break-all text-gray-500">
                          {page.path}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                          page.configured
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {page.configured ? "Configured" : "Missing SEO"}
                      </span>
                    </div>

                    {page.configured && warningCount > 0 && (
                      <p className="mt-2 text-[11px] font-semibold text-amber-700">
                        {warningCount} SEO warning{warningCount === 1 ? "" : "s"}
                      </p>
                    )}

                    {page.configured && warningCount === 0 && (
                      <p className="mt-2 text-[11px] font-semibold text-green-700">
                        SEO record looks complete
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "global" && (
        <form
          onSubmit={handleSaveGlobal}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-bold text-gray-950">Global SEO</h2>
          <p className="mt-1 text-xs text-gray-500">
            These values are used when a page has no custom SEO settings.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Site Name">
              <TextInput
                value={globalSeo.site_name}
                onChange={(value) => updateGlobalField("site_name", value)}
                placeholder="Sovereign Parking"
              />
            </Field>

            <Field label="Website URL">
              <TextInput
                value={globalSeo.site_url}
                onChange={(value) => updateGlobalField("site_url", value)}
                placeholder="https://yourdomain.com"
              />
            </Field>

            <Field label="Default Meta Title">
              <TextInput
                value={globalSeo.default_meta_title}
                onChange={(value) =>
                  updateGlobalField("default_meta_title", value)
                }
                placeholder="Sovereign Parking | Secure Parking Booking"
              />
            </Field>

            <Field label="Default Keywords">
              <TextInput
                value={globalSeo.default_keywords}
                onChange={(value) =>
                  updateGlobalField("default_keywords", value)
                }
                placeholder="cruise parking, airport parking, storage parking"
              />
            </Field>

            <Field label="Default Meta Description">
              <TextArea
                value={globalSeo.default_meta_description}
                onChange={(value) =>
                  updateGlobalField("default_meta_description", value)
                }
                placeholder="Book secure cruise, airport and storage parking online."
              />
            </Field>

            <Field label="Default OG Image">
              <ImageUploadField
                value={globalSeo.default_og_image}
                onChange={(value) =>
                  updateGlobalField("default_og_image", value)
                }
                placeholder="/uploads/seo/default-og.webp"
                uploadKey="global_default_og_image"
                uploading={uploadingImageField === "global_default_og_image"}
                onUpload={uploadSeoImage}
              />
            </Field>

            <Field label="Google Search Console Code">
              <TextInput
                value={globalSeo.google_site_verification}
                onChange={(value) =>
                  updateGlobalField("google_site_verification", value)
                }
                placeholder="google-site-verification value"
              />
            </Field>

            <Field label="Google Analytics / GTM ID">
              <TextInput
                value={globalSeo.google_analytics_id}
                onChange={(value) =>
                  updateGlobalField("google_analytics_id", value)
                }
                placeholder="G-XXXXXXXXXX or GTM-XXXXXXX"
              />
            </Field>

            <Field label="Meta (Facebook) Pixel ID">
              <div className="space-y-1.5">
                <TextInput
                  value={globalSeo.facebook_pixel_id}
                  onChange={(value) =>
                    updateGlobalField("facebook_pixel_id", value)
                  }
                  placeholder="123456789012345"
                />
                <p className="text-[11px] leading-4 text-gray-500">
                  Enter the numeric Pixel ID only, not the full Meta Pixel code.
                </p>
              </div>
            </Field>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Toggle
              checked={globalSeo.sitemap_enabled}
              onChange={(value) => updateGlobalField("sitemap_enabled", value)}
              label="Enable Sitemap"
            />
            <Toggle
              checked={globalSeo.default_noindex}
              onChange={(value) => updateGlobalField("default_noindex", value)}
              label="Default Noindex"
            />
            <Toggle
              checked={globalSeo.default_nofollow}
              onChange={(value) => updateGlobalField("default_nofollow", value)}
              label="Default Nofollow"
            />
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={savingGlobal}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingGlobal ? "Saving..." : "Save Global SEO"}
            </button>
          </div>
        </form>
      )}

      {activeTab === "pages" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActivePageSeoTab("form")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activePageSeoTab === "form"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-slate-100"
                }`}
              >
                {editingPageId ? "Edit Page SEO" : "Add Page SEO"}
              </button>

              <button
                type="button"
                onClick={() => setActivePageSeoTab("list")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activePageSeoTab === "list"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-slate-100"
                }`}
              >
                Saved Pages
              </button>
            </div>
          </div>

          {activePageSeoTab === "form" && (
            <form
              onSubmit={handleSavePage}
              className="mx-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-950">
                    {editingPageId ? "Edit Page SEO" : "Add Page SEO"}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Create SEO settings for an existing public route.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {editingPageId && (
                    <button
                      type="button"
                      onClick={resetPageForm}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-slate-50"
                    >
                      New
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActivePageSeoTab("list")}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                  >
                    View Saved Pages
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Page Name">
                  <TextInput
                    value={pageForm.page_name}
                    onChange={(value) => updatePageField("page_name", value)}
                    placeholder="Cruise Booking"
                  />
                </Field>

                <Field label="Page Path" hint="Path must start with /">
                  <TextInput
                    value={pageForm.path}
                    onChange={(value) => updatePageField("path", value)}
                    placeholder="/booking/cruise"
                  />
                </Field>

                <Field label="Meta Title">
                  <TextInput
                    value={pageForm.meta_title}
                    onChange={(value) => updatePageField("meta_title", value)}
                    placeholder="Cruise Parking Booking | Sovereign Parking"
                  />
                </Field>

                <Field label="Keywords">
                  <TextInput
                    value={pageForm.keywords}
                    onChange={(value) => updatePageField("keywords", value)}
                    placeholder="cruise parking, secure parking"
                  />
                </Field>

                <Field label="Meta Description">
                  <TextArea
                    value={pageForm.meta_description}
                    onChange={(value) =>
                      updatePageField("meta_description", value)
                    }
                    placeholder="Book secure cruise parking with shuttle service."
                  />
                </Field>

                <Field label="Canonical URL">
                  <TextInput
                    value={pageForm.canonical_url}
                    onChange={(value) => updatePageField("canonical_url", value)}
                    placeholder="https://yourdomain.com/booking/cruise"
                  />
                </Field>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <Toggle
                  checked={pageForm.noindex}
                  onChange={(value) => updatePageField("noindex", value)}
                  label="Noindex"
                />
                <Toggle
                  checked={pageForm.nofollow}
                  onChange={(value) => updatePageField("nofollow", value)}
                  label="Nofollow"
                />
                <Toggle
                  checked={pageForm.sitemap_enabled}
                  onChange={(value) =>
                    updatePageField("sitemap_enabled", value)
                  }
                  label="Sitemap"
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Field label="Sitemap Priority">
                  <TextInput
                    type="number"
                    value={pageForm.sitemap_priority}
                    onChange={(value) =>
                      updatePageField("sitemap_priority", value)
                    }
                    placeholder="0.8"
                  />
                </Field>

                <Field label="Change Frequency">
                  <select
                    value={pageForm.sitemap_changefreq}
                    onChange={(event) =>
                      updatePageField(
                        "sitemap_changefreq",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
                  >
                    {changeFrequencyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-gray-900">
                  Social Preview
                </p>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field label="OG Title">
                    <TextInput
                      value={pageForm.og_title}
                      onChange={(value) => updatePageField("og_title", value)}
                      placeholder="Cruise Parking Booking"
                    />
                  </Field>

                  <Field label="OG Image">
                    <ImageUploadField
                      value={pageForm.og_image}
                      onChange={(value) => updatePageField("og_image", value)}
                      placeholder="/uploads/seo/cruise-og.webp"
                      uploadKey="page_og_image"
                      uploading={uploadingImageField === "page_og_image"}
                      onUpload={uploadSeoImage}
                    />
                  </Field>

                  <Field label="OG Description">
                    <TextArea
                      value={pageForm.og_description}
                      onChange={(value) =>
                        updatePageField("og_description", value)
                      }
                      placeholder="Book secure cruise parking online."
                      rows={3}
                    />
                  </Field>

                  <Field label="Twitter Title">
                    <TextInput
                      value={pageForm.twitter_title}
                      onChange={(value) =>
                        updatePageField("twitter_title", value)
                      }
                      placeholder="Cruise Parking Booking"
                    />
                  </Field>

                  <Field label="Twitter Description">
                    <TextArea
                      value={pageForm.twitter_description}
                      onChange={(value) =>
                        updatePageField("twitter_description", value)
                      }
                      placeholder="Book secure cruise parking online."
                      rows={3}
                    />
                  </Field>

                  <Field label="Twitter Image">
                    <ImageUploadField
                      value={pageForm.twitter_image}
                      onChange={(value) =>
                        updatePageField("twitter_image", value)
                      }
                      placeholder="/uploads/seo/cruise-og.webp"
                      uploadKey="page_twitter_image"
                      uploading={uploadingImageField === "page_twitter_image"}
                      onUpload={uploadSeoImage}
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-5">
                <Field label="Schema JSON-LD">
                  <TextArea
                    value={pageForm.schema_json}
                    onChange={(value) => updatePageField("schema_json", value)}
                    placeholder='{"@context":"https://schema.org","@type":"Service"}'
                    rows={7}
                  />
                </Field>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPage}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingPage
                    ? "Saving..."
                    : editingPageId
                    ? "Update Page SEO"
                    : "Save Page SEO"}
                </button>
              </div>
            </form>
          )}

          {activePageSeoTab === "list" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-950">
                    Saved Pages
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    These records control metadata for public routes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetPageForm();
                    setActivePageSeoTab("form");
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white"
                >
                  Add New Page SEO
                </button>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Page</th>
                      <th className="px-3 py-2">Path</th>
                      <th className="px-3 py-2">Robots</th>
                      <th className="px-3 py-2">Sitemap</th>
                      <th className="px-3 py-2">Warnings</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {pages.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-6 text-center text-gray-500"
                        >
                          No page SEO records found.
                        </td>
                      </tr>
                    ) : (
                      pages.map((page) => {
                        const pageId = page._id || page.id || page.path;
                        const warnings = getPageWarnings(page, pages);

                        return (
                          <tr key={pageId} className="hover:bg-slate-50">
                            <td className="px-3 py-3">
                              <p className="font-bold text-gray-900">
                                {page.page_name || "—"}
                              </p>
                              <p className="mt-1 text-[11px] text-gray-500">
                                {page.meta_title || "No title"}
                              </p>
                            </td>
                            <td className="px-3 py-3 font-semibold text-gray-700">
                              {page.path}
                            </td>
                            <td className="px-3 py-3 text-gray-700">
                              {page.noindex ? "noindex" : "index"},{" "}
                              {page.nofollow ? "nofollow" : "follow"}
                            </td>
                            <td className="px-3 py-3 text-gray-700">
                              {page.sitemap_enabled && !page.noindex
                                ? "Enabled"
                                : "Disabled"}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                                  warnings.length
                                    ? "bg-red-50 text-red-700"
                                    : "bg-green-50 text-green-700"
                                }`}
                              >
                                {warnings.length
                                  ? `${warnings.length} issue(s)`
                                  : "Good"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditPage(page)}
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePage(page)}
                                  disabled={deletingPageId === pageId}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                                >
                                  {deletingPageId === pageId
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "sitemap" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-950">Sitemap</h2>
          <p className="mt-1 text-xs text-gray-500">
            Sitemap will include only pages with sitemap enabled and noindex
            disabled.
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="font-bold text-gray-900">Sitemap URL</p>
            <p className="mt-1 break-all text-blue-700">
              {buildCanonicalUrl(globalSeo.site_url, "/sitemap.xml")}
            </p>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">Page</th>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Changefreq</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {sitemapPages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      No pages are enabled for sitemap.
                    </td>
                  </tr>
                ) : (
                  sitemapPages.map((page) => (
                    <tr key={page._id || page.path}>
                      <td className="px-3 py-3 font-semibold text-gray-800">
                        {page.page_name}
                      </td>
                      <td className="px-3 py-3 text-blue-700">
                        {buildCanonicalUrl(globalSeo.site_url, page.path)}
                      </td>
                      <td className="px-3 py-3 text-gray-700">
                        {page.sitemap_priority}
                      </td>
                      <td className="px-3 py-3 text-gray-700">
                        {page.sitemap_changefreq}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "robots" && (
        <form
          onSubmit={handleSaveGlobal}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-bold text-gray-950">Robots.txt</h2>
          <p className="mt-1 text-xs text-gray-500">
            Leave empty to use the safe default below. Admin, API, customer
            dashboard, payment and success pages are blocked from crawling.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Custom robots.txt">
              <TextArea
                value={globalSeo.robots_txt}
                onChange={(value) => updateGlobalField("robots_txt", value)}
                rows={13}
                placeholder="User-agent: *"
              />
            </Field>

            <Field label="Preview">
              <pre className="min-h-[300px] whitespace-pre-wrap rounded-lg border border-slate-300 bg-slate-950 p-4 text-xs text-slate-50">
                {robotsPreview}
              </pre>
            </Field>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={savingGlobal}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingGlobal ? "Saving..." : "Save Robots Settings"}
            </button>
          </div>
        </form>
      )}

      {activeTab === "audit" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-950">SEO Audit</h2>
          <p className="mt-1 text-xs text-gray-500">
            Fix these warnings before publishing SEO changes.
          </p>

          <div className="mt-4 space-y-3">
            {pages.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-gray-500">
                No SEO pages available for audit.
              </div>
            ) : (
              pages.map((page) => {
                const warnings = getPageWarnings(page, pages);

                return (
                  <div
                    key={page._id || page.path}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-bold text-gray-900">
                          {page.page_name || page.path}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {page.path}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEditPage(page)}
                        className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                      >
                        Edit SEO
                      </button>
                    </div>

                    {warnings.length === 0 ? (
                      <p className="mt-3 rounded-lg bg-green-50 p-3 text-xs font-bold text-green-700">
                        No SEO issues found.
                      </p>
                    ) : (
                      <ul className="mt-3 list-disc space-y-1 rounded-lg bg-red-50 p-4 pl-7 text-xs font-semibold text-red-700">
                        {warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
