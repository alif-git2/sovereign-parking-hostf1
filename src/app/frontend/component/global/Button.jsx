"use client"
import Link from "next/link"

const Button = ({ title, width, onClick, style, uppercase = true, child, type = "btn", href, defaultStyle = false }) => {

    function handelAction() {
        if (typeof onClick === "function") onClick();
    }

    const Class = defaultStyle ? `${style}` : `${width} bg-pink-300 text-white px-4 py-2 rounded-md ${uppercase ? "uppercase" : "capitalize"} font-semibold [word-spacing:0.3rem] cursor-pointer border-2 hover:bg-blue-500 transition duration-300 border-pink-300 ${style}`;

    return (
        <>{type === "link" ?
            <Link
                href={href}
                className={Class}
                onClick={handelAction}
            >
                {title}{child}
            </Link>
            : <button
                onClick={handelAction}
                className={Class}>{title}{child}</button>}</>
    )
}

export default Button;