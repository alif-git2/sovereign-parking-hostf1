"use client";

import Button from '../global/Button';

const About = () => {
    return (
        <div className='flex flex-col md:flex-row items-center justify-between p-5 md:p-8 gap-7'>
            <div className="w-full md:w-6/12">
                <img
                    src="./about.webp"
                    alt="about"
                    className='rounded-2xl'
                />
            </div>
            <div className='w-full md:w-6/12 pr-4 flex flex-col items-center md:items-start'>
                <h1 className='text-[2.30rem] md:text-6xl font-bold md:font-semibold mb-4 md:mb-7 text-left w-full'>About Us</h1>

                <p className='text-gray-600 text-[0.9rem]'>
                    Last Christmas, what should’ve been the perfect cruise almost unravelled over one forgotten detail… parking. After circling full car parks, dragging suitcases across gravel and paying peak rates for a less-than-ideal spot, we knew there had to be a better way.
                </p>

                <p className='text-gray-600 my-2'>That experience was what created Sovereign Parking.</p>

                <p className='text-gray-600 '>
                    Sovereign Parking was created to offer cruise travellers what we didn’t get secure, clean and comfortable parking just few minutes from the Brisbane Cruise Terminal, making it the ideal spot to park your car.
                </p>


                <Button
                    title={"LEARN MORE"}
                    width={"w-10/12 md:w-5/12"}
                    style={"tracking-widest mt-7 font-bold"}
                />
            </div>
        </div>
    )
}

export default About;