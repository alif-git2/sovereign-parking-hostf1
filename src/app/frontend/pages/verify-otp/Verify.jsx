"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCodeVerify } from "@/app/frontend/store/verifyCodeStore";

export default function VerifyCode() {
    const [codes, setCodes] = useState(["", "", "", "", "", ""]);
    const inputsRef = useRef([]);
    const router = useRouter();
    const searchParam = useSearchParams();
    const token = searchParam.get("token");

    const { isNext, loading, message, verifyCode } = useCodeVerify();

    useEffect(() => {
        if (isNext) {
            router.push(`/reset-password?token=${token}`);
        }
    }, [isNext, router, token]);

    // Handle typing
    const handleChange = (value, index) => {
        if (!/^\d*$/.test(value)) return;

        const updatedCodes = [...codes];
        updatedCodes[index] = value.slice(-1);

        setCodes(updatedCodes);

        // move next input
        if (value && index < 5) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    // Handle backspace
    const handleKeyDown = (e, index) => {
        if (e.key === "Backspace" && !codes[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    // 🔥 Handle paste (MAIN FIX)
    const handlePaste = (e) => {
        e.preventDefault();

        const pastedData = e.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 6);

        if (!pastedData) return;

        const newCodes = ["", "", "", "", "", ""];

        for (let i = 0; i < pastedData.length; i++) {
            newCodes[i] = pastedData[i];
        }

        setCodes(newCodes);

        // focus next empty field
        const nextIndex = Math.min(pastedData.length, 5);
        inputsRef.current[nextIndex]?.focus();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const finalCode = codes.join("");

        if (finalCode.length !== 6) {
            alert("Please enter valid 6 digit code");
            return;
        }

        await verifyCode(finalCode);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

                <h1 className="text-3xl font-bold text-center text-gray-800">
                    Verify Code
                </h1>

                <p className="text-gray-500 text-center mt-2">
                    Enter the 6 digit verification code
                </p>

                <form onSubmit={handleSubmit} className="mt-8">

                    <div className="flex justify-between gap-3">
                        {codes.map((code, index) => (
                            <input
                                key={index}
                                ref={(el) => (inputsRef.current[index] = el)}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={code}
                                onChange={(e) => handleChange(e.target.value, index)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                onPaste={handlePaste}
                                className="w-14 h-14 text-center text-2xl font-semibold border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition duration-200"
                    >
                        {loading ? "Verifying...." : "Verify Code"}
                    </button>
                </form>
            </div>

            {!isNext && (
                <h5 className="text-center mt-5 text-red-500">
                    {message}
                </h5>
            )}
        </div>
    );
}