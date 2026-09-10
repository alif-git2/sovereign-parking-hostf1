// app/backend/router/auth/route.js

import { connectDB } from "@/app/backend/database/mongodb";
import { verifyUserBeforeRestPassword } from "@/app/backend/controller/auth";

export async function POST(req) {

  await connectDB();

  try {

    const body = await req.json();

    return await verifyUserBeforeRestPassword(body);

  } catch (error) {

    console.log(error);

    return Response.json({
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
      isNext: false
    });
  }
}