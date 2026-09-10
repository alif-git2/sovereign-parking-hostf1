import CaravanStorage from "../../frontend/pages/services/caravan-storage-brisbane/CaravanStorage";
import {
  getSeoMetadata,
  getSeoSchemaJson,
} from "@/app/backend/utils/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getSeoMetadata("/services/caravan-storage-brisbane");
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function Page() {
  const schemaJson = await getSeoSchemaJson(
    "/services/caravan-storage-brisbane",
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

      <CaravanStorage />
    </>
  );
}
