import { authJsonError, authJsonSuccessWithCookie } from "@/lib/auth-route-helpers";
import { parseLoginRequest, performLogin } from "@/lib/auth-service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return authJsonError(400, "bad_request", "Некорректное тело запроса.");
  }

  const parsed = parseLoginRequest(json);
  if (!parsed.ok) {
    return authJsonError(parsed.status, parsed.code, parsed.message);
  }

  const result = await performLogin(parsed.login, parsed.password, parsed.expectedRole);
  if (!result.ok) {
    return authJsonError(result.status, result.code, result.message);
  }

  return authJsonSuccessWithCookie(req, result.userId, result.role, { ok: true, role: result.role });
}
