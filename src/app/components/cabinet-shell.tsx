"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { useCabinetIdleLogout } from "@/app/components/use-cabinet-idle-logout";
import { BRAND_NAME } from "@/lib/brand";

type CabinetShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/**
 * Общая шапка кабинетов: бренд, контекст, выход. Доступ к маршруту проверяется в `src/middleware.ts` (через `proxy.ts`).
 */
export function CabinetShell({ title, subtitle, children }: CabinetShellProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  useCabinetIdleLogout();

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include", cache: "no-store" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
            <Link href="/" className="group flex shrink-0 items-center gap-2 no-underline">
              <span className="font-brand-logo bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-lg tracking-tight text-transparent transition-opacity group-hover:opacity-90 md:text-xl">
                {BRAND_NAME}
              </span>
            </Link>
            <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{title}</p>
              {subtitle ? <p className="hidden truncate text-xs text-slate-500 sm:block">{subtitle}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-full px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              На сайт
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={logout}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800 disabled:opacity-60"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
