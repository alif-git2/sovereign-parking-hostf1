import Navbar from "../../../component/global/NavBar";
import Footer from "../../../component/global/Footer";
import NewCaravanStoragePage from "../../../component/services/caravan-storage-brisbane/NewCaravanStoragePage.jsx";
import "../../../component/services/caravan-storage-brisbane/caravan-storage.css";

export default function CaravanStorage() {
  return (
    <div className="w-full">
      <Navbar />
      <NewCaravanStoragePage />
      <Footer />
    </div>
  );
}