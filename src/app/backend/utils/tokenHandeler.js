import jwt from "jsonwebtoken";

const Secrate = process.env.JWT_SECRET;

export const generateToken = (user) => {
    return jwt.sign({ user }, Secrate, { expiresIn: "30d" });
}

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, Secrate);
    } catch (error) {
        console.error("Error verifying token:", error);
        throw new Error("Invalid token");
    }
}