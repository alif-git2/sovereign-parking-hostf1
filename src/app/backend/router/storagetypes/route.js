import { connectDB } from "@/app/backend/database/mongodb";
import {
  createStorageType,
  getStorageTypes,
} from "@/app/backend/controller/storagetype";

// GET → fetch storage types
// Example:
// /backend/router/storage-types
// /backend/router/storage-types?is_active=true
// /backend/router/storage-types?search=boat
export async function GET(req) {
  try {
    await connectDB();
    return await getStorageTypes(req);
  } catch (error) {
    console.error("Fetch storage types route failed:", error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}

// POST → create storage type
export async function POST(req) {
  try {
    await connectDB();
    return await createStorageType(req);
  } catch (error) {
    console.error("Create storage type route failed:", error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}