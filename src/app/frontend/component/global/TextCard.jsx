import React from 'react'

const TextCard = ({ data, isKeyVal = true, text }) => {
    return (
        <div className='flex gap-2 px-3 py-2 rounded-md shadow border-e-4 border-blue-400 transition-all duration-150 hover:bg-gray-400/20 bg-white' >
            {isKeyVal ? (<>
                <span className='font-semibold'>{data.key}</span>
                <span className='font-semibold'>:</span>
                <span>{data.value}</span>
            </>) : (<h4 className='font-bold'>{text}</h4>)}
        </div>
    )
}

export default TextCard;