import { connectDB } from "@/app/backend/database/mongodb";
import SeoGlobalSetting from "@/app/backend/models/seoGlobalSetting";
import SeoPageSetting from "@/app/backend/models/seoPageSetting";

const DEFAULT_SITE_NAME = "Sovereign Parking";
const DEFAULT_TITLE = "Sovereign Parking | Cruise Parking Brisbane QLD";
const DEFAULT_DESCRIPTION =
  "Looking for cruise parking in Brisbane QLD? Sovereign Parking is located near the Brisbane cruise terminal & offers a complimentary shuttle transfer & car wash.";


export function normalizeSeoPath(path = "/") {
  let cleanPath = String(path || "/").trim();

  if (!cleanPath) {
    cleanPath = "/";
  }

  cleanPath = cleanPath.split("?")[0].split("#")[0].trim();

  if (!cleanPath.startsWith("/")) {
    cleanPath = `/${cleanPath}`;
  }

  cleanPath = cleanPath.replace(/\/{2,}/g, "/");

  if (cleanPath.length > 1) {
    cleanPath = cleanPath.replace(/\/+$/, "");
  }

  return cleanPath || "/";
}

function cleanString(value) {
  return String(value || "").trim();
}

function stripTrailingSlash(value) {
  return cleanString(value).replace(/\/+$/, "");
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(cleanString(value));
}

export function getSiteUrl(globalSeo = {}) {
  const siteUrl =
    stripTrailingSlash(globalSeo.site_url) ||
    stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL) ||
    stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL) ||
    "http://localhost:3000";

  return siteUrl;
}

export function buildAbsoluteUrl(value, globalSeo = {}) {
  const cleanValue = cleanString(value);

  if (!cleanValue) {
    return "";
  }

  if (isAbsoluteUrl(cleanValue)) {
    return cleanValue;
  }

  const siteUrl = getSiteUrl(globalSeo);

  if (cleanValue.startsWith("/")) {
    return `${siteUrl}${cleanValue}`;
  }

  return `${siteUrl}/${cleanValue}`;
}

export function buildCanonicalUrl(path, globalSeo = {}, pageSeo = {}) {
  const pageCanonical = cleanString(pageSeo.canonical_url);

  if (pageCanonical) {
    return pageCanonical;
  }

  return buildAbsoluteUrl(normalizeSeoPath(path), globalSeo);
}

function parseKeywords(value) {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean);
  }

  return cleanString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRobotsValue(pageSeo = {}, globalSeo = {}) {
  const noindex =
    typeof pageSeo.noindex === "boolean"
      ? pageSeo.noindex
      : Boolean(globalSeo.default_noindex);

  const nofollow =
    typeof pageSeo.nofollow === "boolean"
      ? pageSeo.nofollow
      : Boolean(globalSeo.default_nofollow);

  return {
    noindex,
    nofollow,
    index: !noindex,
    follow: !nofollow,
  };
}

function normalizeSchemaJson(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return value;
  }

  return null;
}

export async function getSeoData(path = "/") {
  const cleanPath = normalizeSeoPath(path);

  await connectDB();

  const [globalSeo, pageSeo] = await Promise.all([
    SeoGlobalSetting.findOne({}).lean(),
    SeoPageSetting.findOne({ path: cleanPath }).lean(),
  ]);

  const safeGlobalSeo = globalSeo || {};
  const safePageSeo = pageSeo || {};

  const title =
    cleanString(safePageSeo.meta_title) ||
    cleanString(safeGlobalSeo.default_meta_title) ||
    DEFAULT_TITLE;

  const description =
    cleanString(safePageSeo.meta_description) ||
    cleanString(safeGlobalSeo.default_meta_description) ||
    DEFAULT_DESCRIPTION;

  const siteName =
    cleanString(safeGlobalSeo.site_name) ||
    DEFAULT_SITE_NAME;

  const canonicalUrl = buildCanonicalUrl(
    cleanPath,
    safeGlobalSeo,
    safePageSeo
  );

  const ogTitle =
    cleanString(safePageSeo.og_title) ||
    title;

  const ogDescription =
    cleanString(safePageSeo.og_description) ||
    description;

  const ogImage =
    buildAbsoluteUrl(
      cleanString(safePageSeo.og_image) ||
        cleanString(safeGlobalSeo.default_og_image),
      safeGlobalSeo
    ) || "";

  const twitterTitle =
    cleanString(safePageSeo.twitter_title) ||
    ogTitle;

  const twitterDescription =
    cleanString(safePageSeo.twitter_description) ||
    ogDescription;

  const twitterImage =
    buildAbsoluteUrl(
      cleanString(safePageSeo.twitter_image) ||
        cleanString(safePageSeo.og_image) ||
        cleanString(safeGlobalSeo.default_og_image),
      safeGlobalSeo
    ) || "";

  const robots = getRobotsValue(safePageSeo, safeGlobalSeo);
  const keywords = parseKeywords(
    cleanString(safePageSeo.keywords) ||
      cleanString(safeGlobalSeo.default_keywords)
  );

  return {
    path: cleanPath,
    found_page_seo: Boolean(pageSeo),
    global: safeGlobalSeo,
    page: safePageSeo,
    seo: {
      site_name: siteName,
      site_url: getSiteUrl(safeGlobalSeo),
      title,
      description,
      keywords,
      canonical_url: canonicalUrl,
      robots,
      og_title: ogTitle,
      og_description: ogDescription,
      og_image: ogImage,
      twitter_title: twitterTitle,
      twitter_description: twitterDescription,
      twitter_image: twitterImage,
      google_site_verification: cleanString(
        safeGlobalSeo.google_site_verification
      ),
      google_analytics_id: cleanString(safeGlobalSeo.google_analytics_id),
      facebook_pixel_id: cleanString(safeGlobalSeo.facebook_pixel_id),
      schema_json: normalizeSchemaJson(safePageSeo.schema_json),
    },
  };
}

export async function getSeoMetadata(path = "/", overrides = {}) {
  const seoData = await getSeoData(path);
  const seo = seoData.seo;

  const title = overrides.title || seo.title;
  const description = overrides.description || seo.description;
  const canonicalUrl = overrides.canonical_url || seo.canonical_url;

  const metadata = {
    title,
    description,
    robots: {
      index: seo.robots.index,
      follow: seo.robots.follow,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: overrides.og_title || seo.og_title || title,
      description: overrides.og_description || seo.og_description || description,
      url: canonicalUrl,
      siteName: seo.site_name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: overrides.twitter_title || seo.twitter_title || title,
      description:
        overrides.twitter_description || seo.twitter_description || description,
    },
  };

  if (seo.keywords.length > 0) {
    metadata.keywords = seo.keywords;
  }

  if (seo.og_image) {
    metadata.openGraph.images = [
      {
        url: seo.og_image,
      },
    ];
  }

  if (seo.twitter_image) {
    metadata.twitter.images = [seo.twitter_image];
  }

  if (seo.google_site_verification) {
    metadata.verification = {
      google: seo.google_site_verification,
    };
  }

  return metadata;
}

export async function getSeoSchemaJson(path = "/") {
  const seoData = await getSeoData(path);

  return seoData.seo.schema_json;
}
