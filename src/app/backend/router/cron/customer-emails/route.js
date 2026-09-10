import { connectDB } from "@/app/backend/database/mongodb";
import { sendScheduledCustomerEmails } from "@/app/backend/utils/customerScheduledEmails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyCronRequest(req) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return {
      ok: false,
      status: 500,
      message: "CRON_SECRET is missing",
    };
  }

  const authHeader = req.headers.get("authorization") || "";
  const expectedHeader = `Bearer ${secret}`;

  if (authHeader !== expectedHeader) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized cron request",
    };
  }

  return {
    ok: true,
  };
}

async function handleCron(req) {
  const auth = verifyCronRequest(req);

  if (!auth.ok) {
    return Response.json(
      {
        success: false,
        message: auth.message,
      },
      {
        status: auth.status,
      }
    );
  }

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    const mode = searchParams.get("mode") || "all";
    const limit = Number(searchParams.get("limit") || 100);

    if (!["all", "reminder", "feedback"].includes(mode)) {
      return Response.json(
        {
          success: false,
          message: "Invalid mode. Use all, reminder, or feedback.",
        },
        {
          status: 400,
        }
      );
    }

    const result = await sendScheduledCustomerEmails({
      mode,
      limit,
    });

    return Response.json({
      success: result.success,
      message: "Scheduled customer email job completed.",
      data: result,
    });
  } catch (error) {
    console.error("Scheduled customer email job failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Scheduled customer email job failed",
        error: error.message || "Scheduled customer email job failed",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(req) {
  return handleCron(req);
}

export async function POST(req) {
  return handleCron(req);
}