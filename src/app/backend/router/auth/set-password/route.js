import { connectDB } from "@/app/backend/database/mongodb";
import { setPassword } from "@/app/backend/controller/auth";

export async function POST(req) {
  await connectDB();
  return await setPassword(req);
}