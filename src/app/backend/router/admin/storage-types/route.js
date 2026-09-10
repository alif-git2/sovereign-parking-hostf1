import { connectDB } from "@/app/backend/database/mongodb";
import {
  createStorageType,
  getAdminStorageTypes,
} from "@/app/backend/controller/storagetype";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getAdminStorageTypes(req);
  } catch (error) {
    console.error("Admin storage types GET route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch storage types",
        error: error.message || "Failed to fetch storage types",
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectDB();
    return await createStorageType(req);
  } catch (error) {
    console.error("Admin storage types POST route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create storage type",
        error: error.message || "Failed to create storage type",
      },
      { status: 500 }
    );
  }
}