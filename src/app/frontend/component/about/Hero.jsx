import React from 'react';

const Hero = () => {
    return (
        <div className="w-full bg-gradient-to-t from-slate-300 to-white py-10">

            {/* TOP HEADING */}
            <h1 className="text-center font-semibold text-5xl mb-8 px-4">
                About Sovereign Parking
            </h1>

            {/* CONTENT */}
            <div className="w-full flex flex-col md:flex-row gap-8 
                            px-4 sm:px-6 lg:px-12 items-center">

                {/* IMAGE */}
                <div className="w-full md:w-6/12">
                    <img
                        src="./slide1.webp"
                        alt="banner image"
                        className="w-full h-auto md:h-[390px] object-cover rounded-2xl"
                    />
                </div>

                {/* TEXT */}
                <div className="w-full md:w-6/12">

                    <h3 className="font-semibold leading-tight text-5xl" >
                        Start Your Trip the Easy Way
                    </h3>

                    <p className="pt-4 text-gray-600 text-sm sm:text-base">
                        At the heart of our business is our simple goal to make your travel experience smoother, safer, and more convenient. As a family-owned and operated parking service based near Brisbane International Cruise Terminal, we pride ourselves on delivering friendly service, honest pricing, and peace of mind.
                    </p>

                    <p className="pt-3 text-gray-600 text-sm sm:text-base">
                        We know that catching a flight or boarding a cruise can be stressful. That’s why we’re here! To take the worry out of parking. With over 250 spaces, easy access, and fast transfers, we’re focused on getting you where you need to go, right on time.
                    </p>

                    <p className="pt-3 text-gray-600 text-sm sm:text-base">
                        We are here to help you start and end your journey the right way.
                    </p>

                    <h4 className="mt-4 font-bold uppercase text-sm sm:text-base">
                        Open: Cruise Days Only 6am to 2pm (late cruise exceptions)
                    </h4>
                </div>
            </div>
        </div>
    );
};

export default Hero;