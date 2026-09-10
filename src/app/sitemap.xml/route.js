import mongoose from "mongoose";
import SeoGlobalSetting from "@/app/backend/models/seoGlobalSetting";
import SeoPageSetting from "@/app/backend/models/seoPageSetting";
import BlogPost from "@/app/backend/models/blogPost";
import {
  buildAbsoluteUrl,
  getSiteUrl,
  normalizeSeoPath,
} from "@/app/backend/utils/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getLastModified(page) {
  const date = page.updatedAt || page.createdAt || new Date();

  return new Date(date).toISOString();
}

function normalizePriority(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0.8";
  }

  const safeNumber = Math.min(1, Math.max(0, number));

  return safeNumber.toFixed(1);
}

function normalizeChangeFrequency(value) {
  const allowed = new Set([
    "always",
    "hourly",
    "daily",
    "weekly",
    "monthly",
    "yearly",
    "never",
  ]);

  return allowed.has(value) ? value : "weekly";
}

function buildUrlXml(page, globalSeo) {
  const path = normalizeSeoPath(page.path || "/");
  const loc = buildAbsoluteUrl(path, globalSeo);
  const lastmod = getLastModified(page);
  const changefreq = normalizeChangeFrequency(page.sitemap_changefreq);
  const priority = normalizePriority(page.sitemap_priority);

  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>`;
}

export async function GET() {
  try {
    await connectToDatabase();

    const globalSeo = (await SeoGlobalSetting.findOne({}).lean()) || {};

    if (globalSeo.sitemap_enabled === false) {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
        {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
          },
        }
      );
    }

    const [pages, blogPosts] = await Promise.all([
      SeoPageSetting.find({
        sitemap_enabled: true,
        noindex: false,
      })
        .sort({
          path: 1,
        })
        .lean(),
      BlogPost.find({
        status: "published",
        sitemap_enabled: true,
        noindex: false,
      })
        .sort({
          published_at: -1,
        })
        .lean(),
    ]);

    const staticPageXml = pages
      .map((page) => buildUrlXml(page, globalSeo))
      .join("\n");

    const blogPostXml = blogPosts
      .filter((post) => post.slug)
      .map((post) =>
        buildUrlXml(
          {
            path: `/blog/${post.slug}`,
            updatedAt: post.updatedAt,
            createdAt: post.published_at || post.createdAt,
            sitemap_changefreq: post.sitemap_changefreq,
            sitemap_priority: post.sitemap_priority,
          },
          globalSeo
        )
      )
      .join("\n");

    const xmlItems = [staticPageXml, blogPostXml].filter(Boolean).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const siteUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(getSiteUrl({ site_url: siteUrl }))}/</loc>
    <lastmod>${escapeXml(new Date().toISOString())}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return new Response(fallbackXml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
