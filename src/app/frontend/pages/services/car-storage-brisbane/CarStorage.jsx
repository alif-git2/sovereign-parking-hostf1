
import Navbar from "../../../component/global/NavBar";
import Footer from "../../../component/global/Footer";
import NewCarStoragePage from "../../../component/services/car-storage-brisbane/NewCarStoragePage.jsx";




export default function CarStorage() {
  return (
    <div className="w-full">
      <Navbar />
      <NewCarStoragePage />
      <Footer />
    </div>
  );
}