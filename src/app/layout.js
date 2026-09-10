import { cache } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "react-day-picker/style.css";
import "./globals.css";
import { connectDB } from "./backend/database/mongodb";
import SeoGlobalSetting from "./backend/models/seoGlobalSetting";
import SupportChat from "./frontend/component/global/SupportChat";
import TrackingScripts from "./frontend/component/global/TrackingScripts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const getGlobalSeoSetting = cache(async () => {
  try {
    await connectDB();
    return (await SeoGlobalSetting.findOne({}).lean()) || {};
  } catch (error) {
    console.error("Failed to load global SEO settings:", error);
    return {};
  }
});

function parseKeywords(value) {
  return String(value || "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function buildAbsoluteUrl(value, siteUrl) {
  const cleanValue = String(value || "").trim();
  const cleanSiteUrl = String(siteUrl || "").trim().replace(/\/+$/, "");

  if (!cleanValue) {
    return "";
  }

  if (/^https?:\/\//i.test(cleanValue)) {
    return cleanValue;
  }

  if (!cleanSiteUrl) {
    return cleanValue;
  }

  return cleanValue.startsWith("/")
    ? `${cleanSiteUrl}${cleanValue}`
    : `${cleanSiteUrl}/${cleanValue}`;
}

export async function generateMetadata() {
  const globalSeo = await getGlobalSeoSetting();
  const title = globalSeo.default_meta_title || "Sovereign Parking";
  const description =
    globalSeo.default_meta_description || "Harris Road Pinkenba";
  const keywords = parseKeywords(globalSeo.default_keywords);
  const ogImage = buildAbsoluteUrl(
    globalSeo.default_og_image,
    globalSeo.site_url
  );

  const metadata = {
    title,
    description,
  };

  if (keywords.length > 0) {
    metadata.keywords = keywords;
  }

  if (globalSeo.google_site_verification) {
    metadata.verification = {
      google: String(globalSeo.google_site_verification).trim(),
    };
  }

  if (globalSeo.site_name || ogImage) {
    metadata.openGraph = {
      title,
      description,
      siteName: globalSeo.site_name || "Sovereign Parking",
      type: "website",
    };

    if (ogImage) {
      metadata.openGraph.images = [{ url: ogImage }];
    }
  }

  return metadata;
}

export default async function RootLayout({ children }) {
  const globalSeo = await getGlobalSeoSetting();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SupportChat />
        <TrackingScripts
          googleAnalyticsId={globalSeo.google_analytics_id || ""}
          facebookPixelId={globalSeo.facebook_pixel_id || ""}
        />
      </body>
    </html>
  );
}
