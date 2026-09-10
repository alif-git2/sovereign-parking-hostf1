import { NextResponse } from "next/server";
import { getSeoData, normalizeSeoPath } from "@/app/backend/utils/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = normalizeSeoPath(searchParams.get("path") || "/");

    const seoData = await getSeoData(path);

    return jsonResponse({
      success: true,
      data: seoData,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        message: error.message || "Failed to load SEO data.",
      },
      500
    );
  }
}
