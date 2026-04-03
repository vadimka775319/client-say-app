"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  briefs,
  computeBriefPoints,
  economyRules,
  partners,
  Reward,
  rewardStatus,
  users,
  userFullName,
} from "@/lib/mock-data";
import { rewards as allRewards } from "@/lib/mock-data";

function makeRedemptionCode(rewardId: string) {
  const part = rewardId.replace(/\W/g, "").toUpperCase().slice(-4).padStart(4, "0");
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `CS-${part}-${rnd}`;
}

function readStoredUserProfile(base: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  points: number;
}) {
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem("clientsay_user_profile");
    if (!raw) return base;
    const p = JSON.parse(raw) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      points?: number;
    };
    return {
      firstName: p.firstName ?? base.firstName,
      lastName: p.lastName ?? base.lastName,
      email: p.email ?? base.email,
      phone: p.phone ?? base.phone,
      points: typeof p.points === "number" ? p.points : base.points,
    };
  } catch {
    return base;
  }
}

export function UserCabinet() {
  const [user] = useState(users[0]);
  const [initialProfile] = useState(() =>
    readStoredUserProfile({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      points: user.points,
    }),
  );
  const [firstName, setFirstName] = useState(initialProfile.firstName);
  const [lastName, setLastName] = useState(initialProfile.lastName);
  const [email, setEmail] = useState(initialProfile.email);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [points, setPoints] = useState(initialProfile.points);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [redeemOpen, setRedeemOpen] = useState<Reward | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  const sortedRewards = useMemo(() => {
    return [...allRewards].sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
  }, []);

  function saveProfile() {
    localStorage.setItem(
      "clientsay_user_profile",
      JSON.stringify({ firstName, lastName, email, phone, points }),
    );
    setResetMsg("Профиль сохранен.");
  }

  function requestPasswordReset() {
    setResetMsg(
      "Запрос отправлен. Супер-админ увидит заявку и выдаст новый пароль (или ссылку). Самостоятельно удалить пароль из системы нельзя — только через администратора.",
    );
  }

  function startRedeem(r: Reward) {
    setIssuedCode(null);
    setRedeemOpen(r);
  }

  function confirmRedeem() {
    if (!redeemOpen) return;
    if (points < redeemOpen.pointsCost) return;
    setPoints((p) => p - redeemOpen.pointsCost);
    setIssuedCode(makeRedemptionCode(redeemOpen.id));
  }

  function closeModal() {
    setRedeemOpen(null);
    setIssuedCode(null);
  }

  return (
    <>
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/40 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Ваш аккаунт</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">Баллы, профиль и призы</h1>
        <p className="mt-2 text-sm text-slate-600">
          Заполните профиль, копите баллы за брифы и обменивайте на призы. Чтобы получить подарок в точке, покажите{" "}
          <strong>код подтверждения</strong> сотруднику — одних баллов на экране недостаточно.
        </p>
        <p className="mt-3 rounded-lg bg-slate-100/80 p-3 text-xs text-slate-600">
          Обычно гость просто сканирует QR камерой — открывается бриф. После ответов показываем начисление баллов и
          предлагаем зарегистрироваться (имя, телефон или email, пароль). Если человек уже вошёл в аккаунт, баллы сразу
          падают на его баланс. Отдельная кнопка «Сканировать QR» в кабинете не обязательна — это опционально для
          повторных визитов.
        </p>
      </section>

      <QrFlowDemo points={points} setPoints={setPoints} />

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
            При регистрации эти поля сохраняются в аккаунте; смена email/телефона может потребовать подтверждения (в
            продакшене).
          </p>
          <button
            type="button"
            onClick={saveProfile}
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Сохранить профиль
          </button>

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
            {resetMsg && <p className="mt-3 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">{resetMsg}</p>}
          </div>
        </section>

        <section className="card flex flex-col justify-center bg-gradient-to-br from-violet-600 to-sky-600 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Баланс</p>
          <p className="mt-2 text-4xl font-extrabold">{points}</p>
          <p className="text-sm text-white/90">баллов</p>
          <p className="mt-4 text-xs text-white/80">
            {userFullName({ ...user, firstName, lastName, email, phone, points })} · последний бриф:{" "}
            {user.lastBriefAt
              ? new Date(user.lastBriefAt).toLocaleString("ru-RU")
              : "—"}
          </p>
        </section>
      </div>

      <section className="card">
        <h2 className="h2">Призы за баллы</h2>
        <p className="mb-4 text-sm text-slate-600">
          Все акции из витрины: срок, остаток, стоимость. После обмена вы получите код — покажите его на кассе или
          администратору.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {sortedRewards.map((reward) => {
            const st = rewardStatus(reward);
            const active = st === "active";
            const can = active && points >= reward.pointsCost;
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
                  <p className="mt-2 flex-1 text-slate-600">{reward.description}</p>
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
                  Списываем <strong>{redeemOpen.pointsCost}</strong> баллов за «{redeemOpen.title}». После подтверждения
                  вы получите код для показа в заведении.
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
                    onClick={confirmRedeem}
                    className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white"
                  >
                    Подтвердить
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-900">Заберите приз</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Покажите этот код сотруднику. Он сверит его в системе партнёра.
                </p>
                <p className="mt-4 rounded-xl bg-slate-900 py-4 text-center font-mono text-2xl font-bold tracking-widest text-white">
                  {issuedCode}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Сохраните скриншот. В продакшене код продублируем в email/SMS.
                </p>
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

function QrFlowDemo({
  points,
  setPoints,
}: {
  points: number;
  setPoints: Dispatch<SetStateAction<number>>;
}) {
  const [partnerId, setPartnerId] = useState(partners[0].id);
  const [stage, setStage] = useState<"pick" | "brief" | "done">("pick");
  const [lastAward, setLastAward] = useState(0);
  const [guestReg, setGuestReg] = useState({ name: "", contact: "", password: "" });
  const brief = briefs.find((b) => b.partnerId === partnerId);
  const pts = brief ? computeBriefPoints(brief.questions.length) : 0;

  function finishBrief() {
    setPoints((p) => p + pts);
    setLastAward(pts);
    setStage("done");
  }

  function resetFlow() {
    if (lastAward > 0) setPoints((p) => p - lastAward);
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
          Выберите заведение, «пройдите» бриф — баллы добавятся к балансу выше. Блок имитирует экран после QR для уже
          вошедшего пользователя; для гостя ниже — форма регистрации после начисления.
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
              onClick={finishBrief}
            >
              Отправить ответы (демо)
            </button>
          </div>
        )}

        {stage === "done" && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="font-semibold text-emerald-900">
              +{lastAward} баллов начислено. Актуальный баланс — в карточке «Баланс» выше ({points} б.).
            </p>
            <p className="text-xs text-slate-600">
              Для нового гостя здесь же: «Зарегистрируйтесь, чтобы сохранить баллы». После регистрации они уже на аккаунте.
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
              onClick={() => alert("В продакшене — создание аккаунта и привязка начисления (демо).")}
            >
              Зарегистрироваться и сохранить баллы (демо)
            </button>
            <button type="button" className="ml-2 text-xs font-semibold text-violet-700" onClick={resetFlow}>
              Сбросить сценарий (откатит демо-баллы)
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
