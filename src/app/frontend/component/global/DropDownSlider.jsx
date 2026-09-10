
"use client";

import { useState, useEffect } from "react";
import { Plus, Minus } from "lucide-react";

const DropDownSlider = ({ isOpen = false, title, description }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
        setIsCollapsed(!isOpen);
    }, [isOpen]);

    return (
        <div className="border border-gray-300">
            <div
                onClick={() => { setIsCollapsed(!isCollapsed) }}
                className="flex items-center gap-3 cursor-pointer font-semibold mb-2 transition-all duration-300 text-blue-500 hover:text-pink-400 pt-2 pl-1 min-h-9 max-h-max"
            >
                <div>
                    {isOpen || !isCollapsed ? (
                        <Minus size={18} />
                    ) : (
                        <Plus size={18} strokeWidth={3} />
                    )}
                </div>
                <h4 className="text-md md:text-sm">{title}</h4>
            </div>

            <div className={`overflow-hidden transition-max-height duration-300 ease-linear ${isCollapsed ? 'max-h-0 py-0' : 'max-h-screen'} text-gray-700 p-4`}>
                {description}
            </div>
        </div>
    );
};

export default DropDownSlider;