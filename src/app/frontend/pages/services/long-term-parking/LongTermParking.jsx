import Navbar from "../../../component/global/NavBar";
import Footer from "../../../component/global/Footer";
import NewLongTermParkingPage from "../../../component/services/long-term-parking/NewLongTermParkingPage";

export default function LongTermParking() {
  return (
    <div className="w-full">
      <Navbar />
      <NewLongTermParkingPage />
      <Footer />
    </div>
  );
}