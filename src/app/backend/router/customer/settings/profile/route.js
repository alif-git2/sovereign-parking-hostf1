import { connectDB } from "@/app/backend/database/mongodb";
import { updateCustomerProfile } from "@/app/backend/controller/customerSettings";

export const runtime = "nodejs";

export async function PATCH(req) {
  try {
    await connectDB();
    return await updateCustomerProfile(req);
  } catch (error) {
    console.error("Profile route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Profile update failed",
        error: error.message || "Profile update failed",
      },
      { status: 400 }
    );
  }
}