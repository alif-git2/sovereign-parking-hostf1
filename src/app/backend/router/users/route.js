import { getUsers } from "../../controller/users";

export async function GET(req) {
  return await getUsers(req);
}