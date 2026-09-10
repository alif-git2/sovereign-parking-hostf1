
"use client";

import { useState } from "react";
import DropDownSlider from "../global/DropDownSlider";
import Button from "../global/Button";

const BeforeBooking = () => {
    const [Data, setData] = useState([
        {
            title: "Accessibility",
            description: "Currently, our car park does not have the accommodations for guests with mobility limitations. If you’re traveling with someone who needs assistance, we recommend dropping them off at the cruise terminal before parking.",
            isOpen: true
        },
        {
            title: "Passenger & Luggage Drop Off",
            description: "For a smoother experience, we recommend that passengers and luggage be dropped off at the terminal first, where possible.",
            isOpen: false
        },
        {
            title: "Parking Days & Availability",
            description: "Our parking facility operates between the hours of 6am and 2pm, and only on days when cruises are scheduled. To check the availability of parking for your specific cruise, please click Book Now.",
            isOpen: false
        },
        {
            title: "Keys",
            description: "For insurance and liability purposes, our staff are required to park your vehicle on your behalf. As such, we will need to collect your car keys before your departure to ensure the proper handling and security of your vehicle during your absence.",
            isOpen: false
        },
        {
            title: "Refund Policy",
            description: "We understand plans can change, so please double-check your booking details and parking location before confirming. Unfortunately, we’re unable to offer refunds for bookings made in error or for arriving at the wrong location. As we prepare in advance for your arrival, refunds are not available within 48 hours of your booking start time.",
            isOpen: false
        },
    ]);

    function HandleSlider(index) {
        setData((prev) =>
            prev.map((item, i) => {
                if (i === index) {
                    return { ...item, isOpen: !item.isOpen };
                } else {
                    return { ...item, isOpen: false };
                }
            })
        );
    }

    return (
        <div className="my-20 flex flex-col md:flex-row px-4 md:px-20 gap-12 ">

            <div className="w-full md:w-6/12 flex flex-col items-center md:items-start">
                <h1 className="text-[2rem] md:text-5xl font-[650] mb-2 md:mb-7 text-center md:text-left">Before You Book</h1>
                {Data?.map(({ title, description, isOpen }, index) => (
                    <div
                        key={index}
                        onClick={() => HandleSlider(index)}
                        className=""
                    >
                        <DropDownSlider
                            title={title}
                            description={description}
                            isOpen={isOpen}
                        />
                    </div>
                ))}
                <Button
                    title={"book now"}
                    width={"w-9/12 md:w-4/12"}
                    style={"mt-7 tracking-widest"}
                />
            </div>
            <div className="w-full md:w-6/12">
                <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3541.797432780211!2d153.1291865!3d-27.413248400000004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6b915f028b9b7773%3A0xd18683e5c17b5f4!2sSovereign%20Parking!5e0!3m2!1sen!2sbd!4v1777440255417!5m2!1sen!2sbd"

                    className="w-full h-[450px] rounded-3xl"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                />
            </div>
        </div>
    );
};

export default BeforeBooking;