import StorageBookingPage from "@/app/frontend/pages/booking/storage";
import {
  getSeoMetadata,
  getSeoSchemaJson,
} from "@/app/backend/utils/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getSeoMetadata("/booking/storage");
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function Page() {
  const schemaJson = await getSeoSchemaJson("/booking/storage");

  return (
    <>
      {schemaJson && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(schemaJson),
          }}
        />
      )}

      <StorageBookingPage />
    </>
  );
}
