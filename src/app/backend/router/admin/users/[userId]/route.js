import { connectDB } from "@/app/backend/database/mongodb";
import {
  getAdminUser,
  updateAdminUser,
  deleteAdminUser,
} from "@/app/backend/controller/adminUsers";

export const runtime = "nodejs";

async function getUserId(context) {
  const params = await context.params;
  return String(params?.userId || "").trim();
}

export async function GET(req, context) {
  try {
    await connectDB();

    const userId = await getUserId(context);

    return await getAdminUser(req, userId);
  } catch (error) {
    console.error("Admin user fetch route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "User fetch failed",
        error: error.message || "User fetch failed",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(req, context) {
  try {
    await connectDB();

    const userId = await getUserId(context);

    return await updateAdminUser(req, userId);
  } catch (error) {
    console.error("Admin user update route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "User update failed",
        error: error.message || "User update failed",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    await connectDB();

    const userId = await getUserId(context);

    return await deleteAdminUser(req, userId);
  } catch (error) {
    console.error("Admin user delete route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "User delete failed",
        error: error.message || "User delete failed",
      },
      { status: 400 }
    );
  }
}