import { connectDB } from "@/app/backend/database/mongodb";
import { createAdminStorageBooking } from "@/app/backend/controller/admin";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await connectDB();

    return await createAdminStorageBooking(req);
  } catch (error) {
    console.error("Admin storage booking create route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create storage booking",
        error: error.message || "Failed to create storage booking",
      },
      { status: 500 }
    );
  }
}