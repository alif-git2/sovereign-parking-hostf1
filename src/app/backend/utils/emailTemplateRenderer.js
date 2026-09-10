function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderEmailTemplate(template = "", variables = {}) {
  return String(template || "").replace(
    /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g,
    (_, key) => escapeHtml(variables[key] ?? "")
  );
}

export function hasUsableEmailTemplate(template) {
  return Boolean(
    template &&
      template.is_active !== false &&
      typeof template.html === "string" &&
      template.html.trim()
  );
}