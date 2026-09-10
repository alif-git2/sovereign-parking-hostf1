"use client"

import React from 'react';

const featureData = [
    {
        title: 'Brisbane International Cruise Terminal',
        description: 'Just minutes from your cruise departure.',
        icon: "./service1.png",
    },
    {
        title: 'BNE Airport Parking',
        description: 'Quick, easy access to Brisbane Airport.',
        icon: "./service2.png",
    },
    {
        title: 'Book & Prepay Online',
        description: 'Secure your spot and prepay in under a minute.',
        icon: "./service3.png",
    },
    {
        title: 'Secure & Monitored Parking',
        description: 'Peace of mind while you\'re away.',
        icon: "./service4.png",
        isSecureFeature: true,
    },
];

export default function Premium() {
    return (
        <div className='md:px-7 my-20'>
            <h1 className='text-center font-bold text-3xl md:text-[2.9rem] w-full px-10 md:w-6/12 mx-auto'>Premium parking facilities for Brisbane</h1>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mt-8'>
                {featureData.map((feature, index) => (
                    <div
                        className='w-full h-[220px] hover:shadow-2xl'
                        key={index}>
                        <div className='w-20 h-20 overflow-hidden mx-auto mt-4 scale-125'>
                            <img
                                src={feature.icon}
                                alt={feature.title}
                                className='scale-150 mt-3'
                            />
                        </div>
                        <h2 className='text-center font-semibold mt-5 px-5'>{feature.title}</h2>
                        <p className='text-center mt-2 text-gray-500'>{feature.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

