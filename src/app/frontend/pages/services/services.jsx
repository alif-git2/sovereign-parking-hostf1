import { Hind, Poppins } from "next/font/google";
import Navbar from "../../component/global/NavBar";
import Footer from "../../component/global/Footer";
import NewServicesPage from "../../component/services/NewServicesPage";
import "../../component/services/new-services.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--sp-services-font-head",
});

const hind = Hind({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--sp-services-font-body",
});

export default function Services() {
  return (
    <div className={`w-full ${poppins.variable} ${hind.variable}`}>
      <Navbar />
      <NewServicesPage />
      <Footer />
    </div>
  );
}