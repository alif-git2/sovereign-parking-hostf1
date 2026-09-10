
"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const SelectOption = ({
    options = [],
    value = null,
    onChange,
    placeholder = "Select option",
    optionIcon = null,
    selectIcon = null,
    disabled,
    isBackupPlaceholder = false
}) => {

    const [open, setOpen] = useState(false);
    const [Icon, setIcon] = useState(selectIcon);
    const [backupPlaceholder, setPlaceHolder] = useState(placeholder)
    const wrapperRef = useRef(null);

    const handleSelect = (item, icon) => {
        if (typeof onChange === "function") onChange(item);
        setIcon(optionIcon || icon)
        setOpen(false);
    };

    // 👇 close on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div ref={wrapperRef} className={`relative w-full mt-2 ${disabled && "pointer-events-none"}`}>

            <div
                tabIndex={0}
                onClick={() => setOpen(!open)}
                className="group px-3 py-2 rounded-sm border-2 border-gray-300 flex items-center justify-between cursor-pointer transition-all duration-200 focus:ring focus:ring-blue-500 focus:border-blue-500 focus:shadow-md focus:shadow-blue-100"
            >

                <div className="flex items-center gap-2">

                    <div className="text-gray-400 transition-colors group-focus:text-blue-500">
                        {Icon}
                    </div>

                    <span className="text-md">
                        {!value ? placeholder : isBackupPlaceholder ? backupPlaceholder : value}
                    </span>
                </div>

                <ChevronDown
                    size={18}
                    className={`transition-transform ${open ? "rotate-180" : ""}`}
                />
            </div>

            {open && (
                <div className="
                    absolute
                    top-full
                    left-0
                    mt-2
                    w-full
                    bg-white
                    border-2
                    border-gray-300
                    rounded-sm
                    shadow-lg
                    z-50
                    overflow-hidden
                ">

                    {options.map((item, index) => (
                        <div
                            key={index}
                            onClick={() => {
                                handleSelect(item?.value || item?._id || item, item?.icon);
                                isBackupPlaceholder && setPlaceHolder(item?.name);
                            }}
                            className="
                                flex
                                items-center
                                gap-2
                                px-3
                                py-2
                                hover:bg-blue-50
                                cursor-pointer
                                transition-colors
                            "
                        >
                            {optionIcon || item?.icon && (
                                <div className="text-blue-500">
                                    {optionIcon || item.icon}
                                </div>
                            )}

                            <span>{item?.label || item?.name || item}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SelectOption;