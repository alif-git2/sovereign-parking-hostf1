import { connectDB } from "@/app/backend/database/mongodb";
import {
  createAdminShuttleTimeSlot,
  getAdminShuttleTimeSlots,
} from "@/app/backend/controller/setting";

export const runtime = "nodejs";

export async function GET(req) {
  await connectDB();
  return getAdminShuttleTimeSlots(req);
}

export async function POST(req) {
  await connectDB();
  return createAdminShuttleTimeSlot(req);
}