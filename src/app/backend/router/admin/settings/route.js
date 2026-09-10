import { connectDB } from "@/app/backend/database/mongodb";
import {
  getAdminSettings,
  updateAdminSettings,
} from "@/app/backend/controller/setting";

export const runtime = "nodejs";

export async function GET(req) {
  await connectDB();
  return getAdminSettings(req);
}

export async function PATCH(req) {
  await connectDB();
  return updateAdminSettings(req);
}