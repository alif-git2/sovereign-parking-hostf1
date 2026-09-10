import mongoose from "mongoose";
import SeoGlobalSetting from "@/app/backend/models/seoGlobalSetting";
import { buildAbsoluteUrl } from "@/app/backend/utils/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DISALLOWED_PATHS = ["/admin/", "/backend/", "/api/"];

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing.");
  }

  await mongoose.connect(mongoUri);
}

function getSitemapUrl(globalSeo = {}) {
  return buildAbsoluteUrl("/sitemap.xml", globalSeo);
}

function getDefaultRobotsTxt(globalSeo = {}) {
  const lines = ["User-agent: *", "Allow: /"];

  for (const path of DEFAULT_DISALLOWED_PATHS) {
    lines.push(`Disallow: ${path}`);
  }

  lines.push("", `Sitemap: ${getSitemapUrl(globalSeo)}`, "");

  return lines.join("\n");
}

function ensureSitemapDirective(robotsTxt, globalSeo = {}) {
  const cleanRobots = String(robotsTxt || "").trim();

  if (!cleanRobots) {
    return getDefaultRobotsTxt(globalSeo);
  }

  if (/^\s*Sitemap\s*:/im.test(cleanRobots)) {
    return `${cleanRobots}\n`;
  }

  return `${cleanRobots}\n\nSitemap: ${getSitemapUrl(globalSeo)}\n`;
}

export async function GET() {
  try {
    await connectToDatabase();

    const globalSeo = (await SeoGlobalSetting.findOne({}).lean()) || {};
    const customRobots = String(globalSeo.robots_txt || "").trim();

    // Auth, customer and payment pages are intentionally NOT blocked here.
    // They use X-Robots-Tag: noindex in Next.js response headers so crawlers
    // can access those responses and actually observe the noindex directive.
    const robotsTxt = customRobots
      ? ensureSitemapDirective(customRobots, globalSeo)
      : getDefaultRobotsTxt(globalSeo);

    return new Response(robotsTxt, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const fallbackGlobalSeo = {
      site_url:
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000",
    };

    return new Response(getDefaultRobotsTxt(fallbackGlobalSeo), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
