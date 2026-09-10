import LongTermParking from "../../frontend/pages/services/long-term-parking/LongTermParking";
import {
  getSeoMetadata,
  getSeoSchemaJson,
} from "@/app/backend/utils/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getSeoMetadata("/services/long-term-parking");
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function Page() {
  const schemaJson = await getSeoSchemaJson("/services/long-term-parking");

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

      <LongTermParking />
    </>
  );
}
