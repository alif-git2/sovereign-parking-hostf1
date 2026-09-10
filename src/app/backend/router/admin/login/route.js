import { connectDB } from "@/app/backend/database/mongodb";
import { loginAdmin } from "@/app/backend/controller/auth";

export async function POST(req) {
  try {
    await connectDB();
    return await loginAdmin(req);
  } catch (error) {
    console.error("Admin login route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Admin login failed",
        error: error.message || "Admin login failed",
      },
      { status: 500 }
    );
  }
}