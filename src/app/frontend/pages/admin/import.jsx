"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/backend/router";

const CRUISE_IMPORT_API = "/admin/import/cruise-schedules";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

const TEMPLATE_HEADERS = [
  "location",
  "ship_name",
  "departure_date",
  "arrival_date",
  "capacity",
  "is_active",
];

const TEMPLATE_ROWS = [
  [
    "Brisbane Cruise Parking",
    "Pacific Explorer",
    "10/07/2026",
    "15/07/2026",
    120,
    true,
  ],
  [
    "Brisbane Cruise Parking",
    "Coral Princess",
    "01/08/2026",
    "08/08/2026",
    150,
    true,
  ],
];

const SAMPLE_CSV = `${TEMPLATE_HEADERS.join(",")}
${TEMPLATE_ROWS.map((row) => row.join(",")).join("\n")}
`;

function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
}

function buildApiUrl(path) {
  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const endpoint = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${endpoint}`;
}

function getAuthHeaders() {
  const token = getAdminToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function downloadFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function downloadSampleCsv() {
  const utf8Bom = "\uFEFF";

  const blob = new Blob([utf8Bom, SAMPLE_CSV], {
    type: "text/csv;charset=utf-8;",
  });

  downloadFile(blob, "cruise-schedules-import-template.csv");
}

function downloadSampleExcel() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ...TEMPLATE_ROWS,
  ]);

  // Force the date cells to remain visible as DD/MM/YYYY text.
  for (let rowNumber = 2; rowNumber <= TEMPLATE_ROWS.length + 1; rowNumber += 1) {
    ["C", "D"].forEach((column) => {
      const address = `${column}${rowNumber}`;

      if (worksheet[address]) {
        worksheet[address].t = "s";
        worksheet[address].v = String(worksheet[address].v || "");
        worksheet[address].z = "@";
      }
    });
  }

  worksheet["!cols"] = [
    { wch: 30 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Cruise Schedules");

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  downloadFile(blob, "cruise-schedules-import-template.xlsx");
}

function normalizeImportResult(payload) {
  const data = payload?.data || payload || {};

  return {
    totalRows: Number(data.totalRows || data.total_rows || data.total || 0),
    insertedCount: Number(
      data.insertedCount ||
        data.inserted_count ||
        data.imported ||
        data.inserted ||
        0
    ),
    skippedCount: Number(
      data.skippedCount || data.skipped_count || data.skipped || 0
    ),
    failedCount: Number(
      data.failedCount || data.failed_count || data.failed || 0
    ),
    errors: Array.isArray(data.errors) ? data.errors : [],
  };
}

async function readResponseJson(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      message: text,
    };
  }
}

function getErrorMessage(error) {
  return (
    error?.payload?.message ||
    error?.payload?.error ||
    error?.message ||
    "Import failed."
  );
}

function getRowErrorText(item) {
  if (Array.isArray(item?.errors)) {
    return item.errors.join(", ");
  }

  return item?.error || item?.reason || "-";
}

function validateSelectedFile(selectedFile) {
  if (!selectedFile) {
    return "Please select a CSV or Excel file.";
  }

  const lowerName = selectedFile.name.toLowerCase();
  const isAllowed = ALLOWED_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension)
  );

  if (!isAllowed) {
    return "Only CSV, XLSX, or XLS files are allowed.";
  }

  if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
    return `File size must be less than ${MAX_FILE_SIZE_MB}MB.`;
  }

  return "";
}

export default function AdminImportPage() {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const selectedFileLabel = useMemo(() => {
    if (!file) return "No file selected";
    return `${file.name} (${Math.ceil(file.size / 1024)} KB)`;
  }, [file]);

  async function handleSubmit(event) {
    event.preventDefault();

    const fileError = validateSelectedFile(file);

    if (fileError) {
      setError(fileError);
      return;
    }

    const token = getAdminToken();

    if (!token) {
      setError("Admin session missing. Please login again.");
      return;
    }

    try {
      setImporting(true);
      setError("");
      setResult(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(buildApiUrl(CRUISE_IMPORT_API), {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      const payload = await readResponseJson(response);

      if (!response.ok || payload?.success === false) {
        const fetchError = new Error(
          payload?.message || payload?.error || "Import failed."
        );

        fetchError.payload = payload;
        throw fetchError;
      }

      setResult(normalizeImportResult(payload));
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setError(getErrorMessage(error));

      if (error?.payload) {
        setResult(normalizeImportResult(error.payload));
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Admin
          </p>

          <h1 className="mt-1 text-3xl font-bold text-gray-950">Import</h1>

          <p className="mt-2 text-sm text-gray-500">
            Import cruise schedules from CSV or Excel. Prices and shuttle slots
            are still controlled from Settings.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-950">
                Import Cruise Schedules
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Required columns:{" "}
                <strong>
                  location, ship_name, departure_date, arrival_date, capacity
                </strong>
                . Optional column: <strong>is_active</strong>.
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Recommended date format: <strong>DD/MM/YYYY</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100"
              >
                Download CSV Template
              </button>

              <button
                type="button"
                onClick={downloadSampleExcel}
                className="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-bold text-green-700 hover:bg-green-100"
              >
                Download Excel Template
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Upload CSV / Excel File
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0] || null;

                  setFile(selectedFile);
                  setError("");
                  setResult(null);

                  const validationError = validateSelectedFile(selectedFile);

                  if (selectedFile && validationError) {
                    setError(validationError);
                  }
                }}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              />

              <p className="mt-2 text-xs text-gray-500">{selectedFileLabel}</p>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={importing || !file}
              className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing ? "Importing..." : "Import Cruise"}
            </button>
          </form>
        </div>

        {result && (
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">Import Result</h2>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <ResultCard label="Total Rows" value={result.totalRows} />
              <ResultCard label="Inserted" value={result.insertedCount} />
              <ResultCard label="Skipped" value={result.skippedCount} />
              <ResultCard label="Failed" value={result.failedCount} />
            </div>

            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-red-700">
                  Failed / Skipped Rows
                </h3>

                <div className="mt-3 overflow-x-auto rounded-2xl border">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Ship</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Reason</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {result.errors.map((item, index) => (
                        <tr key={`${item.row || "row"}-${index}`}>
                          <td className="px-4 py-3 font-bold">
                            {item.row || "-"}
                          </td>

                          <td className="px-4 py-3">
                            {item.ship_name ||
                              item.shipName ||
                              item.schedule_name ||
                              "-"}
                          </td>

                          <td className="px-4 py-3">
                            {item.location || "-"}
                          </td>

                          <td className="px-4 py-3 text-red-700">
                            {getRowErrorText(item)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-5">
      <p className="text-sm font-semibold text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-950">{value}</p>
    </div>
  );
}
