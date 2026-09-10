"use client";

import { motion } from "framer-motion";
import React, { useState } from 'react';
import Button from "../global/Button";
import { MoveRight } from "lucide-react"
import Link from "next/link";

const Input = ({ placeHolder, value, onChange, type, textArea = false }) => (textArea ? <textarea
    placeholder={placeHolder}
    value={value || ""}
    onChange={onChange}
    required
    className="w-full px-4 pt-1 border border-blue-600 focus:outline-none placeholder:text-[13px] text-sm rounded-sm my-2 min-h-[200px] max-h-max"
/> : <input
    value={value}
    placeholder={placeHolder}
    onChange={onChange}
    type={type}
    required
    className="w-full p-4 border border-blue-600 focus:outline-none placeholder:capitalize placeholder:text-sm text-gray-500 placeholder:text-gray-400 text-sm rounded-sm my-2"
/>);

const Border = () => (<div className="w-9/12 md:w-full h-[2px] bg-gradient-to-r from-pink-400 via-pink-200 to-transparent ml-[16%] md:ml-0"></div>)

const Contact = () => {

    const [user, setUser] = useState({
        name: "", email: "", phone: "", text: null
    });

    function handleForm() {
        console.log(user);
    }

    const Instagram = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M320.3 205C256.8 204.8 205.2 256.2 205 319.7C204.8 383.2 256.2 434.8 319.7 435C383.2 435.2 434.8 383.8 435 320.3C435.2 256.8 383.8 205.2 320.3 205zM319.7 245.4C360.9 245.2 394.4 278.5 394.6 319.7C394.8 360.9 361.5 394.4 320.3 394.6C279.1 394.8 245.6 361.5 245.4 320.3C245.2 279.1 278.5 245.6 319.7 245.4zM413.1 200.3C413.1 185.5 425.1 173.5 439.9 173.5C454.7 173.5 466.7 185.5 466.7 200.3C466.7 215.1 454.7 227.1 439.9 227.1C425.1 227.1 413.1 215.1 413.1 200.3zM542.8 227.5C541.1 191.6 532.9 159.8 506.6 133.6C480.4 107.4 448.6 99.2 412.7 97.4C375.7 95.3 264.8 95.3 227.8 97.4C192 99.1 160.2 107.3 133.9 133.5C107.6 159.7 99.5 191.5 97.7 227.4C95.6 264.4 95.6 375.3 97.7 412.3C99.4 448.2 107.6 480 133.9 506.2C160.2 532.4 191.9 540.6 227.8 542.4C264.8 544.5 375.7 544.5 412.7 542.4C448.6 540.7 480.4 532.5 506.6 506.2C532.8 480 541 448.2 542.8 412.3C544.9 375.3 544.9 264.5 542.8 227.5zM495 452C487.2 471.6 472.1 486.7 452.4 494.6C422.9 506.3 352.9 503.6 320.3 503.6C287.7 503.6 217.6 506.2 188.2 494.6C168.6 486.8 153.5 471.7 145.6 452C133.9 422.5 136.6 352.5 136.6 319.9C136.6 287.3 134 217.2 145.6 187.8C153.4 168.2 168.5 153.1 188.2 145.2C217.7 133.5 287.7 136.2 320.3 136.2C352.9 136.2 423 133.6 452.4 145.2C472 153 487.1 168.1 495 187.8C506.7 217.3 504 287.3 504 319.9C504 352.5 506.7 422.6 495 452z" /></svg>)

    const FaceBook = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 440 146.7 540.8 258.2 568.5L258.2 398.2L205.4 398.2L205.4 320L258.2 320L258.2 286.3C258.2 199.2 297.6 158.8 383.2 158.8C399.4 158.8 427.4 162 438.9 165.2L438.9 236C432.9 235.4 422.4 235 409.3 235C367.3 235 351.1 250.9 351.1 292.2L351.1 320L434.7 320L420.3 398.2L351 398.2L351 574.1C477.8 558.8 576 450.9 576 320z" /></svg>);


    const Info = [
        {
            title: "Address",
            text: ["9 Harris Road, Pinkenba QLD 4008"],
            type: "text"
        },
        {
            title: "Information",
            text: ["Call Us: 04152793472", "Email: hello@slateblue-dove-624316.hostingersite.com", "Opening hours: 6 am to 2 pm (on cruise days only)"],
            type: "text"
        },
        {
            title: "Follow Us",
            social: [{ icon: FaceBook, link: "" }, { icon: Instagram, link: "" }],
            type: "link"
        },
    ]

    return (
        <div className="bg-[#F1F8FF] p-8 flex flex-col-reverse lg:flex-row gap-4 my-10 rounded-2xl overflow-hidden" >
            <motion.div
                initial={{ x: -400 }}
                animate={{ x: 0 }}
                transition={{ duration: 1 }}
                className="w-full lg:w-5/12">
                <div className="flex flex-col gap-7" >
                    {Info.map((data, index) => (
                        <div
                            key={index}
                            className=""
                        >
                            {data.type === "text" ? <>
                                <h4 className="font-[600] text-xl mb-4 text-center lg:text-left">{data.title}</h4>
                                <div className="w-6/12 mx-auto lg:mx-0">
                                    <Border />
                                </div>
                                <div className="mt-4 text-center lg:text-left">
                                    {data.text.map((text, index) => (<h5 key={index}>{text}</h5>))}
                                </div></> :
                                <>
                                    <h4 className="font-[600] text-xl mb-4 text-center lg:text-left">{data.title}</h4>
                                    <div className="w-6/12 mx-auto lg:mx-0">
                                        <Border />
                                    </div>
                                    <div className="mt-4 ml-[35%] lg:ml-0">
                                        {data.social.map((data, index) => (
                                            <Link
                                                key={index}
                                                href={data.link}
                                                className="bg-blue-500 w-7 h-7 p-1.5 mr-2 rounded-full inline-block"
                                            >
                                                <data.icon />
                                            </Link>
                                        ))}
                                    </div>
                                </>}
                        </div>
                    ))}
                </div>
            </motion.div>
            <motion.div
                initial={{ x: 1200 }}
                animate={{ x: 0 }}
                transition={{ duration: 1 }}
                className="w-full lg:w-7/12 h-auto">
                <Input
                    placeHolder={"name"}
                    value={user.name}
                    onChange={e => setUser(p => ({ ...p, name: e?.target?.value }))}
                    type={"text"}
                />
                <div className="flex flex-col md:flex-row md:gap-5">
                    <Input
                        placeHolder={"email"}
                        value={user.email}
                        onChange={e => setUser(p => ({ ...p, email: e?.target?.value }))}
                        type={"email"}
                    />
                    <Input
                        placeHolder={"phone"}
                        value={user.phone}
                        onChange={e => setUser(p => ({ ...p, phone: e?.target?.value }))}
                        type={"number"}
                    />
                </div>
                <Input
                    placeHolder={"How can we help you? Feel free to get in touch!"}
                    value={user.text}
                    onChange={e => setUser(p => ({ ...p, text: e?.target?.value }))}
                    type={"text"}
                    textArea={true}
                />
                <Button
                    title={"book now"}
                    width={"w-full"}
                    style={"hover:scale-90 tracking-widest"}
                    uppercase={false}
                    onClick={handleForm}
                    child={<MoveRight className="inline ml-2" size={12} strokeWidth={4} />}
                />
            </motion.div>
        </div>
    )
}

export default Contact;