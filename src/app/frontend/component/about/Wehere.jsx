"use client";

import { useEffect, useRef, useState } from "react";

export default function Wehere() {

    const Text = ["Return", "Trip", "Departure"];

    const [index, setIndex] = useState(0);
    const [isStart, setStart] = useState(true);
    const ref = useRef(null);
    const [width, setWidth] = useState(0);

    // measure width
    useEffect(() => {
        if (!ref.current) return;
        setWidth(Math.ceil(ref.current.scrollWidth));
    }, [index]);

    // toggle animation
    useEffect(() => {
        const timeout = setTimeout(() => {
            setStart((prev) => !prev);
        }, isStart ? 3000 : 800);

        return () => clearTimeout(timeout);
    }, [isStart]);

    // change text
    useEffect(() => {
        if (!isStart) {
            const t = setTimeout(() => {
                setIndex((prev) => (prev + 1) % Text.length);
            }, 750);

            return () => clearTimeout(t);
        }
    }, [isStart]);

    return (
        <div className="w-full flex flex-col md:flex-row px-4 sm:px-6 lg:px-12 py-8 gap-8 ">

            {/* LEFT */}
            <div className="w-full md:w-6/12">



                <div className="text-3xl leading-12 md:leading-normal md:text-[42px] font-[650] text-center">
                    <span>We’re here for your</span>
                    {/* animation wrapper */}
                    <span
                        style={{
                            maxWidth: isStart ? `${width}px` : "0px",
                        }}
                        
                        className="w-full block md:inline-block overflow-hidden transition-[max-width] duration-[1200ms] border-e-[3px] -mb-[30px] pb-[0.9rem] md:-ml-1 mx-auto"
                    >
                        <span
                            ref={ref}
                            className=" text-pink-300 pl-3 sm:pl-4 flex items-center inline-block pr-2"
                        >
                            {Text[index]}
                        </span>

                    </span>
                </div>


                <h4 className="mt-10 md:mt-6 sm:mt-8 text-gray-500 text-sm sm:text-base md:px-0">
                    Secure parking just 4km from Brisbane’s International Cruise Terminal.
                </h4>

            </div>

            {/* RIGHT */}
            <div className="w-full md:w-6/12">
                <img
                    src="./about2.webp"
                    alt="about"
                    className="w-full h-auto object-cover"
                />
            </div>
        </div>
    );
}