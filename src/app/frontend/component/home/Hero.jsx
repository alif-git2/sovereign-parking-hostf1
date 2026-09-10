
"use client";

import React from 'react';

const Home = () => {

    function handleBookNow() {
        // Implement booking logic here
        alert("ok")
    }
    return (
        <div className='w-full h-screen relative flex justify-center flex-col '>

            <img
                src="./hero.webp"
                alt="hero"
                className='w-full h-full object-cover hidden md:block'
            />
            <img
                src="./slide1.webp"
                alt="hero"
                className='w-full h-full object-cover object-[70%_30%] md:hidden'
            />

            <div className='ml-5 absolute font-semibold z-30 bottom-10 md:bottom-[32%]'>
                <h1
                    className="hidden md:block text-5xl text-white uppercase leading-tight md:[text-shadow:none]"
                >
                    Premium Cruise <br /> Terminal Parking <br /> Brisbane QLD
                </h1>
                <h1

                    className="md:hidden text-3xl md:text-5xl text-white uppercase leading-none md:leading-tight md:[text-shadow:none]"

                    style={{
                        textShadow: `
                            0.5px 0.5px 0 rgb(244,114,182),
                            -0.5px 0.5px 0 rgb(244,114,182),
                            0.5px -0.5px 0 rgb(244,114,182),
                            -0.5px -0.5px 0 rgb(244,114,182),
                            0 0 10px rgba(244,114,182,0.7)`
                    }}
                >
                    Premium Cruise <br /> Terminal Parking <br /> Brisbane QLD
                </h1>

                <button
                    onClick={handleBookNow}
                    style={{ boxShadow: "0px 0px 50px 8px rgba(0,0,0, 0.5)" }}
                    className='text-white bg-[#1C6DE0] font-bold px-12 py-2 rounded-lg border md:border-2 border-pink-300 mt-9 shadow-gray-600 cursor-pointer'
                >BOOK NOW</button>
            </div>

        </div>
    )
};

export default Home;