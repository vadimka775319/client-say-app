"use client";

import Link from "next/link";
import { useMemo } from "react";
import { computeBriefPoints } from "@/lib/mock-data";

type DraftQuestion = { id: string; type: string; prompt: string; options: string };

type BriefItem = {
  id: string;
  title: string;
  questions: DraftQuestion[];
  pointsForComplete: number;
  qrCode: string;
  qrDataUrl?: string;
};

function readBriefById(id: string): BriefItem | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("clientsay_partner_briefs");
    if (!raw) return null;
    const list = JSON.parse(raw) as BriefItem[];
    if (!Array.isArray(list)) return null;
    return list.find((b) => b.id === id) ?? null;
  } catch {
    return null;
  }
}

export function BriefByIdClient({ id }: { id: string }) {
  const brief = useMemo(() => readBriefById(id), [id]);

  if (!brief) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-4 px-5 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Бриф не найден</h1>
        <p className="text-sm text-slate-600">
          Ссылка устарела или бриф создан в другом браузере. Откройте QR снова с устройства, где его создали, либо
          попросите партнёра прислать новую ссылку.
        </p>
        <Link href="/" className="text-sm font-semibold text-violet-700 underline">
          На главную
        </Link>
      </main>
    );
  }

  const pts = computeBriefPoints(brief.questions.length);

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Бриф</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{brief.title}</h1>
      <p className="mt-2 text-sm text-slate-600">
        За полное прохождение начислим <strong>{brief.pointsForComplete ?? pts}</strong> баллов (по правилам акции).
      </p>
      <ol className="mt-6 list-decimal space-y-4 pl-5 text-sm text-slate-800">
        {brief.questions.map((q) => (
          <li key={q.id}>
            <span className="font-medium">{q.prompt || "Вопрос"}</span>
            <span className="mt-1 block text-xs text-slate-500">
              {q.type === "text"
                ? "Свободный ответ"
                : q.type === "rating"
                  ? "Шкала 1–5"
                  : `Варианты: ${(q.options ?? "").split(",").map((s) => s.trim()).filter(Boolean).join(", ") || "—"}`}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-8 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
        В демо-режиме отправка ответов с этой страницы ещё не подключена к серверу — используйте личный кабинет
        пользователя (блок «Демо: сканирование QR») или подключите API позже.
      </p>
      <Link href="/user" className="mt-4 inline-block text-sm font-semibold text-violet-700 underline">
        Личный кабинет
      </Link>
    </main>
  );
}
