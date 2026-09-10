"use client"

import React from 'react'
import Script from 'next/script'

const Testimonials = () => {
    return (
        <div className='my-8'>
            <Script
                src="https://elfsightcdn.com/platform.js"
                strategy="lazyOnload"
            />

            <h1 className='text-3xl px-4 md:text-5xl font-[650] text-center mb-8'>
                Hear From Our Happy Customers
            </h1>

            <div
                className="elfsight-app-afd87c6e-5269-4b1b-a851-fc44e84bf48d"
                data-elfsight-app-lazy
            ></div>
        </div>
    )
}

export default Testimonials;