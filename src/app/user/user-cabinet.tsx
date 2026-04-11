"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { economyRules, Reward, rewardStatus } from "@/lib/mock-data";
import type { PartnerUploadedReward } from "@/lib/partner-uploaded-rewards";

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
  const [rewardsVersion, setRewardsVersion] = useState(0);
  const [dbRewards, setDbRewards] = useState<Reward[]>([]);
  const [city, setCity] = useState("");
  const [briefsCompleted, setBriefsCompleted] = useState(0);

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
        if (meRes.status === 401 && typeof window !== "undefined") {
          window.location.assign("/sign-in?role=USER&next=/user");
          return;
        }
        setLoadError("Не удалось загрузить профиль. Обновите страницу или войдите снова.");
        setReady(true);
        return;
      }
      const me = (await meRes.json()) as {
        user: {
          firstName: string;
          lastName: string;
          email: string | null;
          phone: string | null;
          points: number;
          city?: string;
        };
        stats?: { briefsCompleted: number };
      };
      setFirstName(me.user.firstName ?? "");
      setLastName(me.user.lastName ?? "");
      setEmail(me.user.email ?? "");
      setPhone(me.user.phone ?? "");
      setCity(me.user.city ?? "");
      setPoints(me.user.points ?? 0);
      setBriefsCompleted(me.stats?.briefsCompleted ?? 0);
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
    void rewardsVersion;
    return [...dbRewards].sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
  }, [dbRewards, rewardsVersion]);

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
          city: city.trim(),
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

  if (!ready) {
    return (
      <section className="cabinet-surface text-center text-sm text-slate-600">
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

      <HowToBriefWithQr userCity={city} />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="cabinet-surface lg:col-span-2">
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
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-600">Ваш город (для списка партнёров региона)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Например: Москва"
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
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Прогресс</p>
            <p className="mt-4 text-xs text-slate-400">Пройдено брифов</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-white">{briefsCompleted}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Каждое завершённое прохождение брифа у партнёра увеличивает счётчик.
            </p>
          </div>
          <div className="mt-6 border-t border-slate-700 pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Баллы на счёте</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-white">{points}</p>
            <p className="text-sm text-slate-300">начисляются после отправки брифа</p>
          </div>
        </section>
      </div>

      <PartnerDirectoryForUser regionCity={city} />

      <section className="cabinet-surface">
        <h2 className="h2">Призы за баллы</h2>
        <p className="mb-4 text-sm text-slate-600">
          Все призы из базы: акции платформы и акции партнёров. Обмен списывает баллы и выдаёт одноразовый код.
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

type PublicBriefLink = { id: string; title: string };
type PublicPartnerRow = {
  id: string;
  companyName: string;
  city: string;
  addressLine: string;
  locations: number;
  briefCount?: number;
  briefs?: PublicBriefLink[];
};

function HowToBriefWithQr({ userCity }: { userCity: string }) {
  return (
    <section className="card border-violet-200 bg-violet-50/20">
      <h2 className="h2">Как получить баллы</h2>
      <p className="text-sm text-slate-600">
        В заведении отсканируйте QR-код брифа (его размещает партнёр). Откроется страница с вопросами: войдите как
        пользователь, ответьте и отправьте форму — баллы зачислятся на счёт. У одной компании повторное прохождение возможно
        не чаще чем раз в 30 дней.
      </p>
      {userCity.trim() ? (
        <p className="mt-3 text-xs text-slate-500">
          Ниже в списке партнёров показан регион «<strong>{userCity.trim()}</strong>». Изменить можно в поле «Ваш город» в
          профиле.
        </p>
      ) : (
        <p className="mt-3 text-xs text-amber-900">
          Укажите город в профиле — список партнёров отфильтруется по региону. Пока город пустой, показываются все партнёры
          из базы.
        </p>
      )}
    </section>
  );
}

function PartnerDirectoryForUser({ regionCity }: { regionCity: string }) {
  const [dbList, setDbList] = useState<PublicPartnerRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = regionCity.trim() ? `?city=${encodeURIComponent(regionCity.trim())}` : "";
      const res = await fetch(`/api/partners/public${q}`, { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const j = (await res.json()) as { partners?: PublicPartnerRow[] };
      if (Array.isArray(j.partners)) setDbList(j.partners);
    })();
    return () => {
      cancelled = true;
    };
  }, [regionCity]);

  return (
    <section className="card">
      <h2 className="h2">Партнёры и брифы</h2>
      <p className="mb-4 text-sm text-slate-600">
        Пройти бриф и получить баллы можно по ссылке или QR в точке. Ниже — активные брифы из базы (если партнёр их создал).
      </p>
      <ul className="space-y-4">
        {dbList.length === 0 ? (
          <li className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
            {regionCity.trim()
              ? `Пока нет партнёров в базе с городом «${regionCity.trim()}». Проверьте написание или очистите поле города.`
              : "Пока нет партнёров в базе."}
          </li>
        ) : (
          dbList.map((p) => (
            <li key={p.id} className="rounded-xl border border-violet-200 bg-violet-50/30 p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="text-slate-900">{p.companyName}</strong>
                {p.city ? <span className="text-xs font-medium text-violet-800">{p.city}</span> : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {p.locations} точек
                {typeof p.briefCount === "number" ? ` · брифов: ${p.briefCount}` : null}
              </p>
              {p.addressLine ? <p className="mt-2 text-slate-700">{p.addressLine}</p> : null}
              {p.briefs && p.briefs.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-violet-200/60 pt-3 text-xs">
                  {p.briefs.map((b) => (
                    <li key={b.id}>
                      <Link href={`/brief/${b.id}`} className="font-semibold text-violet-700 underline">
                        {b.title}
                      </Link>
                      <span className="text-slate-500"> — открыть бриф (с телефона удобнее по QR в заведении)</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">У компании пока нет опубликованных брифов в базе.</p>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
