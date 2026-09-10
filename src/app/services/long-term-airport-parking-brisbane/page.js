import LongTermAirportParking from "../../frontend/pages/services/long-term-airport-parking-brisbane/LongTermAirportParking";
import {
  getSeoMetadata,
  getSeoSchemaJson,
} from "@/app/backend/utils/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getSeoMetadata("/services/long-term-airport-parking-brisbane");
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function Page() {
  const schemaJson = await getSeoSchemaJson(
    "/services/long-term-airport-parking-brisbane",
  );

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

      <LongTermAirportParking />
    </>
  );
}
