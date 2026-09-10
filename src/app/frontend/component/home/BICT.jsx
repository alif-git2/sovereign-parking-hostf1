"use client";

import { useEffect, useState } from "react";
import Button from "../global/Button";

const images = [
    "/slide1.webp",
    "/slide2.webp",
    "/slide3.webp",
    "/slide4.webp",
    "/slide5.webp",
];

const BICT = () => {
    const [imageIndex, setImageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setImageIndex((prevIndex) => (prevIndex + 1) % images.length);
        }, 5000); // smoother timing

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full h-auto flex flex-col md:flex-row items-center justify-center py-10 gap-4">

            {/* LEFT SIDE */}
            <div className="w-full md:w-1/2 flex flex-col md:flex-row justify-end md:gap-3 px-5">

                <div className="w-full md:w-[15.8rem] bg-[#1c6de0] rounded-t-xl md:rounded-lg p-3 md:p-5">
                    <h1 className="text-white text-[23px] md:text-[1.33rem] font-bold md:leading-tight">
                        Our car park is available for all cruise dates at Brisbane International Cruise Terminal (BICT).
                    </h1>
                    <p className="text-white mt-3 text-[18px] md:text-[16px]">
                        Car park entry and exit is not available outside these scheduled departure and arrival dates (times may vary dependent on cruises).
                    </p>
                </div>

                <div className="w-full md:w-[15.8rem] relative h-[200px] md:h-[350px] overflow-hidden md:rounded-lg rounded-b-xl">
                    {images.map((img, index) => (
                        <img
                            key={index}
                            src={img}
                            alt="BICT parking"
                            className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${index === imageIndex ? "opacity-100" : "opacity-0"
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="w-full md:w-1/2 px-5 md:px-10">
                <h1 className="text-[33px] leading-tight md:text-[2.77rem] font-bold text-gray-800 mb-4 md:mb-7">
                    Start Your Cruise the Right Way - BICT Parking
                </h1>

                <h5 className="text-lg md:text-xl font-semibold my-0 md:my-2">
                    Whether you’re flying out or cruising off, park with confidence.
                </h5>

                <p className="mt-4 md:mt-7 mb-5 text-gray-600">
                    We’re a family-run business committed to making your travel experience stress-free. Located just minutes from Brisbane International Cruise Terminal (BICT), we offer reliable service, great rates, and simple online booking.
                </p>

                <h3 className="text-lg md:text-[1.5rem] font-bold my-2">
                    Offering Free:
                </h3>

                <div className="md:ml-2 flex flex-col gap-2 ">
                    <span className="text-gray-500 md:text-sm">– Valet Parking</span>
                    <span className="text-gray-500 md:text-sm">– Shuttle Transfers</span>
                    <span className="text-gray-500 md:text-sm">– Car Wash Upon Return</span>
                </div>

                <Button
                    title={"View Timetable"}
                    width={"w-full md:w-5/12"}
                    style={"mt-8 tracking-widest font-semibold"}
                />
            </div>
        </div>
    );
};

export default BICT;