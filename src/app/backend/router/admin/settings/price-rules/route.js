import { connectDB } from "@/app/backend/database/mongodb";
import {
  createAdminPriceRule,
  getAdminPriceRules,
} from "@/app/backend/controller/setting";

export const runtime = "nodejs";

export async function GET(req) {
  await connectDB();
  return getAdminPriceRules(req);
}

export async function POST(req) {
  await connectDB();
  return createAdminPriceRule(req);
}