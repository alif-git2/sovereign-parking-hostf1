import { useRef } from "react";

const TextArea = ({
    placeholder,
    value,
    onChange,
    Icon,
    required = false,
    readOnly = false,
    rows = 4,
    label = null
}) => {

    const Class = `
        group
        px-2
        py-2
        rounded-sm
        w-full
        border-2
        border-gray-300
        flex
        items-start
        gap-2
        transition-all
        duration-200
        focus-within:ring
        focus-within:ring-blue-400
        focus-within:border-blue-400
        focus-within:shadow-md
        focus-within:shadow-blue-100
    `;

    const inputRef = useRef(null);

    function focus() {
        inputRef.current?.focus();
    }

    return (
        <div>
            {label && <h3 onClick={focus} className='text-gray-600 text-md pl-0.5 inline-block cursor-pointer pb-1'>{label}</h3>}
            <div className={Class}>

                {Icon && (
                    <div className="text-gray-400 transition-colors group-focus-within:text-blue-500 ">
                        {Icon}
                    </div>
                )}

                <textarea
                    ref={inputRef}
                    rows={rows}
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    required={required}
                    readOnly={readOnly}
                    className="
                    w-full
                    resize-none
                    bg-transparent
                    outline-none
                    text-md
                "
                />
            </div></div>
    );
};

export default TextArea;