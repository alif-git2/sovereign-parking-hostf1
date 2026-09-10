"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "@/app/frontend/utils/axios";

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  featured_image: "",
  featured_image_alt: "",
  category: "",
  tags: "",
  author_name: "",
  status: "draft",
  is_featured: false,
  meta_title: "",
  meta_description: "",
  meta_keywords: "",
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
  sitemap_priority: 0.7,
  sitemap_changefreq: "monthly",
  schema_json: "",
};

const statusOptions = ["draft", "published", "archived"];
const changefreqOptions = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
];

function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
}

function getAuthHeaders() {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearAdminSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
}

function getStoredAdminUser() {
  if (typeof window === "undefined") return null;

  try {
    const rawUser = localStorage.getItem("adminUser");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function clean(value = "") {
  return String(value || "").trim();
}

function createSlug(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function getErrorMessage(error, fallback = "Something went wrong.") {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function extractPosts(response) {
  return response?.data?.data?.posts || response?.data?.posts || [];
}

function extractPagination(response) {
  return (
    response?.data?.data?.pagination ||
    response?.data?.pagination ||
    { page: 1, limit: 10, total: 0, total_pages: 1 }
  );
}

function normalizePost(post = {}) {
  return {
    ...emptyForm,
    ...post,
    tags: Array.isArray(post.tags) ? post.tags.join(", ") : post.tags || "",
    is_featured: Boolean(post.is_featured),
    noindex: Boolean(post.noindex),
    nofollow: Boolean(post.nofollow),
    sitemap_enabled: post.sitemap_enabled !== false,
    sitemap_priority:
      post.sitemap_priority === undefined || post.sitemap_priority === null
        ? 0.7
        : Number(post.sitemap_priority),
    sitemap_changefreq: post.sitemap_changefreq || "monthly",
    schema_json:
      typeof post.schema_json === "string"
        ? post.schema_json
        : post.schema_json
        ? JSON.stringify(post.schema_json, null, 2)
        : "",
  };
}

function buildPayload(form) {
  const autoExcerpt = stripHtml(form.excerpt || form.content).slice(0, 260);

  return {
    ...form,
    title: clean(form.title),
    slug: createSlug(form.slug || form.title),
    excerpt: autoExcerpt,
    featured_image: clean(form.featured_image),
    featured_image_alt: clean(form.featured_image_alt),
    category: clean(form.category),
    author_name: clean(form.author_name),
    meta_title: clean(form.meta_title),
    meta_description: clean(form.meta_description),
    meta_keywords: clean(form.meta_keywords),
    canonical_url: clean(form.canonical_url),
    og_title: clean(form.og_title),
    og_description: clean(form.og_description),
    og_image: clean(form.og_image),
    twitter_title: clean(form.twitter_title),
    twitter_description: clean(form.twitter_description),
    twitter_image: clean(form.twitter_image),
    tags: clean(form.tags)
      .split(",")
      .map((tag) => clean(tag))
      .filter(Boolean),
    sitemap_priority: Number(form.sitemap_priority || 0.7),
  };
}

function getWarnings(form) {
  const warnings = [];
  const metaTitle = clean(form.meta_title);
  const metaDescription = clean(form.meta_description);

  if (!clean(form.title)) warnings.push("Title is missing.");
  if (!clean(form.slug)) warnings.push("Slug is missing.");
  if (!stripHtml(form.content)) warnings.push("Content is missing.");
  if (!clean(form.featured_image)) warnings.push("Featured image is missing.");
  if (!metaTitle) warnings.push("Meta title is missing.");
  if (metaTitle && metaTitle.length > 65) warnings.push("Meta title is too long.");
  if (!metaDescription) warnings.push("Meta description is missing.");
  if (metaDescription && (metaDescription.length < 80 || metaDescription.length > 170)) {
    warnings.push("Meta description should be between 80 and 170 characters.");
  }
  if (form.noindex && form.sitemap_enabled) {
    warnings.push("Noindex post should not be included in sitemap.");
  }
  if (form.schema_json) {
    try {
      JSON.parse(form.schema_json);
    } catch {
      warnings.push("Schema JSON is invalid.");
    }
  }

  return warnings;
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-700">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  onBlur,
  list,
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      list={list}
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

function RichTextEditor({
  value,
  onChange,
  placeholder = "Write here...",
  minHeight = 280,
  mediaUploadKey,
  uploadingMedia,
  onMediaUpload,
}) {
  const editorRef = useRef(null);
  const mediaInputRef = useRef(null);
  const [mode, setMode] = useState("visual");
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("p");

  const formatOptions = [
    { value: "p", label: "Paragraph" },
    { value: "h1", label: "Heading 1" },
    { value: "h2", label: "Heading 2" },
    { value: "h3", label: "Heading 3" },
    { value: "h4", label: "Heading 4" },
    { value: "h5", label: "Heading 5" },
    { value: "h6", label: "Heading 6" },
    { value: "pre", label: "Preformatted" },
    { value: "blockquote", label: "Quote Block" },
  ];

  const selectedFormatLabel =
    formatOptions.find((option) => option.value === selectedFormat)?.label ||
    "Paragraph";

  const wordCount = useMemo(() => {
    const text = stripHtml(value);
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }, [value]);

  useEffect(() => {
    if (mode !== "visual" || !editorRef.current) return;

    try {
      document.execCommand("enableObjectResizing", false, "true");
    } catch {
      // Browser may not support this command. Native image selection still works.
    }

    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [mode, value]);

  function updateVisualValue() {
    onChange(editorRef.current?.innerHTML || "");
  }

  function keepToolbarFocus(event) {
    event.preventDefault();
  }

  function runCommand(command, commandValue = null) {
    if (typeof document === "undefined") return;

    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    updateVisualValue();
  }

  function applyFormat(formatValue) {
    setSelectedFormat(formatValue);
    setFormatMenuOpen(false);
    runCommand("formatBlock", formatValue);
  }

  function insertLink() {
    const url = window.prompt("Enter link URL");

    if (!url) return;

    runCommand("createLink", url);
  }

  function escapeAttribute(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function insertHtml(html) {
    if (mode === "visual" && editorRef.current) {
      editorRef.current.focus();
      document.execCommand("insertHTML", false, html);
      updateVisualValue();
      return;
    }

    onChange(`${value || ""}\n${html}`);
  }

  function insertUploadedImage(imageUrl) {
    const safeUrl = escapeAttribute(imageUrl);
    const imageHtml = `<p><span class="blog-editor-image-wrap" contenteditable="false" style="display:inline-block;width:360px;max-width:100%;resize:both;overflow:auto;border:1px dashed #2563eb;padding:3px;border-radius:12px;"><img src="${safeUrl}" alt="" style="width:100%;height:100%;object-fit:contain;display:block;border-radius:8px;" /></span></p>`;

    insertHtml(imageHtml);
  }

  function handleMediaChange(event) {
    const file = event.target.files?.[0];

    if (file && onMediaUpload) {
      onMediaUpload(mediaUploadKey || "editor_media", file, insertUploadedImage);
    }

    event.target.value = "";
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleMediaChange}
          />

          <button
            type="button"
            onMouseDown={keepToolbarFocus}
            onClick={() => mediaInputRef.current?.click()}
            disabled={uploadingMedia}
            className="h-8 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploadingMedia ? "Uploading..." : "Add Media"}
          </button>

          <div className="relative">
            <button
              type="button"
              onMouseDown={keepToolbarFocus}
              onClick={() => setFormatMenuOpen((prev) => !prev)}
              className="flex h-8 min-w-[150px] items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-gray-700 outline-none hover:bg-slate-50"
            >
              <span>{selectedFormatLabel}</span>
              <span className="text-[10px]">▼</span>
            </button>

            {formatMenuOpen && (
              <div className="absolute left-0 top-9 z-30 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                {formatOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onMouseDown={keepToolbarFocus}
                    onClick={() => applyFormat(option.value)}
                    className={`block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-blue-50 ${
                      selectedFormat === option.value
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" onMouseDown={keepToolbarFocus} onClick={() => runCommand("bold")} className="h-8 rounded-md px-2 text-sm font-black text-gray-700 hover:bg-white" title="Bold">B</button>
          <button type="button" onMouseDown={keepToolbarFocus} onClick={() => runCommand("italic")} className="h-8 rounded-md px-2 text-sm font-black italic text-gray-700 hover:bg-white" title="Italic">I</button>
          <button type="button" onMouseDown={keepToolbarFocus} onClick={() => runCommand("insertUnorderedList")} className="h-8 rounded-md px-2 text-xs font-bold text-gray-700 hover:bg-white" title="Bullet list">• List</button>
          <button type="button" onMouseDown={keepToolbarFocus} onClick={() => runCommand("insertOrderedList")} className="h-8 rounded-md px-2 text-xs font-bold text-gray-700 hover:bg-white" title="Numbered list">1. List</button>
          <button type="button" onMouseDown={keepToolbarFocus} onClick={() => runCommand("formatBlock", "blockquote")} className="h-8 rounded-md px-2 text-sm font-black text-gray-700 hover:bg-white" title="Quote">“”</button>
          <button type="button" onMouseDown={keepToolbarFocus} onClick={() => runCommand("justifyLeft")} className="h-8 rounded-md px-2 text-xs font-bold text-gray-700 hover:bg-white" title="Align left">Left</button>
          <button type="button" onMouseDown={keepToolbarFocus} onClick={() => runCommand("justifyCenter")} className="h-8 rounded-md px-2 text-xs font-bold text-gray-700 hover:bg-white" title="Align center">Center</button>
          <button type="button" onMouseDown={keepToolbarFocus} onClick={() => runCommand("justifyRight")} className="h-8 rounded-md px-2 text-xs font-bold text-gray-700 hover:bg-white" title="Align right">Right</button>
          <button type="button" onMouseDown={keepToolbarFocus} onClick={insertLink} className="h-8 rounded-md px-2 text-xs font-bold text-gray-700 hover:bg-white" title="Insert link">Link</button>
          <button type="button" onMouseDown={keepToolbarFocus} onClick={() => runCommand("insertHorizontalRule")} className="h-8 rounded-md px-2 text-xs font-bold text-gray-700 hover:bg-white" title="Horizontal line">Line</button>
        </div>

        <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
          <button
            type="button"
            onMouseDown={keepToolbarFocus}
            onClick={() => setMode("visual")}
            className={`px-3 py-1.5 text-xs font-bold ${
              mode === "visual"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-slate-50"
            }`}
          >
            Visual
          </button>
          <button
            type="button"
            onMouseDown={keepToolbarFocus}
            onClick={() => setMode("code")}
            className={`border-l border-slate-300 px-3 py-1.5 text-xs font-bold ${
              mode === "code"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-slate-50"
            }`}
          >
            Code
          </button>
        </div>
      </div>

      {mode === "visual" ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={updateVisualValue}
          onBlur={updateVisualValue}
          onMouseUp={updateVisualValue}
          className="blog-rich-editor max-w-none overflow-y-auto bg-white px-4 py-3 text-sm leading-7 text-gray-800 outline-none"
          style={{ minHeight }}
          data-placeholder={placeholder}
        />
      ) : (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full resize-y border-0 px-4 py-3 text-xs font-mono leading-6 outline-none"
          style={{ minHeight }}
        />
      )}

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-gray-600">
        Word count: {wordCount}
      </div>
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

function ImageUploadField({ value, onChange, placeholder, uploadKey, uploading, onUpload }) {
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
          className={`inline-flex cursor-pointer items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 ${
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
              if (file) onUpload(uploadKey, file, onChange);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {value && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
          <img src={value} alt="Blog preview" className="h-28 w-full rounded-lg object-cover" />
          <p className="mt-1 break-all text-[11px] text-gray-500">{value}</p>
        </div>
      )}
    </div>
  );
}

export default function AdminBlogPostsPage() {
  const [mounted, setMounted] = useState(false);
  const [activeView, setActiveView] = useState("list");
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 });
  const [filters, setFilters] = useState({ search: "", status: "", category: "" });
  const [adminUser, setAdminUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [uploadingField, setUploadingField] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const warnings = useMemo(() => getWarnings(form), [form]);
  const currentAdminName =
    clean(adminUser?.name) ||
    clean(adminUser?.email) ||
    clean(form.author_name) ||
    "Admin";

  const stats = useMemo(
    () => ({
      loaded: posts.length,
      published: posts.filter((post) => post.status === "published").length,
      draft: posts.filter((post) => post.status === "draft").length,
      archived: posts.filter((post) => post.status === "archived").length,
    }),
    [posts]
  );

  const categoryOptions = useMemo(() => {
    return [
      ...new Set(posts.map((post) => clean(post.category)).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const tagOptions = useMemo(() => {
    return [
      ...new Set(
        posts
          .flatMap((post) => {
            if (Array.isArray(post.tags)) return post.tags;

            return clean(post.tags)
              .split(",")
              .map((tag) => clean(tag));
          })
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [posts]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const storedAdminUser = getStoredAdminUser();
    setAdminUser(storedAdminUser);

    if (!getAdminToken()) {
      clearAdminSession();
      window.location.href = "/admin/login";
      return;
    }
    loadPosts(1);
  }, [mounted]);

  async function loadPosts(page = pagination.page) {
    try {
      setLoading(true);
      setError("");
      const params = { page, limit: pagination.limit };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;

      const res = await axios.get("/admin/blog-posts", {
        headers: getAuthHeaders(),
        params,
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to load blog posts.");
      }

      setPosts(extractPosts(res));
      setPagination(extractPagination(res));
    } catch (error) {
      setError(getErrorMessage(error, "Failed to load blog posts."));
      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        window.location.href = "/admin/login";
      }
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(name, value) {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function updateForm(name, value) {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "slug") next.slug = createSlug(value);
      if (name === "noindex" && value) next.sitemap_enabled = false;
      if (name === "featured_image" && !prev.og_image) next.og_image = value;
      if (name === "og_image" && !prev.twitter_image) next.twitter_image = value;
      return next;
    });
    setError("");
    setSuccessMessage("");
  }

  function handleTitleBlur() {
    if (editingId || clean(form.slug)) return;

    const generatedSlug = createSlug(form.title);

    if (!generatedSlug) return;

    setForm((prev) => ({
      ...prev,
      slug: generatedSlug,
    }));
  }

  function addTagToForm(tag) {
    const cleanTag = clean(tag);

    if (!cleanTag) return;

    const existingTags = clean(form.tags)
      .split(",")
      .map((item) => clean(item))
      .filter(Boolean);

    if (
      existingTags.some(
        (item) => item.toLowerCase() === cleanTag.toLowerCase()
      )
    ) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      tags: [...existingTags, cleanTag].join(", "),
    }));
  }

  function resetForm() {
    setForm({
      ...emptyForm,
      author_name: currentAdminName,
    });
    setEditingId("");
    setError("");
    setSuccessMessage("");
  }

  function startCreate() {
    resetForm();
    setActiveView("form");
  }

  function startEdit(post) {
    setForm(normalizePost(post));
    setEditingId(post._id || post.id || "");
    setActiveView("form");
    setError("");
    setSuccessMessage("");
  }

  async function uploadBlogImage(uploadKey, file, onSuccess) {
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
      setUploadingField(uploadKey);
      setError("");
      setSuccessMessage("");
      const formData = new FormData();
      formData.append("image", file);
      formData.append("field", uploadKey);

      const res = await axios.post("/admin/blog-posts/upload-image", formData, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to upload image.");
      }

      const imageUrl = res.data?.data?.url || res.data?.data?.secure_url || res.data?.url || "";
      if (!imageUrl) throw new Error("Upload completed but image URL was not returned.");

      onSuccess(imageUrl);
      setSuccessMessage("Image uploaded successfully.");
    } catch (error) {
      setError(getErrorMessage(error, "Failed to upload image."));
      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        window.location.href = "/admin/login";
      }
    } finally {
      setUploadingField("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      ...buildPayload(form),
      author_name: clean(form.author_name) || currentAdminName,
    };

    if (!payload.title) {
      setError("Blog title is required.");
      return;
    }
    if (!payload.slug) {
      setError("Blog slug is required.");
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
      setSaving(true);
      setError("");
      setSuccessMessage("");
      const request = editingId
        ? axios.patch(`/admin/blog-posts/${editingId}`, payload, { headers: getAuthHeaders() })
        : axios.post("/admin/blog-posts", payload, { headers: getAuthHeaders() });
      const res = await request;

      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to save blog post.");
      }

      setSuccessMessage(editingId ? "Blog post updated successfully." : "Blog post created successfully.");
      resetForm();
      setActiveView("list");
      await loadPosts(1);
    } catch (error) {
      setError(getErrorMessage(error, "Failed to save blog post."));
      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        window.location.href = "/admin/login";
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(post) {
    const postId = post._id || post.id;
    if (!postId) return;
    const confirmed = window.confirm(`Delete blog post "${post.title || post.slug}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(postId);
      setError("");
      setSuccessMessage("");
      const res = await axios.delete(`/admin/blog-posts/${postId}`, { headers: getAuthHeaders() });
      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to delete blog post.");
      }
      setSuccessMessage("Blog post deleted successfully.");
      await loadPosts(1);
    } catch (error) {
      setError(getErrorMessage(error, "Failed to delete blog post."));
    } finally {
      setDeletingId("");
    }
  }

  async function quickChangeStatus(post, status) {
    const postId = post._id || post.id;
    if (!postId) return;
    try {
      setError("");
      setSuccessMessage("");
      const res = await axios.patch(
        `/admin/blog-posts/${postId}`,
        { status },
        { headers: getAuthHeaders() }
      );
      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to update status.");
      }
      setSuccessMessage("Blog status updated successfully.");
      await loadPosts(pagination.page);
    } catch (error) {
      setError(getErrorMessage(error, "Failed to update blog status."));
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-5 text-sm">
      <style jsx global>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }

        .blog-rich-editor h1 {
          margin: 1rem 0 0.75rem;
          font-size: 2rem;
          line-height: 1.2;
          font-weight: 800;
          color: #111827;
        }

        .blog-rich-editor h2 {
          margin: 1rem 0 0.65rem;
          font-size: 1.6rem;
          line-height: 1.25;
          font-weight: 800;
          color: #111827;
        }

        .blog-rich-editor h3 {
          margin: 0.9rem 0 0.55rem;
          font-size: 1.35rem;
          line-height: 1.3;
          font-weight: 800;
          color: #111827;
        }

        .blog-rich-editor h4,
        .blog-rich-editor h5,
        .blog-rich-editor h6 {
          margin: 0.8rem 0 0.5rem;
          font-weight: 800;
          color: #111827;
        }

        .blog-rich-editor p {
          margin: 0.65rem 0;
        }

        .blog-rich-editor ul {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
          list-style: disc;
        }

        .blog-rich-editor ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
          list-style: decimal;
        }

        .blog-rich-editor li {
          margin: 0.25rem 0;
        }

        .blog-rich-editor blockquote {
          margin: 1rem 0;
          border-left: 4px solid #2563eb;
          background: #eff6ff;
          padding: 0.75rem 1rem;
          font-weight: 600;
          color: #1e3a8a;
        }

        .blog-rich-editor pre {
          margin: 1rem 0;
          white-space: pre-wrap;
          border-radius: 0.75rem;
          background: #0f172a;
          padding: 1rem;
          font-size: 0.8rem;
          color: #f8fafc;
        }

        .blog-rich-editor a {
          color: #2563eb;
          text-decoration: underline;
        }

        .blog-rich-editor img {
          max-width: 100%;
          height: auto;
          display: inline-block;
          border-radius: 0.75rem;
        }

        .blog-rich-editor .blog-editor-image-wrap {
          resize: both;
          overflow: auto;
          min-width: 90px;
          min-height: 70px;
          max-width: 100%;
          cursor: nwse-resize;
          vertical-align: top;
        }

        .blog-rich-editor .blog-editor-image-wrap img {
          margin: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
          user-select: none;
        }

        .blog-rich-editor .blog-editor-image-wrap:hover {
          border-color: #1d4ed8 !important;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
        }

        .blog-rich-editor hr {
          margin: 1.2rem 0;
          border: 0;
          border-top: 1px solid #cbd5e1;
        }
      `}</style>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">Admin</p>
        <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-950 md:text-2xl">Blog Post</h1>
            <p className="mt-2 text-xs text-gray-500">
              Create and manage SEO-friendly blog posts for the public website.
            </p>
          </div>
          <button
            type="button"
            onClick={startCreate}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            Add New Blog
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Loaded Posts", stats.loaded],
          ["Published", stats.published],
          ["Drafts", stats.draft],
          ["Archived", stats.archived],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-black text-gray-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveView("list")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeView === "list" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-slate-100"
            }`}
          >
            Saved Posts
          </button>
          <button
            type="button"
            onClick={startCreate}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeView === "form" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-slate-100"
            }`}
          >
            {editingId ? "Edit Blog" : "Add Blog"}
          </button>
        </div>
      </div>

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

      {activeView === "list" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-950">Saved Posts</h2>
              <p className="mt-1 text-xs text-gray-500">Manage draft, published, and archived blog posts.</p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                loadPosts(1);
              }}
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[220px_150px_160px_auto]"
            >
              <TextInput value={filters.search} onChange={(value) => updateFilter("search", value)} placeholder="Search" />
              <select
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
              >
                <option value="">All Status</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <TextInput value={filters.category} onChange={(value) => updateFilter("category", value)} placeholder="Category" />
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white">
                Filter
              </button>
            </form>
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs font-semibold text-blue-700">
              Loading blog posts...
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Published</th>
                    <th className="px-3 py-2">Views</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {posts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">No blog posts found.</td>
                    </tr>
                  ) : (
                    posts.map((post) => {
                      const postId = post._id || post.id;
                      return (
                        <tr key={postId} className="hover:bg-slate-50">
                          <td className="px-3 py-3">
                            <p className="font-bold text-gray-900">{post.title}</p>
                          </td>

                          <td className="px-3 py-3 text-gray-700">
                            {post.category || "—"}
                          </td>

                          <td className="px-3 py-3">
                            <select
                              value={post.status || "draft"}
                              onChange={(event) => quickChangeStatus(post, event.target.value)}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold capitalize outline-none focus:border-blue-600"
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </td>

                          <td className="px-3 py-3 text-gray-700">
                            {formatDate(post.published_at)}
                          </td>

                          <td className="px-3 py-3 text-gray-700">
                            {post.views_count || 0}
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(post)}
                                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(post)}
                                disabled={deletingId === postId}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                              >
                                {deletingId === postId ? "Deleting..." : "Delete"}
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
          )}

          <div className="mt-4 flex flex-col gap-2 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <p>Page {pagination.page || 1} of {pagination.total_pages || 1} · {pagination.total || 0} total</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={(pagination.page || 1) <= 1}
                onClick={() => loadPosts((pagination.page || 1) - 1)}
                className="rounded-lg border px-3 py-1.5 font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={(pagination.page || 1) >= (pagination.total_pages || 1)}
                onClick={() => loadPosts((pagination.page || 1) + 1)}
                className="rounded-lg border px-3 py-1.5 font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {activeView === "form" && (
        <form onSubmit={handleSubmit} className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-950">{editingId ? "Edit Blog Post" : "Add Blog Post"}</h2>
              <p className="mt-1 text-xs text-gray-500">Create blog content, image, publishing status, and SEO.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-slate-50">
                  New
                </button>
              )}
              <button type="button" onClick={() => setActiveView("list")} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100">
                View Saved Posts
              </button>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-800">SEO / Content warnings</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] font-semibold text-amber-700">
                {warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Title">
              <TextInput
                value={form.title}
                onChange={(value) => updateForm("title", value)}
                onBlur={handleTitleBlur}
                placeholder="Best Cruise Parking Tips"
              />
            </Field>
            <Field label="Slug" hint="Public URL: /blog/your-slug"><TextInput value={form.slug} onChange={(value) => updateForm("slug", value)} placeholder="best-cruise-parking-tips" /></Field>
            <Field
              label="Category"
              hint="Select an existing category or type a new one."
            >
              <TextInput
                value={form.category}
                onChange={(value) => updateForm("category", value)}
                placeholder="Cruise Parking"
                list="blog-category-options"
              />
              <datalist id="blog-category-options">
                {categoryOptions.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>

              {categoryOptions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {categoryOptions.slice(0, 8).map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => updateForm("category", category)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
            </Field>

            <Field
              label="Tags"
              hint="Select existing tags or type new comma-separated tags."
            >
              <TextInput
                value={form.tags}
                onChange={(value) => updateForm("tags", value)}
                placeholder="cruise, parking, travel"
                list="blog-tag-options"
              />
              <datalist id="blog-tag-options">
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>

              {tagOptions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tagOptions.slice(0, 12).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTagToForm(tag)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Author Name" hint="Default comes from logged-in admin, but you can change it.">
              <TextInput
                value={form.author_name || currentAdminName}
                onChange={(value) => updateForm("author_name", value)}
                placeholder="Admin"
              />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600">
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <Field
              label="Content"
              hint="Use Visual mode for normal writing or Code mode for HTML. Add Media inserts an image into the content editor."
            >
              <RichTextEditor
                value={form.content}
                onChange={(value) => updateForm("content", value)}
                placeholder="Write the full blog post content here..."
                minHeight={360}
                mediaUploadKey="content_media"
                uploadingMedia={uploadingField === "content_media"}
                onMediaUpload={uploadBlogImage}
              />
            </Field>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Featured Image">
              <ImageUploadField value={form.featured_image} onChange={(value) => updateForm("featured_image", value)} placeholder="/uploads/blog/blog-image.webp" uploadKey="featured_image" uploading={uploadingField === "featured_image"} onUpload={uploadBlogImage} />
            </Field>
            <Field label="Featured Image Alt Text"><TextInput value={form.featured_image_alt} onChange={(value) => updateForm("featured_image_alt", value)} placeholder="Cruise parking tips" /></Field>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            <Toggle checked={form.is_featured} onChange={(value) => updateForm("is_featured", value)} label="Featured Post" />
            <Toggle checked={form.noindex} onChange={(value) => updateForm("noindex", value)} label="Noindex" />
            <Toggle checked={form.nofollow} onChange={(value) => updateForm("nofollow", value)} label="Nofollow" />
            <Toggle checked={form.sitemap_enabled} onChange={(value) => updateForm("sitemap_enabled", value)} label="Sitemap" />
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-gray-900">SEO Settings</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <Field label="Meta Title"><TextInput value={form.meta_title} onChange={(value) => updateForm("meta_title", value)} placeholder="Best Cruise Parking Tips | Sovereign Park" /></Field>
              <Field label="Meta Keywords"><TextInput value={form.meta_keywords} onChange={(value) => updateForm("meta_keywords", value)} placeholder="cruise parking tips, secure parking" /></Field>
              <Field label="Meta Description"><TextArea value={form.meta_description} onChange={(value) => updateForm("meta_description", value)} placeholder="Learn the best tips for booking secure cruise parking." rows={3} /></Field>
              <Field label="Canonical URL"><TextInput value={form.canonical_url} onChange={(value) => updateForm("canonical_url", value)} placeholder="http://localhost:3000/blog/best-cruise-parking-tips" /></Field>
              <Field label="Sitemap Priority"><TextInput type="number" value={form.sitemap_priority} onChange={(value) => updateForm("sitemap_priority", value)} placeholder="0.7" /></Field>
              <Field label="Change Frequency">
                <select value={form.sitemap_changefreq} onChange={(event) => updateForm("sitemap_changefreq", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600">
                  {changefreqOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-gray-900">Social Preview</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <Field label="OG Title"><TextInput value={form.og_title} onChange={(value) => updateForm("og_title", value)} placeholder="Best Cruise Parking Tips" /></Field>
              <Field label="OG Image"><ImageUploadField value={form.og_image} onChange={(value) => updateForm("og_image", value)} placeholder="/uploads/blog/blog-og.webp" uploadKey="og_image" uploading={uploadingField === "og_image"} onUpload={uploadBlogImage} /></Field>
              <Field label="OG Description"><TextArea value={form.og_description} onChange={(value) => updateForm("og_description", value)} placeholder="Learn the best tips for cruise parking." rows={3} /></Field>
              <Field label="Twitter Title"><TextInput value={form.twitter_title} onChange={(value) => updateForm("twitter_title", value)} placeholder="Best Cruise Parking Tips" /></Field>
              <Field label="Twitter Description"><TextArea value={form.twitter_description} onChange={(value) => updateForm("twitter_description", value)} placeholder="Learn the best tips for cruise parking." rows={3} /></Field>
              <Field label="Twitter Image"><ImageUploadField value={form.twitter_image} onChange={(value) => updateForm("twitter_image", value)} placeholder="/uploads/blog/blog-twitter.webp" uploadKey="twitter_image" uploading={uploadingField === "twitter_image"} onUpload={uploadBlogImage} /></Field>
            </div>
          </div>

          <div className="mt-5"><Field label="Schema JSON-LD"><TextArea value={form.schema_json} onChange={(value) => updateForm("schema_json", value)} placeholder='{"@context":"https://schema.org","@type":"BlogPosting"}' rows={7} /></Field></div>

          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving..." : editingId ? "Update Blog Post" : "Publish Blog Post"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
