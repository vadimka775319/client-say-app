"use client";

import { useId, useState, type FormEvent } from "react";
import {
  type Brief,
  type BriefQuestion,
  type BriefQuestionType,
  computeBriefPoints,
  daysLeft,
  partners,
  planLimits,
  rewards,
  rewardStatus,
} from "@/lib/mock-data";

type DraftQ = { id: string; type: BriefQuestionType; prompt: string; optionsText: string };

function draftToQuestion(d: DraftQ): BriefQuestion {
  const options =
    d.type === "choice"
      ? d.optionsText
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
  return {
    id: d.id,
    type: d.type,
    prompt: d.prompt.trim(),
    options: options && options.length ? options : d.type === "choice" ? ["Да", "Нет"] : undefined,
  };
}

export function PartnerTools({
  partnerBriefs,
  partnerRewards,
}: {
  partnerBriefs: Brief[];
  partnerRewards: (typeof rewards)[number][];
}) {
  const id = useId();
  const partner = partners[0];
  const limits = planLimits[partner.plan];

  const [title, setTitle] = useState("");
  const [localBriefs, setLocalBriefs] = useState(partnerBriefs);
  const [draftQuestions, setDraftQuestions] = useState<DraftQ[]>([
    { id: "draft-r1", type: "rating", prompt: "Общая оценка визита", optionsText: "" },
    { id: "draft-t1", type: "text", prompt: "Что понравилось больше всего?", optionsText: "" },
  ]);

  const canAdd = localBriefs.length < limits.maxBriefs;
  const qCount = draftQuestions.length;
  const maxQ = limits.maxQuestionsPerBrief;
  const previewPoints = computeBriefPoints(qCount);

  function setQType(index: number, type: BriefQuestionType) {
    setDraftQuestions((qs) =>
      qs.map((q, i) => (i === index ? { ...q, type, optionsText: type === "choice" ? q.optionsText : "" } : q)),
    );
  }

  function updateQ(index: number, patch: Partial<DraftQ>) {
    setDraftQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function addQuestionRow() {
    if (draftQuestions.length >= maxQ) return;
    setDraftQuestions((qs) => [
      ...qs,
      {
        id: `dq-${Date.now()}`,
        type: "text",
        prompt: "",
        optionsText: "",
      },
    ]);
  }

  function removeQuestionRow(index: number) {
    setDraftQuestions((qs) => qs.filter((_, i) => i !== index));
  }

  function addBrief(e: FormEvent) {
    e.preventDefault();
    if (!canAdd || !title.trim()) return;
    const validQs = draftQuestions
      .filter((d) => d.prompt.trim())
      .map((d) => draftToQuestion(d))
      .slice(0, maxQ);
    if (validQs.length === 0) return;
    const pts = computeBriefPoints(validQs.length);
    const newBrief: Brief = {
      id: `b-new-${Date.now()}`,
      partnerId: partner.id,
      title: title.trim(),
      questions: validQs,
      pointsForComplete: pts,
    };
    setLocalBriefs((b) => [...b, newBrief]);
    setTitle("");
    const t = Date.now();
    setDraftQuestions([
      { id: `draft-r-${t}`, type: "rating", prompt: "Оценка", optionsText: "" },
      { id: `draft-t-${t + 1}`, type: "text", prompt: "Комментарий", optionsText: "" },
    ]);
  }

  return (
    <>
      <section className="card border-violet-100 bg-gradient-to-br from-white to-violet-50/20">
        <h2 className="h2">Ваш тариф и лимиты</h2>
        <p className="mb-4 text-sm text-slate-600">
          Сейчас: <strong className="text-slate-900">{partner.plan}</strong>. Число вопросов в одном брифе ограничено
          тарифом; баллы за прохождение считаются автоматически (до 10 вопросов — 25 б., 11–20 — 50 б.).
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Возможность</th>
                <th className="px-3 py-2">Старт</th>
                <th className="px-3 py-2">Базовый</th>
                <th className="px-3 py-2">Полгода</th>
                <th className="px-3 py-2">Год</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <PlanRow label="Брифов" trial="2" monthly="5" half="15" year="40" />
              <PlanRow label="QR-кодов" trial="5" monthly="15" half="50" year="150" />
              <PlanRow label="Вопросов в брифе" trial="5" monthly="10" half="20" year="20" />
              <PlanRow label="Excel-экспорт" trial="—" monthly="✓" half="✓" year="✓" />
              <PlanRow label="Глубокая аналитика" trial="—" monthly="—" half="✓" year="✓" />
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="card">
          <h2 className="h2">Создать бриф с вопросами</h2>
          <p className="mb-3 text-sm text-slate-600">
            Типы: <strong>текст</strong> (развёрнутый ответ), <strong>1–5</strong> (шкала), <strong>выбор</strong> (несколько
            вариантов через запятую). Лимит вопросов: <strong>{draftQuestions.length}/{maxQ}</strong>. Баллы за прохождение:{" "}
            <strong>{previewPoints}</strong> (при текущем числе вопросов).
          </p>
          {!canAdd && (
            <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              Достигнут лимит брифов по тарифу.
            </p>
          )}
          <form onSubmit={addBrief} className="space-y-4 text-sm">
            <label className="block">
              <span className="text-slate-600">Название брифа</span>
              <input
                id={`${id}-title`}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Как прошёл визит?"
                disabled={!canAdd}
              />
            </label>

            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Вопросы</span>
                <button
                  type="button"
                  disabled={!canAdd || draftQuestions.length >= maxQ}
                  onClick={addQuestionRow}
                  className="text-xs font-semibold text-violet-700 disabled:text-slate-400"
                >
                  + вопрос
                </button>
              </div>
              {draftQuestions.map((dq, idx) => (
                <div key={dq.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      value={dq.type}
                      onChange={(e) => setQType(idx, e.target.value as BriefQuestionType)}
                      disabled={!canAdd}
                    >
                      <option value="text">Текст</option>
                      <option value="rating">Оценка 1–5</option>
                      <option value="choice">Выбор из вариантов</option>
                    </select>
                    {draftQuestions.length > 1 && (
                      <button
                        type="button"
                        className="text-xs text-rose-600"
                        onClick={() => removeQuestionRow(idx)}
                        disabled={!canAdd}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                  <input
                    className="mt-2 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Текст вопроса"
                    value={dq.prompt}
                    onChange={(e) => updateQ(idx, { prompt: e.target.value })}
                    disabled={!canAdd}
                  />
                  {dq.type === "choice" && (
                    <input
                      className="mt-2 w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
                      placeholder="Варианты через запятую: Быстро, Нормально, Долго"
                      value={dq.optionsText}
                      onChange={(e) => updateQ(idx, { optionsText: e.target.value })}
                      disabled={!canAdd}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={!canAdd || !title.trim()}
              className="w-full rounded-lg bg-slate-900 py-2.5 font-semibold text-white disabled:bg-slate-300"
            >
              Сохранить бриф и сгенерировать QR (демо)
            </button>
          </form>
        </article>

        <article className="card">
          <h2 className="h2">Брифы и QR-коды</h2>
          <p className="mb-3 text-sm text-slate-600">
            Каждый бриф — свой QR. Гость сканирует → проходит вопросы → видит начисленные баллы → регистрация (если ещё не
            в сервисе). У авторизованного пользователя прохождение сразу привязывается к аккаунту.
          </p>
          <ul className="space-y-4 text-sm">
            {localBriefs.map((brief) => (
              <li key={brief.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{brief.title}</strong>
                  <span className="text-violet-700">{brief.pointsForComplete} б.</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{brief.questions.length} вопросов</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {brief.questions.map((q) => (
                    <li key={q.id}>
                      · {q.prompt}{" "}
                      <span className="text-slate-400">
                        ({q.type === "text" ? "текст" : q.type === "rating" ? "1–5" : "выбор"})
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <MiniQr label={brief.id.slice(-6)} />
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  >
                    Скачать PNG (макет)
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <article className="card">
        <h2 className="h2">Призы вашей сети</h2>
        <div className="space-y-3 text-sm">
          {partnerRewards.map((reward) => (
            <div key={reward.id} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <strong>{reward.title}</strong>
                <span className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">{rewardStatus(reward)}</span>
              </div>
              <p className="text-slate-600">{reward.description}</p>
              <p className="text-xs text-slate-500">
                Осталось {reward.stockLeft} шт · до конца {daysLeft(reward.endsAt)} дн.
              </p>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <h2 className="h2">Аналитика</h2>
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold">Сканов QR</p>
            <p className="text-2xl font-bold">2 947</p>
            <MiniBars values={[40, 55, 48, 62, 70, 58]} />
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold">Завершение брифа</p>
            <p className="text-2xl font-bold">61%</p>
            <MiniBars values={[30, 45, 52, 58, 61, 61]} color="from-sky-500 to-violet-500" />
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold">Низкие оценки (1–2)</p>
            <p className="text-2xl font-bold">7%</p>
            <MiniBars values={[12, 10, 9, 8, 7, 7]} color="from-amber-500 to-rose-500" />
          </div>
        </div>
      </article>
    </>
  );
}

function PlanRow({
  label,
  trial,
  monthly,
  half,
  year,
}: {
  label: string;
  trial: string;
  monthly: string;
  half: string;
  year: string;
}) {
  return (
    <tr className="text-slate-700">
      <td className="px-3 py-2 font-medium">{label}</td>
      <td className="px-3 py-2">{trial}</td>
      <td className="px-3 py-2">{monthly}</td>
      <td className="px-3 py-2">{half}</td>
      <td className="px-3 py-2">{year}</td>
    </tr>
  );
}

function MiniQr({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
      <div className="grid h-14 w-14 grid-cols-5 gap-px bg-slate-900 p-1">
        {Array.from({ length: 25 }).map((_, i) => (
          <span
            key={i}
            className={i % 3 === 0 || i % 7 === 0 || i === 12 ? "bg-white" : "bg-slate-900"}
          />
        ))}
      </div>
      <span className="font-mono text-[10px] text-slate-500">QR · {label}</span>
    </div>
  );
}

function MiniBars({ values, color }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  const grad = color ?? "from-violet-500 to-sky-500";
  return (
    <div className="mt-2 flex h-10 items-end gap-0.5">
      {values.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t bg-gradient-to-t ${grad} opacity-90`}
          style={{ height: `${(v / max) * 100}%`, minHeight: "4px" }}
        />
      ))}
    </div>
  );
}
