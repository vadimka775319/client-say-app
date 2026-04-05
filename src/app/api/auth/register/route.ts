import { authJsonError, authJsonSuccessWithCookie } from "@/lib/auth-route-helpers";
import {
  hashPasswordForRegister,
  parseRegisterRequest,
  persistRegisteredUser,
  resolveRegisterCredentials,
} from "@/lib/auth-service";
import { findUserByLogin } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return authJsonError(400, "bad_request", "Некорректное тело запроса.");
  }

  const parsed = parseRegisterRequest(json);
  if (!parsed.ok) {
    return authJsonError(parsed.status, parsed.code, parsed.message);
  }

  const creds = resolveRegisterCredentials(parsed.data.login);
  if (!creds.ok) {
    return authJsonError(creds.status, creds.code, creds.message);
  }

  const existing = await findUserByLogin(parsed.data.login);
  if (existing) {
    return authJsonError(
      409,
      "duplicate",
      "Этот email или телефон уже зарегистрирован. Войдите с тем же паролем.",
    );
  }

  const hashed = hashPasswordForRegister(parsed.data.password);
  if (!hashed.ok) {
    return authJsonError(hashed.status, hashed.code, hashed.message);
  }

  const created = await persistRegisteredUser(parsed.data, creds.email, creds.phone, hashed.hash);
  if (!created.ok) {
    return authJsonError(created.status, created.code, created.message);
  }

  return authJsonSuccessWithCookie(req, created.userId, created.role, { ok: true, role: created.role });
}
