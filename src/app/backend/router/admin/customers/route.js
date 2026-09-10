import { connectDB } from "@/app/backend/database/mongodb";
import { getAdminCustomers } from "@/app/backend/controller/adminCustomers";
import { getAuthErrorStatus } from "@/app/backend/utils/authToken";

export const runtime = "nodejs";

function getErrorStatus(message = "") {
  const authStatus = getAuthErrorStatus(message);

  if (authStatus !== 400) {
    return authStatus;
  }

  const value = String(message || "").toLowerCase();

  if (value.includes("not found")) return 404;
  if (value.includes("invalid") || value.includes("required")) return 400;

  return 500;
}

export async function GET(req) {
  try {
    await connectDB();

    return await getAdminCustomers(req);
  } catch (error) {
    console.error("Admin customers GET route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch customers",
        error: error.message || "Failed to fetch customers",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}