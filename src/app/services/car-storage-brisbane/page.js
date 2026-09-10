import CarStorage from "../../frontend/pages/services/car-storage-brisbane/CarStorage";
import {
  getSeoMetadata,
  getSeoSchemaJson,
} from "@/app/backend/utils/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getSeoMetadata("/services/car-storage-brisbane");
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function CarStoragePage() {
  const schemaJson = await getSeoSchemaJson("/services/car-storage-brisbane");

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

      <CarStorage />
    </>
  );
}
