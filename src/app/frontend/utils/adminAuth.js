export function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
}

export function getAdminUser() {
  if (typeof window === "undefined") return null;

  const rawUser = localStorage.getItem("adminUser");

  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

export function setAdminSession({ token, user }) {
  if (typeof window === "undefined") return;

  localStorage.setItem("adminToken", token);
  localStorage.setItem("adminUser", JSON.stringify(user));
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
}

export function getAdminAuthHeaders() {
  const token = getAdminToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}