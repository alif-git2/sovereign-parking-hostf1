import React from 'react'

const Div = ({ children, isPadding = true }) => {

    const Class = `
        group
        ${isPadding && "px-2"}
        rounded-sm
        w-full
        border-2
        border-gray-300
        flex
        items-center
        justify-start
        transition-all
        duration-200
        focus-within:ring
        focus-within:ring-blue-400
        focus-within:border-blue-400
        focus-within:shadow-md
        focus-within:shadow-blue-200
        mt-2
    `;

    return (
        <div className={Class} tabIndex={0}>
            {children}
        </div>
    )
}

export default Div;