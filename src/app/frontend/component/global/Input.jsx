// import { User } from 'lucide-react';
// import React from 'react'

// const Input = ({ type, placeholder, onChange, value, Icon }) => {

//     const Class = `px-2 outline-none focus:border-none rounded-sm w-full border flex items-center justify-start  transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 group:`;

//     return (
//         <div className={Class} >

//             <div className='text-gray-400 transition-colors group-focus-within:text-blue-500'>
//                 {Icon}
//             </div>

//             <input
//                 type={type}
//                 placeholder={placeholder}
//                 className='w-full h-full py-2 px-2 focus:outline-none'
//                 value={value}
//                 onChange={onChange}
//             />
//         </div>
//     )
// }

// export default Input;

import { useRef } from 'react'

const Input = ({ type, placeholder, onChange, value, Icon, required, readOnly, disabled = false, min, label = null }) => {

    const Class = `
    group
    px-2
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
    ${!label ? "mt-2" : "mt-1"}
    bg-white
`;

    const inputRef = useRef();

    function focus(){
        inputRef.current?.focus();
    }

    return (
        <div>
            {label && <h3 onClick={focus} className='text-gray-600 text-md pl-0.5 inline-block cursor-pointer'>{label}</h3>}
            <div className={Class}>
                <div className='text-gray-400 transition-colors group-focus-within:text-blue-500'>
                    {Icon}
                </div>

                <input
                    ref={inputRef}
                    type={type}
                    placeholder={placeholder}
                    className='w-full h-full py-2 px-2 focus:outline-none text-gray-600'
                    value={value}
                    onChange={onChange}
                    required={required}
                    readOnly={readOnly}
                    disabled={disabled}
                    min={min}
                />
            </div>
        </div>
    )
}

export default Input;