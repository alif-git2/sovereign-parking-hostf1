import { Hind, Poppins } from "next/font/google";
import Navbar from "../../component/global/NavBar";
import Footer from "../../component/global/Footer";
import NewAboutPage from "../../component/about/NewAboutPage";
import "../../component/about/new-about.css";

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

const About = () => {
  return (
    <div className={`w-full ${poppins.variable} ${hind.variable}`}>
      <Navbar />
      <NewAboutPage />
      <Footer />
    </div>
  );
};

export default About;
