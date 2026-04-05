import { handleRegisterPost } from "@/lib/handle-register-post";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handleRegisterPost(req);
}
