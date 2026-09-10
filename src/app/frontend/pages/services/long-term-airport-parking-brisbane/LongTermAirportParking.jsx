import { Hind, Poppins } from "next/font/google";
import Navbar from "../../../component/global/NavBar";
import Footer from "../../../component/global/Footer";
import NewLongTermAirportParkingPage from "../../../component/services/long-term-airport-parking-brisbane/NewLongTermAirportParkingPage";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--ltap-font-head",
});

const hind = Hind({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--ltap-font-body",
});

export default function LongTermAirportParking() {
  return (
    <div className={`w-full ${poppins.variable} ${hind.variable}`}>
      <Navbar />
      <NewLongTermAirportParkingPage />
      <Footer />
    </div>
  );
}