import { logoutUser } from "../../../controller/park_user";

export async function POST() {
    try {
        return await logoutUser();
    } catch (error) {
        console.error("Error occurred while logging out user:", error);
         return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}