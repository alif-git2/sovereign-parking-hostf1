import React from 'react'

const BoxCard = ({ children, bgWhite = false, padding = null }) => {
  return (
    <div
      className={`w-full h-auto border-t-4 border-blue-400 rounded-lg shadow-md ${bgWhite ? "bg-white" : "bg-gray-400/10"} mt-6 ${padding ? padding : "p-6"}`}
    >{children}</div>
  )
}

export default BoxCard;