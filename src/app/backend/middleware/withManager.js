import { withLogin } from "./withLogin";

export async function withManager(handler) {
    return withLogin(async (req) => {
        if (!req.user || req.user.role !== "manager") {
            return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
        return await handler(req);
    });
}