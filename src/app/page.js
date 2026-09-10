import { Hind, Poppins } from "next/font/google";
import Navbar from "./frontend/component/global/NavBar";
import Footer from "./frontend/component/global/Footer";
import NewHomePage from "./frontend/component/home/NewHomePage";
import {
  getSeoMetadata,
  getSeoSchemaJson,
} from "@/app/backend/utils/seo";
import "./globals.css";
import "./frontend/component/home/new-home.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--sp-font-head",
});

const hind = Hind({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--sp-font-body",
});

export async function generateMetadata() {
  return getSeoMetadata("/");
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function Home() {
  const schemaJson = await getSeoSchemaJson("/");

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

      <div className={`bg-white ${poppins.variable} ${hind.variable}`}>
        <Navbar />
        <NewHomePage />
        <Footer />
      </div>
    </>
  );
}
