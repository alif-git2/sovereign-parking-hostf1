import { connectDB } from "@/app/backend/database/mongodb";
import { getPublicShuttleTimeSlots } from "@/app/backend/controller/setting";

export const runtime = "nodejs";

export async function GET(req) {
  await connectDB();
  return getPublicShuttleTimeSlots(req);
}