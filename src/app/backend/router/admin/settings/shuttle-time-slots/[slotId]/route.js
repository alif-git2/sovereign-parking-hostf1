import { connectDB } from "@/app/backend/database/mongodb";
import {
  deleteAdminShuttleTimeSlot,
  updateAdminShuttleTimeSlot,
} from "@/app/backend/controller/setting";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  await connectDB();

  const { slotId } = await params;

  return await updateAdminShuttleTimeSlot(req, slotId);
}

export async function DELETE(req, { params }) {
  await connectDB();

  const { slotId } = await params;

  return await deleteAdminShuttleTimeSlot(req, slotId);
}