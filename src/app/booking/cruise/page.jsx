import { Suspense } from "react";
import CruiseBookingPage from "@/app/frontend/pages/booking/cruise";
import {
  getSeoMetadata,
  getSeoSchemaJson,
} from "@/app/backend/utils/seo";

export const runtime = "nodejs";

export async function generateMetadata() {
  return getSeoMetadata("/booking/cruise");
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

async function CruiseSeoSchema() {
  const schemaJson = await getSeoSchemaJson("/booking/cruise");

  if (!schemaJson) {
    return null;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: safeJsonLd(schemaJson),
      }}
    />
  );
}

export default function Page() {
  return (
    <>
      <CruiseBookingPage />

      <Suspense fallback={null}>
        <CruiseSeoSchema />
      </Suspense>
    </>
  );
}
