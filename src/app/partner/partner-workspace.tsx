"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { computeBriefPoints, type BriefQuestionType } from "@/lib/mock-data";

type DraftQuestion = { id: string; type: BriefQuestionType; prompt: string; options: string };
type BriefItem = {
  id: string;
  title: string;
  questions: DraftQuestion[];
  pointsForComplete: number;
  responseCount: number;
  qrCode: string;
  qrDataUrl?: string;
};

type ApiQuestion = { id: string; type: string; prompt: string; options: string[] };
type ApiBriefRow = {
  id: string;
  title: string;
  pointsOverride: number | null;
  pointsForComplete: number;
  responseCount: number;
  questions: ApiQuestion[];
};

type PartnerCabinetReward = {
  id: string;
  title: string;
  description: string;
  termsText: string;
  rulesText: string;
  imageUrl: string;
  pointsCost: number;
  totalStock: number;
  stockLeft: number;
  startsAt: string;
  endsAt: string;
};

function publicBriefUrl(id: string): string {
  if (typeof window === "undefined") return `https://clientsay.ru/brief/${id}`;
  return `${window.location.origin}/brief/${id}`;
}

function apiRowToBriefItem(b: ApiBriefRow): BriefItem {
  return {
    id: b.id,
    title: b.title,
    pointsForComplete: b.pointsForComplete,
    responseCount: b.responseCount,
    questions: b.questions.map((q) => ({
      id: q.id,
      type: (q.type === "TEXT" ? "text" : q.type === "RATING" ? "rating" : "choice") as BriefQuestionType,
      prompt: q.prompt,
      options: q.options?.length ? q.options.join(", ") : "",
    })),
    qrCode: publicBriefUrl(b.id),
    qrDataUrl: undefined,
  };
}

async function makeQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 240, margin: 2, errorCorrectionLevel: "M" });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function speakUrlAloud(url: string, onUnsupported: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onUnsupported();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(url);
  u.lang = "ru-RU";
  u.rate = 0.92;
  window.speechSynthesis.speak(u);
}

export function PartnerWorkspace() {
  const [companyName, setCompanyName] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [locations, setLocations] = useState(0);
  const [registeredUsers, setRegisteredUsers] = useState(0);
  const [cabinetLoading, setCabinetLoading] = useState(true);
  const [cabinetError, setCabinetError] = useState<string | null>(null);
  const [briefTitle, setBriefTitle] = useState("");
  const [manualPoints, setManualPoints] = useState(0);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([
    { id: "q-1", type: "text", prompt: "", options: "" },
  ]);
  const [briefs, setBriefs] = useState<BriefItem[]>([]);
  const [message, setMessage] = useState("");
  const [editingBriefId, setEditingBriefId] = useState<string | null>(null);
  const [qrBusyId, setQrBusyId] = useState<string | null>(null);
  const [partnerRewards, setPartnerRewards] = useState<PartnerCabinetReward[]>([]);

  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);

  const [companySaving, setCompanySaving] = useState(false);
  const [companyNotice, setCompanyNotice] = useState<string | null>(null);

  const [prizeForm, setPrizeForm] = useState({
    title: "",
    description: "",
    giftTerms: "",
    giftConditions: "",
    imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
    pointsCost: "150",
    totalStock: "30",
    stockLeft: "30",
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: "2026-12-31",
  });

  const responseCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of briefs) m[b.id] = b.responseCount ?? 0;
    return m;
  }, [briefs]);

  const reloadCabinet = useCallback(async () => {
    setCabinetError(null);
    try {
      const br = await fetch("/api/partner/briefs", { cache: "no-store" });
      if (!br.ok) {
        if (br.status === 403 && typeof window !== "undefined") {
          window.location.assign("/sign-in?role=PARTNER&next=/partner");
          return;
        }
        if (br.status === 403) setCabinetError("Нет доступа.");
        return;
      }
      const j = (await br.json()) as { briefs: ApiBriefRow[]; registeredUsers: number };
      setRegisteredUsers(j.registeredUsers ?? 0);
      setBriefs((j.briefs ?? []).map(apiRowToBriefItem));
    } catch {
      setCabinetError("Не удалось загрузить брифы.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCabinetLoading(true);
      setCabinetError(null);
      await reloadCabinet();
      if (cancelled) return;
      try {
        const rr = await fetch("/api/partner/rewards", { cache: "no-store" });
        if (rr.status === 403 && typeof window !== "undefined") {
          window.location.assign("/sign-in?role=PARTNER&next=/partner");
          return;
        }
        if (rr.ok && !cancelled) {
          const j = (await rr.json()) as { rewards?: PartnerCabinetReward[] };
          setPartnerRewards(Array.isArray(j.rewards) ? j.rewards : []);
        }
      } finally {
        if (!cancelled) setCabinetLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadCabinet]);

  const companyHydratedFromApi = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/me", { cache: "no-store" });
      if (!r.ok || cancelled || companyHydratedFromApi.current) return;
      const d = (await r.json()) as {
        partner?: { companyName: string; city: string; addressLine: string; locations: number } | null;
      };
      if (d.partner) {
        companyHydratedFromApi.current = true;
        setCompanyName(d.partner.companyName);
        setCompanyCity(d.partner.city ?? "");
        setCompanyAddress(d.partner.addressLine ?? "");
        setLocations(d.partner.locations ?? 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const regenerateQr = useCallback(async (briefId: string) => {
    setQrBusyId(briefId);
    try {
      const url = publicBriefUrl(briefId);
      const qrDataUrl = await makeQrDataUrl(url);
      setBriefs((list) => list.map((x) => (x.id === briefId ? { ...x, qrCode: url, qrDataUrl } : x)));
      setMessage("QR-код сгенерирован.");
    } catch {
      setMessage("Ошибка генерации QR. Попробуйте кнопку «Сгенерировать QR» ещё раз.");
    } finally {
      setQrBusyId(null);
    }
  }, []);

  /** При раскрытии карточки брифа генерируем QR (лениво), если картинки ещё нет */
  useEffect(() => {
    if (!expandedBriefId) return;
    const b = briefs.find((x) => x.id === expandedBriefId);
    if (b?.qrDataUrl) return;
    void regenerateQr(expandedBriefId);
  }, [expandedBriefId, briefs, regenerateQr]);

  const autoPoints = useMemo(() => computeBriefPoints(draftQuestions.length), [draftQuestions.length]);

  const addQuestion = useCallback(() => {
    setDraftQuestions((q) => [...q, { id: `q-${Date.now()}`, type: "text", prompt: "", options: "" }]);
  }, []);

  const updateQuestion = useCallback((id: string, patch: Partial<DraftQuestion>) => {
    setDraftQuestions((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setDraftQuestions((q) => (q.length > 1 ? q.filter((x) => x.id !== id) : q));
  }, []);

  const resetConstructor = useCallback(() => {
    setBriefTitle("");
    setManualPoints(0);
    setDraftQuestions([{ id: `q-${Date.now()}`, type: "text", prompt: "", options: "" }]);
    setEditingBriefId(null);
  }, []);

  const startEditBrief = useCallback((b: BriefItem) => {
    setEditingBriefId(b.id);
    setBriefTitle(b.title);
    const auto = computeBriefPoints(b.questions.length);
    setManualPoints(b.pointsForComplete !== auto ? b.pointsForComplete : 0);
    setDraftQuestions(b.questions.map((q) => ({ ...q })));
    setMessage("Редактирование: измените вопросы и нажмите «Сохранить бриф».");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  async function saveBrief() {
    const title = briefTitle.trim();
    if (!title) return setMessage("Введите название брифа.");
    if (!companyName.trim()) return setMessage("Сначала заполните название компании.");
    const validQuestions = draftQuestions.filter((q) => q.prompt.trim());
    if (!validQuestions.length) return setMessage("Добавьте хотя бы один вопрос.");

    const questionsPayload = validQuestions.map((q, i) => ({
      type: q.type.toUpperCase() as "TEXT" | "RATING" | "CHOICE",
      prompt: q.prompt.trim(),
      options:
        q.type === "choice"
          ? q.options
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      order: i,
    }));

    const body = {
      title,
      pointsOverride: manualPoints > 0 ? manualPoints : null,
      questions: questionsPayload,
    };

    try {
      const url = editingBriefId ? `/api/partner/briefs/${editingBriefId}` : "/api/partner/briefs";
      const r = await fetch(url, {
        method: editingBriefId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { error?: { message?: string } };
      if (!r.ok) {
        setMessage(j?.error?.message ?? "Не удалось сохранить бриф.");
        return;
      }
      setMessage(
        editingBriefId
          ? "Бриф обновлён в базе. QR ведёт на ту же страницу."
          : "Бриф создан в базе. Ниже — ссылка и QR для печати.",
      );
      resetConstructor();
      await reloadCabinet();
    } catch {
      setMessage("Сеть недоступна при сохранении брифа.");
    }
  }

  function resetPrizeForm() {
    setEditingPrizeId(null);
    setPrizeForm({
      title: "",
      description: "",
      giftTerms: "",
      giftConditions: "",
      imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
      pointsCost: "150",
      totalStock: "30",
      stockLeft: "30",
      startsAt: new Date().toISOString().slice(0, 10),
      endsAt: "2026-12-31",
    });
  }

  function startEditPrize(r: PartnerCabinetReward) {
    setEditingPrizeId(r.id);
    setPrizeForm({
      title: r.title,
      description: r.description,
      giftTerms: r.termsText ?? "",
      giftConditions: r.rulesText ?? "",
      imageUrl: r.imageUrl,
      pointsCost: String(r.pointsCost),
      totalStock: String(r.totalStock),
      stockLeft: String(r.stockLeft),
      startsAt: r.startsAt.slice(0, 10),
      endsAt: r.endsAt.slice(0, 10),
    });
    setMessage("Редактирование приза — измените поля и нажмите «Сохранить приз».");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitPartnerPrize(e: FormEvent) {
    e.preventDefault();
    const total = Math.max(1, Number(prizeForm.totalStock) || 1);
    const left = Math.min(Math.max(0, Number(prizeForm.stockLeft) || 0), total);
    const payload = {
      title: prizeForm.title.trim() || "Приз партнёра",
      description: prizeForm.description.trim(),
      termsText: prizeForm.giftTerms.trim(),
      rulesText: prizeForm.giftConditions.trim(),
      imageUrl: prizeForm.imageUrl.trim() || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
      pointsCost: Number(prizeForm.pointsCost) || 0,
      totalStock: total,
      stockLeft: left,
      startsAt: new Date(prizeForm.startsAt + "T12:00:00.000Z").toISOString(),
      endsAt: new Date(prizeForm.endsAt + "T23:59:59.000Z").toISOString(),
    };
    try {
      const url = editingPrizeId ? `/api/partner/rewards/${editingPrizeId}` : "/api/partner/rewards";
      const r = await fetch(url, {
        method: editingPrizeId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json()) as { error?: { message?: string } };
      if (!r.ok) {
        setMessage(j?.error?.message ?? "Не удалось сохранить приз.");
        return;
      }
      setMessage(editingPrizeId ? "Приз обновлён в базе." : "Приз добавлен — виден пользователям в кабинете.");
      resetPrizeForm();
      const rr = await fetch("/api/partner/rewards", { cache: "no-store" });
      if (rr.ok) {
        const jr = (await rr.json()) as { rewards?: PartnerCabinetReward[] };
        setPartnerRewards(Array.isArray(jr.rewards) ? jr.rewards : []);
      }
    } catch {
      setMessage("Сеть недоступна при сохранении приза.");
    }
  }

  function onPrizeImageFile(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      if (url) setPrizeForm((f) => ({ ...f, imageUrl: url }));
    };
    reader.readAsDataURL(file);
  }

  async function removePartnerPrize(id: string) {
    if (!confirm("Удалить приз из витрины?")) return;
    try {
      const r = await fetch(`/api/partner/rewards/${id}`, { method: "DELETE" });
      if (!r.ok) {
        setMessage("Не удалось удалить приз.");
        return;
      }
      if (editingPrizeId === id) resetPrizeForm();
      setPartnerRewards((list) => list.filter((x) => x.id !== id));
    } catch {
      setMessage("Сеть недоступна.");
    }
  }

  const maxResponses = Math.max(1, ...briefs.map((b) => responseCounts[b.id] ?? 0));

  async function saveCompanyProfileToServer() {
    setCompanySaving(true);
    setCompanyNotice(null);
    try {
      const r = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          city: companyCity.trim(),
          addressLine: companyAddress.trim(),
          locations,
        }),
      });
      const j = (await r.json()) as { error?: { message?: string } };
      if (!r.ok) {
        setCompanyNotice(j?.error?.message ?? "Не удалось сохранить компанию.");
        return;
      }
      setCompanyNotice("Профиль компании сохранён в базе — пользователи увидят его в разделе «Где оставить бриф».");
    } catch {
      setCompanyNotice("Сеть недоступна.");
    } finally {
      setCompanySaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-8 md:px-8">
      {cabinetError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{cabinetError}</div>
      ) : null}
      {cabinetLoading ? (
        <p className="text-sm text-slate-500">Загрузка данных из базы…</p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-slate-500">Кабинет партнера</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{companyName || "Новая компания"}</h1>
        {companyCity.trim() || companyAddress.trim() ? (
          <p className="mt-2 text-sm text-slate-600">
            {[companyCity.trim(), companyAddress.trim()].filter(Boolean).join(" · ")}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Заполните данные компании и создавайте брифы с QR.</p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Точек</p>
          <p className="mt-2 text-3xl font-bold">{locations}</p>
        </article>
        <article className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Пользователей прошли брифы</p>
          <p className="mt-2 text-3xl font-bold">{registeredUsers}</p>
          <p className="mt-1 text-[11px] text-slate-500">Уникальные аккаунты с хотя бы одним ответом по вашим брифам</p>
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
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Город"
            value={companyCity}
            onChange={(e) => setCompanyCity(e.target.value)}
          />
          <input
            className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Адрес компании (юридический или для гостей)"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Данные подгружаются из аккаунта после входа. Нажмите «Сохранить в базу», чтобы они отображались у пользователей
          на сайте.
        </p>
        <button
          type="button"
          disabled={companySaving || !companyName.trim()}
          onClick={() => void saveCompanyProfileToServer()}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {companySaving ? "Сохранение…" : "Сохранить компанию в базу"}
        </button>
        {companyNotice ? (
          <p
            className={`mt-2 rounded-lg p-2 text-xs ${
              companyNotice.includes("Не удалось") || companyNotice.includes("Сеть")
                ? "bg-rose-50 text-rose-900"
                : "bg-emerald-50 text-emerald-900"
            }`}
          >
            {companyNotice}
          </p>
        ) : null}
      </section>

      <section className="card">
        <h2 className="h2">{editingBriefId ? "Редактирование брифа" : "Конструктор брифа"}</h2>
        {editingBriefId && (
          <p className="mb-3 text-xs text-amber-800">
            Вы меняете бриф <strong>{editingBriefId}</strong>. После сохранения ссылка останется той же, QR пересоздастся.
          </p>
        )}
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveBrief()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {editingBriefId ? "Сохранить изменения и обновить QR" : "Сохранить бриф и сгенерировать QR"}
            </button>
            {editingBriefId && (
              <button type="button" onClick={resetConstructor} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">
                Отменить редактирование
              </button>
            )}
          </div>
          {message && <p className="text-xs text-violet-700">{message}</p>}
        </div>
      </section>

      <section className="card">
        <h2 className="h2">Статистика ответов по брифам</h2>
        <p className="mb-4 text-sm text-slate-600">
          Счётчики из базы: каждое прохождение брифа пользователем увеличивает столбец.
        </p>
        {briefs.length === 0 ? (
          <p className="text-sm text-slate-500">Создайте бриф — здесь появится диаграмма.</p>
        ) : (
          <div className="space-y-3">
            {briefs.map((b) => {
              const n = responseCounts[b.id] ?? 0;
              const pct = (n / maxResponses) * 100;
              return (
                <div key={b.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="max-w-[60%] truncate font-medium text-slate-800">{b.title}</span>
                    <span>{n} отв.</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-violet-500 to-sky-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="h2">Призы на витрину</h2>
        <p className="mb-4 text-sm text-slate-600">
          Призы сохраняются в базе и видны пользователям в витрине. Можно загрузить фото с устройства (data URL) или указать
          ссылку на картинку.
        </p>
        <form onSubmit={(e) => void submitPartnerPrize(e)} className="space-y-3 rounded-xl border border-dashed border-violet-200 bg-violet-50/30 p-4 text-sm">
          {editingPrizeId && (
            <p className="text-xs text-amber-800">
              Редактирование приза <strong>{editingPrizeId}</strong>. Сохраните изменения или отмените.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-slate-600">Название</span>
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={prizeForm.title}
                onChange={(e) => setPrizeForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Например: Кофе в подарок"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-slate-600">Краткое описание подарка</span>
              <textarea
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                rows={2}
                value={prizeForm.description}
                onChange={(e) => setPrizeForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-slate-600">Сроки акции (для гостя)</span>
              <textarea
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                rows={2}
                value={prizeForm.giftTerms}
                onChange={(e) => setPrizeForm((f) => ({ ...f, giftTerms: e.target.value }))}
                placeholder="Например: действует по будням до 31.12.2026"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-slate-600">Условия получения подарка</span>
              <textarea
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                rows={2}
                value={prizeForm.giftConditions}
                onChange={(e) => setPrizeForm((f) => ({ ...f, giftConditions: e.target.value }))}
                placeholder="Например: один раз на пользователя, не суммируется с другими акциями"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-slate-600">Фото приза с устройства</span>
              <input
                type="file"
                accept="image/*"
                className="mt-1 w-full text-xs"
                onChange={(e) => onPrizeImageFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-slate-600">Или URL картинки</span>
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={prizeForm.imageUrl}
                onChange={(e) => setPrizeForm((f) => ({ ...f, imageUrl: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-slate-600">Баллы</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={prizeForm.pointsCost}
                onChange={(e) => setPrizeForm((f) => ({ ...f, pointsCost: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-slate-600">Тираж (всего)</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={prizeForm.totalStock}
                onChange={(e) => setPrizeForm((f) => ({ ...f, totalStock: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-slate-600">Остаток (доступно сейчас)</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={prizeForm.stockLeft}
                onChange={(e) => setPrizeForm((f) => ({ ...f, stockLeft: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-slate-600">Старт</span>
              <input
                type="date"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={prizeForm.startsAt}
                onChange={(e) => setPrizeForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-slate-600">Конец</span>
              <input
                type="date"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={prizeForm.endsAt}
                onChange={(e) => setPrizeForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              {editingPrizeId ? "Сохранить приз" : "Добавить приз"}
            </button>
            {editingPrizeId && (
              <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={resetPrizeForm}>
                Отменить редактирование
              </button>
            )}
          </div>
        </form>

        {partnerRewards.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {partnerRewards.map((r) => (
              <article key={r.id} className="flex gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.imageUrl} alt="" className="h-20 w-24 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{r.title}</p>
                  <p className="text-xs text-violet-700">
                    {r.pointsCost} б. · остаток {r.stockLeft}/{r.totalStock}
                  </p>
                  {r.termsText ? (
                    <p className="mt-1 text-xs text-slate-600">
                      <span className="font-semibold">Сроки: </span>
                      {r.termsText}
                    </p>
                  ) : null}
                  {r.rulesText ? (
                    <p className="mt-1 text-xs text-slate-600">
                      <span className="font-semibold">Условия: </span>
                      {r.rulesText}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-violet-700"
                      onClick={() => startEditPrize(r)}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-600"
                      onClick={() => void removePartnerPrize(r.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="h2">Ваши брифы и QR</h2>
        <p className="mb-3 text-sm text-slate-600">
          Нажмите на бриф в списке — откроется карточка, автоматически сгенерируется QR-код (если его ещё нет). Оттуда же
          можно скачать PNG, открыть ссылку и отредактировать вопросы.
        </p>
        <div className="space-y-2 text-sm">
          {briefs.length === 0 ? (
            <p className="text-slate-500">Пока нет брифов. Создайте первый бриф выше.</p>
          ) : (
            briefs.map((b) => {
              const open = expandedBriefId === b.id;
              return (
                <div key={b.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100"
                    onClick={() => setExpandedBriefId((id) => (id === b.id ? null : b.id))}
                  >
                    <span>
                      <strong className="text-slate-900">{b.title}</strong>
                      <span className="ml-2 text-xs text-slate-500">
                        {b.questions.length} вопр. · {b.pointsForComplete} б.
                      </span>
                    </span>
                    <span className="shrink-0 text-slate-400">{open ? "▼" : "▶"}</span>
                  </button>
                  {open && (
                    <div className="border-t border-slate-200 p-4">
                      <p className="break-all rounded bg-slate-100 px-2 py-1.5 font-mono text-[11px] text-slate-700">{b.qrCode}</p>
                      <div className="mt-4 flex flex-wrap items-start gap-4">
                        {b.qrDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.qrDataUrl} alt="" className="h-44 w-44 rounded-lg border border-slate-200 bg-white p-1" />
                        ) : (
                          <div className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2 text-center text-xs text-slate-600">
                            {qrBusyId === b.id ? (
                              <span>Генерация QR…</span>
                            ) : (
                              <>
                                <span>QR ещё не готов</span>
                                <button
                                  type="button"
                                  className="rounded-lg bg-slate-900 px-2 py-1.5 font-semibold text-white"
                                  onClick={() => void regenerateQr(b.id)}
                                >
                                  Сгенерировать QR
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        <div className="flex min-w-[200px] flex-1 flex-col gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                            disabled={!b.qrDataUrl}
                            onClick={() => b.qrDataUrl && downloadDataUrl(b.qrDataUrl, `qr-${b.id}.png`)}
                          >
                            Скачать QR (PNG)
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                            disabled={!b.qrDataUrl}
                            onClick={() => b.qrDataUrl && window.open(b.qrDataUrl, "_blank", "noopener,noreferrer")}
                          >
                            Открыть QR-картинку
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900"
                            disabled={qrBusyId === b.id}
                            onClick={() => void regenerateQr(b.id)}
                          >
                            {qrBusyId === b.id ? "Обновление…" : "Пересоздать QR"}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                            onClick={() => window.open(b.qrCode, "_blank", "noopener,noreferrer")}
                          >
                            Открыть страницу брифа
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900"
                            onClick={() =>
                              speakUrlAloud(b.qrCode, () =>
                                setMessage("Озвучивание ссылки недоступно в этом браузере."),
                              )
                            }
                          >
                            Произнести ссылку вслух
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
                            onClick={() => startEditBrief(b)}
                          >
                            Редактировать вопросы
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
