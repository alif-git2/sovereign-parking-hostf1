import { getUserByEmail } from "../../../controller/park_user";

export async function POST(req) {
    try {
        return await getUserByEmail(req);
    } catch (error) {
        console.error("Error occurred while fetching user by email:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
};