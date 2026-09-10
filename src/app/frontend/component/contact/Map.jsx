"use client";

import React from 'react'

const Map = () => {
    return (
        <div className='-mt-[12%]'>
            <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3541.797432780211!2d153.1291865!3d-27.413248400000004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6b915f028b9b7773%3A0xd18683e5c17b5f4!2sSovereign%20Parking!5e0!3m2!1sen!2sbd!4v1777440255417!5m2!1sen!2sbd"

                className="w-full h-[90vh]"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
            />
        </div>
    )
}

export default Map;