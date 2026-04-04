"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Видно внизу главной: с какого сервера реально отдалась страница (по /api/health). */
export function DeployBadge() {
  const [line, setLine] = useState("Проверка сервера…");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store", credentials: "omit" });
        const j = (await r.json()) as {
          ok?: boolean;
          db?: string;
          deploy?: { gitShort?: string | null; deployedAt?: string | null };
        };
        if (!alive) return;
        const sha = j.deploy?.gitShort ?? "—";
        const db = j.db ?? "?";
        setLine(`Сервер · сборка ${sha} · БД ${db}`);
      } catch {
        if (alive) setLine("Сервер не ответил на /api/health");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <p className="mt-3 text-[11px] text-slate-500">
      {line}
      {" · "}
      <Link href="/health" className="text-violet-300 underline hover:text-white">
        страница проверки /health
      </Link>
    </p>
  );
}
