export const GoogleIcon = ({ size = 20, className = "mr-1" }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            className={className}
            fill="none"
        >
            <path
                fill="currentColor"
                d="M24 9.5c3.54 0 6.72 1.22 9.24 3.62l6.9-6.9C36.68 2.36 30.74 0 24 0 14.62 0 6.54 5.38 2.56 13.22l8.02 6.22C12.46 13.1 17.8 9.5 24 9.5z"
            />
            <path
                fill="currentColor"
                d="M46.98 24.5c0-1.64-.14-3.22-.4-4.75H24v9h12.9c-.56 2.98-2.26 5.5-4.8 7.22l7.36 5.72C44.6 37.1 47 31.4 47 24.5z"
            />
            <path
                fill="currentColor"
                d="M10.58 28.44A14.5 14.5 0 019.5 24c0-1.54.26-3.02.72-4.44l-8.02-6.22A23.9 23.9 0 000 24c0 3.86.92 7.5 2.56 10.66l8.02-6.22z"
            />
            <path
                fill="currentColor"
                d="M24 48c6.48 0 11.92-2.14 15.9-5.82l-7.36-5.72c-2.04 1.36-4.66 2.18-8.54 2.18-6.2 0-11.54-3.6-13.42-8.56l-8.02 6.22C6.54 42.62 14.62 48 24 48z"
            />
        </svg>
    );
};


export const InstagramIcon = ({ size = 24, className = "" }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2z"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
            />
            <circle
                cx="12"
                cy="12"
                r="3.5"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
            />
            <circle
                cx="17.5"
                cy="6.5"
                r="1.2"
                fill="currentColor"
            />
        </svg>
    );
};

export const FacebookIcon = ({ size = 30, className = "-ml-[0.4rem]" }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z"
                fill="currentColor"
            />
        </svg>
    );
};