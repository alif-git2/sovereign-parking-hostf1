import jwt from "jsonwebtoken";

export async function withLogin(handler) {
    return async (req) => {
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = decoded?.user; // Attach user info to the request object
            return await handler(req);
        } catch (error) {
            console.error("JWT verification failed:", error);
            return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
    };
}