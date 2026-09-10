
"use client"
import { useState } from 'react'
import DropDownSlider from '../global/DropDownSlider';

const FAQ = () => {
    const [Data, setData] = useState([
        {
            title: "How do I get from your car park to the terminal?",
            description: "We provide complimentary, convenient 2-way transfers directly between the Brisbane Cruise Terminal and our carpark facility for you and your family.",
            isOpen: true
        },
        {
            title: "Is my vehicle safe while I’m away?",
            description: "Our facility is protected by 24/7 monitored security, high-definition cameras, and secure perimeter fencing.",
            isOpen: false
        },
        {
            title: "Can I book online and pay later?",
            description: "You can pay online during booking or on arrival at our facility.",
            isOpen: false
        },
        {
            title: "Can I get a refund?",
            description: "We understand plans can change, so please double-check your booking details and parking location before confirming. Unfortunately, we’re unable to offer refunds for bookings made in error or for arriving at the wrong location. As we prepare in advance for your arrival, refunds are not available within 48 hours of your booking start time.",
            isOpen: false
        }
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
        <div className='px-4 md:px-14 my-12'>
            <h1 className='w-full text-3xl md:text-5xl font-[650] text-center mb-9'>Frequently Asked Questions</h1>
            {Data?.map(({ title, description, isOpen }, index) => (
                <div
                    key={index}
                    onClick={() => HandleSlider(index)}
                >
                    <DropDownSlider
                        title={title}
                        description={description}
                        isOpen={isOpen}
                    />
                </div>
            ))}
        </div>
    )
}

export default FAQ;