"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  briefs,
  computeBriefPoints,
  economyRules,
  partners,
  Reward,
  rewardStatus,
} from "@/lib/mock-data";
import { incrementBriefResponseCount } from "@/lib/partner-brief-stats";
import { readPartnerUploadedRewards, type PartnerUploadedReward } from "@/lib/partner-uploaded-rewards";
import { ensureRedemptionPool, takePooledRedemptionCode } from "@/lib/redemption-code-pool";
import { decrementStockAfterRedeem, getEffectiveStockLeft } from "@/lib/reward-stock";

function makeRedemptionCode(rewardId: string) {
  const part = rewardId.replace(/\W/g, "").toUpperCase().slice(-4).padStart(4, "0");
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `CS-${part}-${rnd}`;
}

function isLocalOnlyReward(r: Reward) {
  return r.id.startsWith("pr-cabinet-");
}

export function UserCabinet() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [points, setPoints] = useState(0);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [redeemOpen, setRedeemOpen] = useState<Reward | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [partnerRewardsTick, setPartnerRewardsTick] = useState(0);
  const [rewardsVersion, setRewardsVersion] = useState(0);
  const [dbRewards, setDbRewards] = useState<Reward[]>([]);

  useEffect(() => {
    const onPartnerRewards = () => setPartnerRewardsTick((t) => t + 1);
    window.addEventListener("clientsay-partner-rewards-changed", onPartnerRewards);
    return () => window.removeEventListener("clientsay-partner-rewards-changed", onPartnerRewards);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      const [meRes, rwRes] = await Promise.all([
        fetch("/api/me", { cache: "no-store" }),
        fetch("/api/user/rewards", { cache: "no-store" }),
      ]);
      if (cancelled) return;
      if (!meRes.ok) {
        setLoadError("Не удалось загрузить профиль. Обновите страницу или войдите снова.");
        setReady(true);
        return;
      }
      const me = (await meRes.json()) as {
        user: { firstName: string; lastName: string; email: string | null; phone: string | null; points: number };
      };
      setFirstName(me.user.firstName ?? "");
      setLastName(me.user.lastName ?? "");
      setEmail(me.user.email ?? "");
      setPhone(me.user.phone ?? "");
      setPoints(me.user.points ?? 0);
      if (rwRes.ok) {
        const j = (await rwRes.json()) as { rewards?: Reward[] };
        setDbRewards(Array.isArray(j.rewards) ? j.rewards : []);
      } else {
        setDbRewards([]);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedRewards = useMemo(() => {
    void partnerRewardsTick;
    void rewardsVersion;
    const extra = typeof window !== "undefined" ? readPartnerUploadedRewards() : [];
    const dbIds = new Set(dbRewards.map((r) => r.id));
    const lsOnly = extra.filter((r) => !dbIds.has(r.id));
    const merged: Reward[] = [
      ...dbRewards,
      ...lsOnly.map((r) => ({ ...r, stockLeft: getEffectiveStockLeft(r) })),
    ];
    return merged.sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
  }, [dbRewards, partnerRewardsTick, rewardsVersion]);

  async function saveProfile() {
    setProfileSaving(true);
    setProfileNotice(null);
    setPasswordNotice(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });
      const data = (await res.json()) as { error?: { message?: string }; user?: { email: string | null; phone: string | null } };
      if (!res.ok) {
        setProfileNotice(data?.error?.message ?? "Не удалось сохранить.");
        return;
      }
      if (data.user) {
        setEmail(data.user.email ?? "");
        setPhone(data.user.phone ?? "");
      }
      setProfileNotice("Профиль сохранён в аккаунте.");
    } catch {
      setProfileNotice("Сеть недоступна. Попробуйте снова.");
    } finally {
      setProfileSaving(false);
    }
  }

  function requestPasswordReset() {
    setPasswordNotice(
      "Запрос отправлен. Супер-админ увидит заявку и выдаст новый пароль (или ссылку). Самостоятельно удалить пароль из системы нельзя — только через администратора.",
    );
  }

  function startRedeem(r: Reward) {
    setIssuedCode(null);
    setRedeemOpen(r);
  }

  async function confirmRedeem() {
    if (!redeemOpen) return;
    if (points < redeemOpen.pointsCost) return;
    setRedeemBusy(true);
    try {
      if (isLocalOnlyReward(redeemOpen)) {
        const stock = getEffectiveStockLeft(redeemOpen);
        if (stock <= 0) return;
        ensureRedemptionPool(redeemOpen.id, stock);
        const code = takePooledRedemptionCode(redeemOpen.id) ?? makeRedemptionCode(redeemOpen.id);
        setPoints((p) => p - redeemOpen.pointsCost);
        decrementStockAfterRedeem(redeemOpen);
        setIssuedCode(code);
        setRewardsVersion((v) => v + 1);
        return;
      }

      const res = await fetch("/api/user/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: redeemOpen.id }),
      });
      const data = (await res.json()) as { code?: string; error?: { message?: string }; points?: number };
      if (!res.ok) {
        setProfileNotice(data?.error?.message ?? "Обмен не выполнен.");
        return;
      }
      if (data.points != null) setPoints(data.points);
      if (data.code) setIssuedCode(data.code);
      setRewardsVersion((v) => v + 1);
      const rw = await fetch("/api/user/rewards", { cache: "no-store" });
      if (rw.ok) {
        const j = (await rw.json()) as { rewards?: Reward[] };
        setDbRewards(Array.isArray(j.rewards) ? j.rewards : []);
      }
    } catch {
      setProfileNotice("Сеть недоступна при обмене.");
    } finally {
      setRedeemBusy(false);
    }
  }

  function closeModal() {
    setRedeemOpen(null);
    setIssuedCode(null);
  }

  const awardDemoPoints = useCallback(async (delta: number) => {
    const res = await fetch("/api/user/demo-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta }),
    });
    if (!res.ok) return;
    const j = (await res.json()) as { points?: number };
    if (typeof j.points === "number") setPoints(j.points);
  }, []);

  if (!ready) {
    return (
      <section className="card text-center text-sm text-slate-600">
        Загрузка кабинета…
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="card border-rose-200 bg-rose-50 text-sm text-rose-900">
        {loadError}
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/40 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Ваш аккаунт</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">Баллы, профиль и призы</h1>
        <p className="mt-2 text-sm text-slate-600">
          Данные подтягиваются из вашего аккаунта после входа. «Сохранить профиль» записывает имя и контакты в базу.
          Баллы и обмен призов тоже на сервере.
        </p>
      </section>

      <QrFlowDemo points={points} awardDemoPoints={awardDemoPoints} />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="h2">Профиль</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-600">Имя</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Фамилия</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-600">Email</span>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-600">Телефон</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Email и телефон должны быть уникальными в системе. Пустой email допустим, если входите по телефону.
          </p>
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={profileSaving}
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {profileSaving ? "Сохранение…" : "Сохранить профиль"}
          </button>
          {profileNotice && (
            <p
              className={`mt-3 rounded-lg p-3 text-sm ${
                profileNotice.includes("Не удалось") || profileNotice.includes("Сеть")
                  ? "border border-rose-200 bg-rose-50 text-rose-900"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              {profileNotice}
            </p>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-bold text-slate-900">Пароль</h3>
            <p className="mt-1 text-sm text-slate-600">
              Пароль не сбрасывается автоматически: нажмите кнопку — супер-админ обработает запрос и выдаст новый доступ.
            </p>
            <button
              type="button"
              onClick={requestPasswordReset}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Запросить сброс пароля
            </button>
            {passwordNotice && <p className="mt-3 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">{passwordNotice}</p>}
          </div>
        </section>

        <section className="flex min-h-[280px] flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-[1.1rem] text-white shadow-lg">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Сводка аккаунта</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Имя</dt>
                <dd className="mt-0.5 font-semibold text-white">{firstName.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Фамилия</dt>
                <dd className="mt-0.5 font-semibold text-white">{lastName.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Email</dt>
                <dd className="mt-0.5 break-all font-medium text-white">{email?.trim() ? email : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Телефон</dt>
                <dd className="mt-0.5 text-slate-100">{phone?.trim() ? phone : "—"}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-6 border-t border-slate-700 pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Активные баллы</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-white">{points}</p>
            <p className="text-sm text-slate-300">баллов на счёте (из базы)</p>
          </div>
        </section>
      </div>

      <PartnerDirectoryForUser />

      <section className="card">
        <h2 className="h2">Призы за баллы</h2>
        <p className="mb-4 text-sm text-slate-600">
          Акции из базы и локальные призы партнёра (этот браузер). Обмен с серверными призами выдаёт уникальный код в базе.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {sortedRewards.map((reward) => {
            const st = rewardStatus(reward);
            const active = st === "active";
            const can = active && points >= reward.pointsCost;
            const extra = reward as PartnerUploadedReward;
            return (
              <article
                key={reward.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reward.imageUrl} alt="" className="h-40 w-full object-cover" />
                <div className="flex flex-1 flex-col p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-slate-900">{reward.title}</strong>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">
                      {reward.pointsCost} б.
                    </span>
                  </div>
                  <p className="mt-2 flex-1 whitespace-pre-line text-slate-600">{reward.description}</p>
                  {extra.giftTerms ? (
                    <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                      <span className="font-semibold text-slate-800">Сроки акции: </span>
                      {extra.giftTerms}
                    </p>
                  ) : null}
                  {extra.giftConditions ? (
                    <p className="mt-2 rounded-lg bg-violet-50/80 p-2 text-xs text-slate-700">
                      <span className="font-semibold text-violet-900">Условия подарка: </span>
                      {extra.giftConditions}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    Осталось: <strong>{reward.stockLeft}</strong> из {reward.totalStock} · до{" "}
                    {new Date(reward.endsAt).toLocaleDateString("ru-RU")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Старт акции: {new Date(reward.startsAt).toLocaleDateString("ru-RU")}
                  </p>
                  <button
                    type="button"
                    disabled={!can}
                    onClick={() => startRedeem(reward)}
                    className="mt-3 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {!active ? (st === "upcoming" ? "Скоро" : "Недоступно") : can ? "Обменять баллы" : "Не хватает баллов"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="h2">Правила</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Один и тот же пользователь не проходит бриф у одной компании чаще, чем раз в{" "}
            {economyRules.minDaysBetweenSamePartnerBrief} дней.
          </li>
          <li>
            До 10 вопросов в брифе — {economyRules.pointsBriefUpTo10Questions} б.; 11–20 вопросов —{" "}
            {economyRules.pointsBrief11To20Questions} б.
          </li>
          <li>Баллы начисляются только после полного прохождения брифа и привязки к аккаунту (или сразу, если уже вошли).</li>
          <li>Выдача приза — по коду подтверждения после обмена баллов.</li>
        </ul>
      </section>

      {redeemOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            {!issuedCode ? (
              <>
                <h3 className="text-lg font-bold text-slate-900">Подтвердить обмен</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Списываем <strong>{redeemOpen.pointsCost}</strong> баллов за «{redeemOpen.title}». Вы получите{" "}
                  <strong>одноразовый код</strong> для показа в заведении.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={redeemBusy}
                    onClick={() => void confirmRedeem()}
                    className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {redeemBusy ? "…" : "Подтвердить"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-900">Заберите приз</h3>
                <p className="mt-2 text-sm text-slate-600">Покажите этот код сотруднику.</p>
                <p className="mt-4 rounded-xl bg-slate-900 py-4 text-center font-mono text-2xl font-bold tracking-widest text-white">
                  {issuedCode}
                </p>
                <p className="mt-3 text-xs text-slate-500">Сохраните скриншот. Код уникален для этой выдачи.</p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white"
                >
                  Закрыть
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

type PublicPartnerRow = {
  id: string;
  companyName: string;
  city: string;
  addressLine: string;
  locations: number;
};

function PartnerDirectoryForUser() {
  const [dbList, setDbList] = useState<PublicPartnerRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/partners/public", { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const j = (await res.json()) as { partners?: PublicPartnerRow[] };
      if (Array.isArray(j.partners)) setDbList(j.partners);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card">
      <h2 className="h2">Где оставить бриф</h2>
      <p className="mb-4 text-sm text-slate-600">
        Партнёры из базы и демо-справочник. Пройти бриф можно <strong>в точке</strong> — там QR. В кабинете QR{" "}
        <strong>не открывается</strong>.
      </p>
      <ul className="space-y-4">
        {dbList.map((p) => (
          <li key={p.id} className="rounded-xl border border-violet-200 bg-violet-50/30 p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong className="text-slate-900">{p.companyName}</strong>
              {p.city ? <span className="text-xs font-medium text-violet-800">{p.city}</span> : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">{p.locations} точек</p>
            {p.addressLine ? <p className="mt-2 text-slate-700">{p.addressLine}</p> : null}
          </li>
        ))}
        {partners.map((p) => (
          <li key={`mock-${p.id}`} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong className="text-slate-900">{p.brandName}</strong>
              {p.city ? <span className="text-xs font-medium text-violet-800">{p.city}</span> : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">{p.locations} точек (демо)</p>
            {p.addressHint ? <p className="mt-2 text-slate-700">{p.addressHint}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function QrFlowDemo({
  points,
  awardDemoPoints,
}: {
  points: number;
  awardDemoPoints: (delta: number) => Promise<void>;
}) {
  const [partnerId, setPartnerId] = useState(partners[0].id);
  const [stage, setStage] = useState<"pick" | "brief" | "done">("pick");
  const [lastAward, setLastAward] = useState(0);
  const [guestReg, setGuestReg] = useState({ name: "", contact: "", password: "" });
  const brief = briefs.find((b) => b.partnerId === partnerId);
  const pts = brief ? computeBriefPoints(brief.questions.length) : 0;

  async function finishBrief() {
    if (brief) incrementBriefResponseCount(brief.id);
    await awardDemoPoints(pts);
    setLastAward(pts);
    setStage("done");
  }

  async function resetFlow() {
    if (lastAward > 0) await awardDemoPoints(-lastAward);
    setLastAward(0);
    setStage("pick");
  }

  return (
    <details className="card border-dashed border-violet-200 bg-violet-50/20">
      <summary className="cursor-pointer text-sm font-semibold text-violet-900">
        Демо: сканирование QR → бриф → баллы → регистрация гостя
      </summary>
      <div className="mt-4 space-y-4 text-sm text-slate-700">
        <p className="text-xs text-slate-600">
          Баллы начисляются на ваш аккаунт в базе (запрос к серверу). Сброс сценария откатывает последнее демо-начисление.
        </p>
        <label className="block text-xs font-medium">
          Заведение
          <select
            className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-2 py-2"
            value={partnerId}
            onChange={(e) => {
              setPartnerId(e.target.value);
              setStage("pick");
            }}
            disabled={stage !== "pick" && stage !== "brief"}
          >
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </label>

        {stage === "pick" && (
          <button
            type="button"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => setStage("brief")}
          >
            Открыть бриф (как после скана QR)
          </button>
        )}

        {stage === "brief" && brief && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-bold text-slate-900">{brief.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              За прохождение начислим <strong>{pts}</strong> б. (по числу вопросов).
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
              {brief.questions.map((q) => (
                <li key={q.id}>
                  {q.prompt}
                  <span className="block text-xs text-slate-400">
                    {q.type === "text" ? "текстовый ответ" : q.type === "rating" ? "шкала 1–5" : `выбор: ${(q.options ?? []).join(", ")}`}
                  </span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void finishBrief()}
            >
              Отправить ответы (демо)
            </button>
          </div>
        )}

        {stage === "done" && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="font-semibold text-emerald-900">
              +{lastAward} баллов начислено. Баланс в карточке справа и в базе: <strong>{points}</strong> б.
            </p>
            <p className="text-xs text-slate-600">
              Для нового гостя: регистрация на главной /sign-in?role=USER.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="rounded border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="Имя"
                value={guestReg.name}
                onChange={(e) => setGuestReg((g) => ({ ...g, name: e.target.value }))}
              />
              <input
                className="rounded border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="Телефон или email"
                value={guestReg.contact}
                onChange={(e) => setGuestReg((g) => ({ ...g, contact: e.target.value }))}
              />
              <input
                type="password"
                className="rounded border border-slate-200 px-2 py-1.5 text-sm sm:col-span-2"
                placeholder="Пароль"
                value={guestReg.password}
                onChange={(e) => setGuestReg((g) => ({ ...g, password: e.target.value }))}
              />
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
              onClick={() => alert("Регистрация — через форму на странице входа (роль «пользователь»).")}
            >
              Зарегистрироваться и сохранить баллы (демо)
            </button>
            <button type="button" className="ml-2 text-xs font-semibold text-violet-700" onClick={() => void resetFlow()}>
              Сбросить сценарий (откат демо-баллов на сервере)
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
