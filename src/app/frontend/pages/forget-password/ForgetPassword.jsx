"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForget } from "@/app/frontend/store/forgetPasswordStore";

export default function ForgotPassword() {

    const [email, setEmail] = useState("");

    const router = useRouter();

    const {
        forgetPassword,
        loading,
        isNext,
        message,
        token
    } = useForget();

    const handleSubmit = async (e) => {
        e.preventDefault();

        await forgetPassword(email);
    };

    // Navigate when isNext becomes true
    useEffect(() => {

        if (isNext) {
            router.push(`/verify-otp?token=${token}`);
        }

    }, [isNext, router, email]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

                <h1 className="text-3xl font-bold text-center text-gray-800">
                    Forgot Password
                </h1>

                <p className="text-gray-500 text-center mt-2">
                    Enter your email to receive a verification code
                </p>

                <form onSubmit={handleSubmit} className="mt-8">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email Address
                        </label>

                        <input
                            type="email"
                            required
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-12 px-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition duration-200"
                    >
                        {loading ? "Forgetting..." : "Forget Password"}
                    </button>

                    {!isNext && (
                        <h5 className="text-center mt-5">
                            {message}
                        </h5>
                    )}

                </form>
            </div>
        </div>
    );
}