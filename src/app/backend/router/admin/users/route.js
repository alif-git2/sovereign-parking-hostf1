import { connectDB } from "@/app/backend/database/mongodb";
import {
  getAdminUsers,
  createAdminUser,
} from "@/app/backend/controller/adminUsers";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getAdminUsers(req);
  } catch (error) {
    console.error("Admin users route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Users fetch failed",
        error: error.message || "Users fetch failed",
      },
      { status: 400 }
    );
  }
}

export async function POST(req) {
  try {
    await connectDB();
    return await createAdminUser(req);
  } catch (error) {
    console.error("Admin user create route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "User create failed",
        error: error.message || "User create failed",
      },
      { status: 400 }
    );
  }
}