import type { SessionRole } from "@/lib/auth-session";

export function cabinetPath(role: SessionRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "PARTNER":
      return "/partner";
    case "USER":
      return "/user";
  }
}

export function requiredRoleForPath(pathname: string): SessionRole | null {
  if (pathname.startsWith("/admin")) return "SUPER_ADMIN";
  if (pathname.startsWith("/partner")) return "PARTNER";
  if (pathname.startsWith("/user")) return "USER";
  return null;
}

export function parseSessionRole(value: string | null): SessionRole | null {
  if (value === "SUPER_ADMIN" || value === "PARTNER" || value === "USER") return value;
  return null;
}

/** Защита от открытого редиректа: только относительный путь внутри приложения. */
export function resolvePostLoginRedirect(nextParam: string | null, userRole: SessionRole): string {
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    const need = requiredRoleForPath(nextParam);
    if (need === userRole) return nextParam;
  }
  return cabinetPath(userRole);
}
