import { connectDB } from "@/app/backend/database/mongodb";
import { loginUser } from "@/app/backend/controller/auth";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await connectDB();

    return await loginUser(req);
  } catch (error) {
    console.error("Login route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Login failed",
        error: error.message || "Login failed",
      },
      { status: 500 }
    );
  }
}