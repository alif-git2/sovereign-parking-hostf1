import { connectDB } from "@/app/backend/database/mongodb";
import { markWithdrawalPaid } from "@/app/backend/controller/adminWallets";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  await connectDB();

  const { transactionId } = await params;

  return await markWithdrawalPaid(req, transactionId);
}