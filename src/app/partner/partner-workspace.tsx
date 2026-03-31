"use client";

import { useEffect, useMemo, useState } from "react";
import { computeBriefPoints, type BriefQuestionType } from "@/lib/mock-data";

type DraftQuestion = { id: string; type: BriefQuestionType; prompt: string; options: string };
type BriefItem = {
  id: string;
  title: string;
  questions: DraftQuestion[];
  pointsForComplete: number;
  qrCode: string;
};

export function PartnerWorkspace() {
  const [companyName, setCompanyName] = useState("");
  const [locations, setLocations] = useState(0);
  const [registeredUsers, setRegisteredUsers] = useState(0);
  const [briefTitle, setBriefTitle] = useState("");
  const [manualPoints, setManualPoints] = useState(0);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([
    { id: "q-1", type: "text", prompt: "", options: "" },
  ]);
  const [briefs, setBriefs] = useState<BriefItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const rawProfile = localStorage.getItem("clientsay_partner_profile");
      if (rawProfile) {
        const p = JSON.parse(rawProfile) as { companyName?: string; locations?: number };
        setCompanyName(p.companyName ?? "");
        setLocations(p.locations ?? 0);
      }
      const rawBriefs = localStorage.getItem("clientsay_partner_briefs");
      if (rawBriefs) {
        const saved = JSON.parse(rawBriefs) as BriefItem[];
        if (Array.isArray(saved)) setBriefs(saved);
      }
    } catch {
      // no-op
    }

    try {
      const userAccountsRaw = localStorage.getItem("clientsay_accounts_user");
      const userAccounts = userAccountsRaw ? (JSON.parse(userAccountsRaw) as unknown[]) : [];
      setRegisteredUsers(Array.isArray(userAccounts) ? userAccounts.length : 0);
    } catch {
      setRegisteredUsers(0);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "clientsay_partner_profile",
      JSON.stringify({ companyName, locations, reviewsCount: 0, rating: 0 }),
    );
  }, [companyName, locations]);

  useEffect(() => {
    localStorage.setItem("clientsay_partner_briefs", JSON.stringify(briefs));
  }, [briefs]);

  const autoPoints = useMemo(() => computeBriefPoints(draftQuestions.length), [draftQuestions.length]);
  const pointsToSave = manualPoints > 0 ? manualPoints : autoPoints;

  function addQuestion() {
    setDraftQuestions((q) => [...q, { id: `q-${Date.now()}`, type: "text", prompt: "", options: "" }]);
  }

  function updateQuestion(id: string, patch: Partial<DraftQuestion>) {
    setDraftQuestions((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function removeQuestion(id: string) {
    setDraftQuestions((q) => (q.length > 1 ? q.filter((x) => x.id !== id) : q));
  }

  function createBrief() {
    const title = briefTitle.trim();
    if (!title) return setMessage("Введите название брифа.");
    if (!companyName.trim()) return setMessage("Сначала заполните название компании.");
    const validQuestions = draftQuestions.filter((q) => q.prompt.trim());
    if (!validQuestions.length) return setMessage("Добавьте хотя бы один вопрос.");

    const id = `brief-${Date.now()}`;
    const qrCode = `https://clientsay.ru/brief/${id}`;
    const next: BriefItem = {
      id,
      title,
      questions: validQuestions,
      pointsForComplete: pointsToSave,
      qrCode,
    };
    setBriefs((b) => [next, ...b]);
    setBriefTitle("");
    setManualPoints(0);
    setDraftQuestions([{ id: `q-${Date.now()}`, type: "text", prompt: "", options: "" }]);
    setMessage("Бриф создан. QR ссылка сгенерирована.");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-8 md:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-slate-500">Кабинет партнера</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{companyName || "Новая компания"}</h1>
        <p className="mt-2 text-sm text-slate-600">Заполните данные компании и создавайте брифы с QR.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Точек</p>
          <p className="mt-2 text-3xl font-bold">{locations}</p>
        </article>
        <article className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Зарегистрированных пользователей</p>
          <p className="mt-2 text-3xl font-bold">{registeredUsers}</p>
        </article>
        <article className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Брифов создано</p>
          <p className="mt-2 text-3xl font-bold">{briefs.length}</p>
        </article>
      </section>

      <section className="card">
        <h2 className="h2">Профиль компании</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Название компании"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <input
            type="number"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Количество точек"
            value={locations}
            onChange={(e) => setLocations(Number(e.target.value) || 0)}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="h2">Конструктор брифа</h2>
        <div className="space-y-3 text-sm">
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Название брифа"
            value={briefTitle}
            onChange={(e) => setBriefTitle(e.target.value)}
          />
          {draftQuestions.map((q) => (
            <div key={q.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap gap-2">
                <select
                  className="rounded border border-slate-200 px-2 py-1"
                  value={q.type}
                  onChange={(e) => updateQuestion(q.id, { type: e.target.value as BriefQuestionType })}
                >
                  <option value="text">Текст</option>
                  <option value="rating">Оценка 1-5</option>
                  <option value="choice">Выбор</option>
                </select>
                <button type="button" className="text-xs text-rose-600" onClick={() => removeQuestion(q.id)}>
                  Удалить
                </button>
              </div>
              <input
                className="mt-2 w-full rounded border border-slate-200 px-2 py-1.5"
                placeholder="Текст вопроса"
                value={q.prompt}
                onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
              />
              {q.type === "choice" && (
                <input
                  className="mt-2 w-full rounded border border-slate-200 px-2 py-1.5"
                  placeholder="Варианты через запятую"
                  value={q.options}
                  onChange={(e) => updateQuestion(q.id, { options: e.target.value })}
                />
              )}
            </div>
          ))}
          <button type="button" className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold" onClick={addQuestion}>
            + Добавить вопрос
          </button>
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
              Автобаллы: <strong>{autoPoints}</strong>
            </p>
            <input
              type="number"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={manualPoints}
              onChange={(e) => setManualPoints(Number(e.target.value) || 0)}
              placeholder="Баллы вручную (опционально)"
            />
          </div>
          <button type="button" onClick={createBrief} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Сохранить бриф и сгенерировать QR
          </button>
          {message && <p className="text-xs text-violet-700">{message}</p>}
        </div>
      </section>

      <section className="card">
        <h2 className="h2">Ваши брифы и QR</h2>
        <div className="space-y-3 text-sm">
          {briefs.length === 0 ? (
            <p className="text-slate-500">Пока нет брифов. Создайте первый бриф выше.</p>
          ) : (
            briefs.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{b.title}</strong>
                  <span className="text-violet-700">{b.pointsForComplete} б.</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Вопросов: {b.questions.length}</p>
                <p className="mt-1 rounded bg-slate-100 px-2 py-1 font-mono text-xs">{b.qrCode}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
