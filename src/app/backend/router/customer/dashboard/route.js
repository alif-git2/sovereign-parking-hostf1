import { connectDB } from "@/app/backend/database/mongodb";
import { getCustomerDashboard } from "@/app/backend/controller/customer";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();

    return await getCustomerDashboard(req);
  } catch (error) {
    console.error("Customer dashboard route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load customer dashboard",
        error: error.message || "Failed to load customer dashboard",
      },
      { status: 500 }
    );
  }
}