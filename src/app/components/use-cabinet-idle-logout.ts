"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/** Без действий мыши/клавиатуры/касаний — выход и редирект на вход (тот же сценарий, что «сессия истекла»). */
const IDLE_MS = 30 * 60 * 1000;

function cabinetSignInRole(pathname: string): string {
  if (pathname.startsWith("/partner")) return "PARTNER";
  if (pathname.startsWith("/user")) return "USER";
  if (pathname.startsWith("/admin")) return "SUPER_ADMIN";
  return "";
}

export function useCabinetIdleLogout() {
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const armLogout = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include", cache: "no-store" });
      } catch {
        /* ignore */
      }
      const role = cabinetSignInRole(pathname);
      const q = role ? `?role=${encodeURIComponent(role)}` : "";
      window.location.assign(`/sign-in${q}`);
    }, IDLE_MS);
  }, [clearTimer, pathname]);

  useEffect(() => {
    const inCabinet =
      pathname.startsWith("/partner") || pathname.startsWith("/user") || pathname.startsWith("/admin");
    if (!inCabinet) {
      clearTimer();
      return;
    }

    const bump = () => {
      if (document.visibilityState === "hidden") return;
      armLogout();
    };

    armLogout();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("mousedown", bump, opts);
    window.addEventListener("keydown", bump, opts);
    window.addEventListener("touchstart", bump, opts);
    window.addEventListener("scroll", bump, opts);
    document.addEventListener("visibilitychange", bump);

    return () => {
      clearTimer();
      window.removeEventListener("mousedown", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("touchstart", bump);
      window.removeEventListener("scroll", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, [pathname, armLogout, clearTimer]);
}
