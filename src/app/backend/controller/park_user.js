import User from "../models/park_user";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { clearTokenCookie } from "../utils/cookieHandeler";
import { generateToken } from "../utils/tokenHandeler";

export async function getUserByEmail(req) {
    const body = await req.json();
    const email = body.email;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error("User not found");
        }

        return user;
    } catch (error) {
        console.error("Error fetching user by email:", error);
        throw error;
    }
};

export async function loginUser(req) {
    const body = await req.json();
    const user = await User.findOne({ email: body.email });
    if (!user) throw new Error("User not found");

    const isMatch = await bcrypt.compare(body.password, user.password);

    if (!isMatch) throw new Error("Invalid credentials");

    const token = generateToken(user);

    return { user, token };
};

export async function logoutUser() {
    const response = NextResponse.json({ success: true });
    clearTokenCookie(response);
    return response;
}