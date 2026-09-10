import { NextResponse } from "next/server";
import { loginUser } from "../../../controller/park_user";
import { setTokenCookie } from "../../../utils/cookieHandeler";

export async function POST(req) {
  try {
    const body = await req.json();
    req.body = body;

    const { user, token } = await loginUser(req);
    const response = NextResponse.json({ user });

    setTokenCookie(response, token);
    return response;

  } catch (error) {
    console.error("Error occurred while logging in user:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}