"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type PublicBriefPayload = {
  id: string;
  title: string;
  pointsForComplete: number;
  companyName: string;
  questions: { id: string; type: "text" | "rating" | "choice"; prompt: string; options: string[] }[];
};

export function BriefByIdClient({ brief }: { brief: PublicBriefPayload }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ points: number; balance: number } | null>(null);

  const signInHref = `/sign-in?role=USER&next=${encodeURIComponent(`/brief/${brief.id}`)}`;

  async function submit() {
    setError("");
    const payload: Record<string, string | number> = {};
    for (const q of brief.questions) {
      const raw = answers[q.id];
      if (raw === undefined || raw === "") {
        setError("Ответьте на все вопросы.");
        return;
      }
      if (q.type === "rating") {
        const n = Number(raw);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 5) {
          setError("Оценка должна быть от 1 до 5.");
          return;
        }
        payload[q.id] = n;
      } else {
        payload[q.id] = raw;
      }
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/user/brief/${brief.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      const j = (await res.json()) as { error?: { message?: string }; pointsAwarded?: number; points?: number };
      if (!res.ok) {
        if (res.status === 403) {
          setError("Войдите как пользователь, чтобы отправить ответы и получить баллы.");
          return;
        }
        setError(j.error?.message ?? "Не удалось отправить.");
        return;
      }
      setDone({ points: j.pointsAwarded ?? 0, balance: j.points ?? 0 });
      router.refresh();
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto w-full max-w-lg px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Готово</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Спасибо за ответы!</h1>
        <p className="mt-3 text-sm text-slate-600">
          Начислено <strong>{done.points}</strong> баллов. Текущий баланс: <strong>{done.balance}</strong>.
        </p>
        <Link href="/user" className="mt-6 inline-block text-sm font-semibold text-violet-700 underline">
          Перейти в личный кабинет
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Бриф</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{brief.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{brief.companyName}</p>
      <p className="mt-2 text-sm text-slate-600">
        За полное прохождение начислим <strong>{brief.pointsForComplete}</strong> баллов.
      </p>

      <div className="mt-8 space-y-6 text-sm">
        {brief.questions.map((q) => (
          <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-medium text-slate-900">{q.prompt || "Вопрос"}</p>
            {q.type === "text" && (
              <textarea
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                rows={3}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder="Ваш ответ"
              />
            )}
            {q.type === "rating" && (
              <select
                className="mt-2 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              >
                <option value="">— Оценка —</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            )}
            {q.type === "choice" && (
              <select
                className="mt-2 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              >
                <option value="">— Выберите вариант —</option>
                {q.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p>{error}</p>
          {error.includes("Войдите") ? (
            <Link href={signInHref} className="mt-2 inline-block font-semibold text-violet-700 underline">
              Войти или зарегистрироваться
            </Link>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-6 w-full rounded-full bg-slate-900 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {busy ? "Отправка…" : "Отправить ответы"}
      </button>

      <p className="mt-4 text-xs text-slate-500">
        Нужен аккаунт пользователя.{" "}
        <Link href={signInHref} className="font-semibold text-violet-700 underline">
          Вход / регистрация
        </Link>
      </p>
    </main>
  );
}
