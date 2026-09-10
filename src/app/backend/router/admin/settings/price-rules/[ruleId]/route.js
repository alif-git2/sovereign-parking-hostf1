import { connectDB } from "@/app/backend/database/mongodb";
import {
  deleteAdminPriceRule,
  updateAdminPriceRule,
} from "@/app/backend/controller/setting";

export const runtime = "nodejs";

export async function PATCH(req, context) {
  await connectDB();

  const params = await context.params;
  return updateAdminPriceRule(req, params.ruleId);
}

export async function DELETE(req, context) {
  await connectDB();

  const params = await context.params;
  return deleteAdminPriceRule(req, params.ruleId);
}