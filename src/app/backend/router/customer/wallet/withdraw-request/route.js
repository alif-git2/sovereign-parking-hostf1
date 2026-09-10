import { connectDB } from "@/app/backend/database/mongodb";
import { createCustomerWithdrawRequest } from "@/app/backend/controller/customerWallet";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await connectDB();

    return await createCustomerWithdrawRequest(req);
  } catch (error) {
    console.error("Customer withdrawal request route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to submit withdrawal request",
        error: error.message || "Failed to submit withdrawal request",
      },
      { status: 500 }
    );
  }
}