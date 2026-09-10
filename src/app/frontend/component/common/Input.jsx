import React from 'react'

const Input = ({ type, placeholder, onChange, value }) => {
    return (
        <div>
            <input
                type={type} placeholder={placeholder}
                className='px-3 py-2 outline-none focus:border-none focus:ring-1 focus:ring-gray-400 rounded-md w-full'
                value={value}
                onChange={onChange}
            />
        </div>
    )
}

export default Input