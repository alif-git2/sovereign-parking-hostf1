"use client";

import Navbar from '../../component/global/NavBar';
import Footer from '../../component/global/Footer';
import Hero from '../../component/contact/Hero';
import Contact from '../../component/contact/Contact';
import Map from '../../component/contact/Map';

const ContactUs = () => {
    return (
        <div>
            <Navbar />
            <Hero />
            
                <div className='lg:w-10/12 mx-auto px-4 relative z-40'>
                    <Contact />
                </div>
           
            <Map />
            <Footer />
        </div>
    )
}

export default ContactUs;