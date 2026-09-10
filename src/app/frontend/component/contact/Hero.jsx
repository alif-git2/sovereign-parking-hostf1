"use client";

import { motion } from "framer-motion";
import React from 'react'

const Hero = () => {
    return (
        <div className="w-full h-[50vh] relative overflow-hidden">
            {/* Image */}
            <img
                src="/contactus.webp"
                alt="hero image"
                className="w-full h-full object-cover"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/55 z-10"></div>
            <motion.div
                initial={{ y: 400 }}
                animate={{ y: 0 }}
                transition={{ duration: 1 }}
                className="w-full h-full absolute top-0 left-0 z-20 text-white flex flex-col items-center justify-center"
            >
                <h1 className="text-4xl md:text-7xl text-center font-[650]">Contact Sovereign Parking</h1>
                <h5 className="text-md md:text-xl text-center mt-7 px-4">
                    We are here to make your cruise parking experience simple and stress-free. Whether you need help with a booking, directions, or information about our services, we are ready to assist.
                </h5>
            </motion.div>
        </div>
    );
};

export default Hero;