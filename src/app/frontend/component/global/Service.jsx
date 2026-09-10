import React from 'react';

const featureData = [
    {
        title: 'Complimentary Shuttle',
        icon: "./service2.png",
    },
    {
        title: 'Just 4km from BICT',
        icon: "./service1.png",
    },
    {
        title: 'Book & Prepay Online',
        icon: "./service3.png",
    },
    {
        title: 'Secure & 24HR Monitored Parking',
        icon: "./service4.png",
        isSecureFeature: true,
    },
];

export default function Service() {
    return (
        <div className='md:px-12 my-20'>
            <h1 className='text-center font-bold text-3xl md:text-[2.9rem]'>Why Choose Sovereign Parking</h1>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mt-8'>
                {featureData.map((feature, index) => (
                    <div
                        className='w-full h-[180px] hover:shadow-2xl'
                        key={index}>
                        <div className='w-20 h-20 overflow-hidden mx-auto mt-4 scale-125'>
                            <img
                                src={feature.icon}
                                alt={feature.title}
                                className='scale-150 mt-3'
                            />
                        </div>
                        <h2 className='text-center font-semibold mt-5 px-5'>{feature.title}</h2>
                    </div>
                ))}
            </div>
        </div>
    );
}