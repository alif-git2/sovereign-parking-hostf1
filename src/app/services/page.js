import Services from "../frontend/pages/services/services";
import {
  getSeoMetadata,
  getSeoSchemaJson,
} from "@/app/backend/utils/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getSeoMetadata("/services");
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function ServicesPage() {
  const schemaJson = await getSeoSchemaJson("/services");

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

      <Services />
    </>
  );
}
