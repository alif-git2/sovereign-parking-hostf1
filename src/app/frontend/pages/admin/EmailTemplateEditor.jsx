"use client";

import { useMemo, useState } from "react";

function buildPreviewHtml(html = "") {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: #f3f4f6;
        font-family: Arial, Helvetica, sans-serif;
      }

      img {
        max-width: 100%;
      }

      table {
        max-width: 100%;
      }
    </style>
  </head>
  <body>
    ${html || ""}
  </body>
</html>
  `;
}

export default function EmailTemplateEditor({
  title,
  description,
  subject,
  html,
  text,
  isActive,
  disabled,
  onChange,
  onReset,
}) {
  const [mode, setMode] = useState("visual");

  const previewHtml = useMemo(() => buildPreviewHtml(html), [html]);

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>

          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>

        <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={isActive !== false}
            disabled={disabled}
            onChange={(event) => onChange("is_active", event.target.checked)}
          />
          Active
        </label>
      </div>

      <div className="mt-5">
        <label className="text-sm font-semibold text-gray-700">Subject</label>

        <input
          value={subject || ""}
          disabled={disabled}
          onChange={(event) => onChange("subject", event.target.value)}
          className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600 disabled:bg-gray-100"
          placeholder="Email subject"
        />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="text-sm font-semibold text-gray-700">
            Body Template
          </label>

          <div className="overflow-hidden rounded-lg border text-xs">
            <button
              type="button"
              onClick={() => setMode("visual")}
              className={`px-3 py-1.5 ${
                mode === "visual" ? "bg-gray-900 text-white" : "bg-white"
              }`}
            >
              Visual
            </button>

            <button
              type="button"
              onClick={() => setMode("code")}
              className={`border-l px-3 py-1.5 ${
                mode === "code" ? "bg-gray-900 text-white" : "bg-white"
              }`}
            >
              Code
            </button>
          </div>
        </div>

        {mode === "visual" ? (
          <iframe
            title={`${title} preview`}
            srcDoc={previewHtml}
            sandbox=""
            className="h-[420px] w-full rounded-xl border bg-gray-50"
          />
        ) : (
          <textarea
            value={html || ""}
            disabled={disabled}
            onChange={(event) => onChange("html", event.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full rounded-xl border px-4 py-3 font-mono text-xs outline-none focus:border-blue-600 disabled:bg-gray-100"
            placeholder="Write email HTML here..."
          />
        )}
      </div>

      <div className="mt-5">
        <label className="text-sm font-semibold text-gray-700">
          Plain Text Fallback
        </label>

        <textarea
          value={text || ""}
          disabled={disabled}
          onChange={(event) => onChange("text", event.target.value)}
          rows={4}
          className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-600 disabled:bg-gray-100"
          placeholder="Plain text email fallback..."
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={disabled}
          onClick={onReset}
          className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60"
        >
          Reset Default
        </button>
      </div>
    </div>
  );
}