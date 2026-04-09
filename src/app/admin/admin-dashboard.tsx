"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  economyRules,
  globalReviewStats,
  partnerLabel,
  partners as partnersSeed,
  reviewRecords,
  rewards as rewardsSeed,
  type Partner,
  type Reward,
  users as usersSeed,
  type UserProfile,
  userFullName,
} from "@/lib/mock-data";
import { BRAND_NAME } from "@/lib/brand";
import {
  computeLandingStats,
  defaultSiteSettings,
  SITE_SETTINGS_KEY,
  type SiteSettings,
} from "@/lib/site-settings";

export function AdminDashboard() {
  const [partnerList, setPartnerList] = useState<Partner[]>(() =>
    JSON.parse(JSON.stringify(partnersSeed)) as Partner[],
  );
  const [userList, setUserList] = useState<UserProfile[]>(() =>
    JSON.parse(JSON.stringify(usersSeed)) as UserProfile[],
  );
  const [rewardList, setRewardList] = useState<Reward[]>(() =>
    JSON.parse(JSON.stringify(rewardsSeed)) as Reward[],
  );
  const [userPasswords, setUserPasswords] = useState<Record<string, string>>({
    "u-1": "",
    "u-2": "",
  });
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    if (typeof window === "undefined") return defaultSiteSettings;
    try {
      const raw = window.localStorage.getItem(SITE_SETTINGS_KEY);
      if (!raw) return defaultSiteSettings;
      const parsed = JSON.parse(raw) as Partial<SiteSettings>;
      return {
        ...defaultSiteSettings,
        basePartners: typeof parsed.basePartners === "number" ? parsed.basePartners : defaultSiteSettings.basePartners,
        usersPerPartner:
          typeof parsed.usersPerPartner === "number" ? parsed.usersPerPartner : defaultSiteSettings.usersPerPartner,
        baseRewards: typeof parsed.baseRewards === "number" ? parsed.baseRewards : defaultSiteSettings.baseRewards,
      };
    } catch {
      return defaultSiteSettings;
    }
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site/public", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || cancelled) return;
        setSiteSettings((s) => ({
          ...s,
          logoUrl: d.logoUrl ?? "",
          brandLine: d.brandLine,
          emailInfo: d.emailInfo,
          phoneDisplay: d.phoneDisplay,
          phoneTel: d.phoneTel,
          schedule: d.schedule,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPoints = userList.reduce((acc, user) => acc + user.points, 0);
  const landingStats = computeLandingStats(
    siteSettings,
    partnerList.length,
    userList.length,
    rewardList.length,
  );

  const trend = useMemo(
    () => [
      { label: "Пн", v: 42 },
      { label: "Вт", v: 58 },
      { label: "Ср", v: 51 },
      { label: "Чт", v: 67 },
      { label: "Пт", v: 73 },
      { label: "Сб", v: 89 },
      { label: "Вс", v: 64 },
    ],
    [],
  );
  const maxV = Math.max(...trend.map((t) => t.v), 1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      basePartners: siteSettings.basePartners,
      usersPerPartner: siteSettings.usersPerPartner,
      baseRewards: siteSettings.baseRewards,
    };
    window.localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(payload));
  }, [siteSettings.basePartners, siteSettings.usersPerPartner, siteSettings.baseRewards]);

  return (
    <>
      <section className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-sm">
        <p className="font-semibold text-amber-900">Как устроен супер-админ в коде</p>
        <p className="mt-2 leading-relaxed">
          Роль <strong>SUPER_ADMIN</strong> создаётся только через <code className="rounded bg-white/80 px-1">db:seed</code>{" "}
          (публичной регистрации нет). Ниже — демо-таблицы в браузере (mock + localStorage), они{" "}
          <strong>не заменяют</strong> реальных партнёров и пользователей в PostgreSQL. Контакты и тексты в футере главной,
          которые сохраняются в базе, правятся через блок настроек сайта (запросы к{" "}
          <code className="rounded bg-white/80 px-1">/api/site/public</code>).
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Возможности супер-администратора</h2>
        <ul className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
          <li>Видеть всех партнёров, править данные и наблюдать активность (демо-показатели).</li>
          <li>Полностью управлять витриной призов: загрузка, правка, удаление; призы с бюджета платформы и партнёров.</li>
          <li>Список пользователей: имя, фамилия, email, телефон, баллы; задать новый пароль при запросе сброса.</li>
          <li>Глобальная аналитика, отзывы с раскрытием всех ответов брифа.</li>
        </ul>
      </section>

      <section className="card border-emerald-100 bg-emerald-50/40">
        <h2 className="h2">Экономика баллов</h2>
        <ul className="space-y-1 text-sm text-slate-700">
          <li>
            До <strong>10 вопросов</strong> в брифе → <strong>{economyRules.pointsBriefUpTo10Questions}</strong> баллов
            за полное прохождение.
          </li>
          <li>
            <strong>11–20 вопросов</strong> → <strong>{economyRules.pointsBrief11To20Questions}</strong> баллов.
          </li>
          <li>
            Один пользователь не проходит бриф у <strong>одной компании</strong> чаще чем раз в{" "}
            <strong>{economyRules.minDaysBetweenSamePartnerBrief}</strong> дней (защита от накруток).
          </li>
        </ul>
      </section>

      <SiteSettingsPanel
        value={siteSettings}
        onChange={setSiteSettings}
        stats={{
          realPartners: partnerList.length,
          realUsers: userList.length,
          realRewards: rewardList.length,
          totalPartners: landingStats.partners,
          totalUsers: landingStats.users,
          totalRewards: landingStats.rewards,
        }}
      />

      <AdminRewardsPanel
        rewards={rewardList}
        partners={partnerList}
        onChange={setRewardList}
      />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Всего отзывов" value={String(globalReviewStats.totalReviews)} />
        <Kpi label="Средний рейтинг" value={globalReviewStats.avgRating.toFixed(2)} />
        <Kpi label="Лайки" value={String(globalReviewStats.totalLikes)} />
        <Kpi label="Комментарии" value={String(globalReviewStats.totalComments)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="card lg:col-span-2">
          <h2 className="h2">Динамика ответов (демо)</h2>
          <p className="mb-4 text-sm text-slate-600">За последние 7 дней — завершённые брифы.</p>
          <div className="flex h-40 items-end gap-2 border-b border-slate-100 pb-1">
            {trend.map((t) => (
              <div key={t.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full max-w-[2.5rem] rounded-t-md bg-gradient-to-t from-violet-600 to-sky-500 transition-all"
                  style={{ height: `${(t.v / maxV) * 100}%`, minHeight: "8px" }}
                  title={`${t.v}`}
                />
                <span className="text-[10px] font-medium text-slate-500">{t.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            За 30 дней: <strong>{globalReviewStats.last30Days}</strong> новых отзывов (демо-агрегат).
          </p>
        </article>
        <article className="card">
          <h2 className="h2">Сводка</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex justify-between">
              <span>Партнёры</span>
              <strong>{partnerList.length}</strong>
            </li>
            <li className="flex justify-between">
              <span>Пользователи</span>
              <strong>{userList.length}</strong>
            </li>
            <li className="flex justify-between">
              <span>Баллы в системе</span>
              <strong>{totalPoints}</strong>
            </li>
            <li className="flex justify-between">
              <span>Призы</span>
              <strong>{rewardList.length}</strong>
            </li>
          </ul>
        </article>
      </section>

      <section className="card">
        <h2 className="h2">Каждый отзыв — все ответы в брифе</h2>
        <p className="mb-4 text-sm text-slate-600">
          Раскройте карточку, чтобы увидеть вопросы и ответы.
        </p>
        <ul className="space-y-2">
          {reviewRecords.map((rev) => (
            <ReviewRow key={rev.id} rev={rev} />
          ))}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="card">
          <h2 className="h2">Партнёры — карточки и правки</h2>
          <div className="space-y-4 text-sm">
            {partnerList.map((partner, idx) => (
              <PartnerAdminCard
                key={partner.id}
                partner={partner}
                onChange={(p) => {
                  setPartnerList((list) => list.map((x, i) => (i === idx ? p : x)));
                }}
              />
            ))}
          </div>
        </article>

        <article className="card">
          <h2 className="h2">Пользователи — профиль и пароль</h2>
          <p className="mb-3 text-xs text-slate-500">
            Когда пользователь нажимает «Запросить сброс», вы задаёте новый пароль здесь (в продакшене — ссылка или
            временный код).
          </p>
          <div className="space-y-4 text-sm">
            {userList.map((user, idx) => (
              <UserAdminCard
                key={user.id}
                user={user}
                passwordDraft={userPasswords[user.id] ?? ""}
                onPasswordChange={(v) => setUserPasswords((m) => ({ ...m, [user.id]: v }))}
                onSavePassword={() => {
                  if (!userPasswords[user.id]?.trim()) return;
                  alert(`Пароль для ${user.email} обновлён (демо).`);
                  setUserPasswords((m) => ({ ...m, [user.id]: "" }));
                }}
                onChange={(u) => setUserList((list) => list.map((x, i) => (i === idx ? u : x)))}
              />
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function SiteSettingsPanel({
  value,
  onChange,
  stats,
}: {
  value: SiteSettings;
  onChange: (value: SiteSettings) => void;
  stats: {
    realPartners: number;
    realUsers: number;
    realRewards: number;
    totalPartners: number;
    totalUsers: number;
    totalRewards: number;
  };
}) {
  const router = useRouter();
  const [savingPublic, setSavingPublic] = useState(false);
  const [publicMsg, setPublicMsg] = useState<string | null>(null);

  async function savePublicContacts() {
    setSavingPublic(true);
    setPublicMsg(null);
    try {
      const r = await fetch("/api/site/public", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: value.logoUrl,
          brandLine: value.brandLine,
          emailInfo: value.emailInfo,
          phoneDisplay: value.phoneDisplay,
          phoneTel: value.phoneTel,
          schedule: value.schedule,
        }),
      });
      if (r.status === 403) {
        setPublicMsg("Нужна сессия супер-админа. Обновите страницу и войдите снова.");
        return;
      }
      if (!r.ok) {
        setPublicMsg("Не удалось сохранить. Проверьте поля и попробуйте снова.");
        return;
      }
      setPublicMsg("Готово: контакты и слоган обновлены на сайте для всех посетителей.");
      router.refresh();
    } catch {
      setPublicMsg("Ошибка сети.");
    } finally {
      setSavingPublic(false);
    }
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Настройки сайта: счётчики и контакты в футере</h2>
      <p className="mt-1 text-sm text-slate-600">
        <strong>Контакты и слоган</strong> хранятся в базе: после правки нажмите «Сохранить на сайт».{" "}
        <strong>Счётчики</strong> на лендинге — демо: база + данные из этой админки, сохраняются в браузере.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm md:col-span-2">
          Логотип сайта (PNG/JPG/SVG, до 1.5 МБ)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 1_500_000) {
                setPublicMsg("Файл слишком большой. Выберите логотип до 1.5 МБ.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                const result = typeof reader.result === "string" ? reader.result : "";
                if (!result.startsWith("data:image/")) {
                  setPublicMsg("Не удалось прочитать файл как изображение.");
                  return;
                }
                onChange({ ...value, logoUrl: result });
                setPublicMsg("Логотип загружен в форму. Нажмите «Сохранить контакты на сайт».");
              };
              reader.onerror = () => setPublicMsg("Не удалось прочитать файл.");
              reader.readAsDataURL(file);
            }}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Файл хранится в базе как Data URL. После загрузки обязательно нажмите «Сохранить контакты на сайт».
          </span>
        </label>
        <div className="rounded-xl border border-slate-200 bg-white p-3 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Предпросмотр логотипа</p>
          {value.logoUrl ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value.logoUrl} alt="Логотип сайта" className="h-12 w-auto max-w-[220px] rounded bg-slate-50 p-1" />
              <button
                type="button"
                className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700"
                onClick={() => onChange({ ...value, logoUrl: "" })}
              >
                Удалить логотип
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Логотип пока не загружен.</p>
          )}
        </div>
        <label className="block text-sm">
          Короткое описание сервиса
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            value={value.brandLine}
            onChange={(e) => onChange({ ...value, brandLine: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Телефон (как видно на сайте)
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            value={value.phoneDisplay}
            onChange={(e) => onChange({ ...value, phoneDisplay: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Телефон для ссылки tel:
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            value={value.phoneTel}
            onChange={(e) => onChange({ ...value, phoneTel: e.target.value })}
            placeholder="+79130000000"
          />
        </label>
        <label className="block text-sm">
          График работы
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            value={value.schedule}
            onChange={(e) => onChange({ ...value, schedule: e.target.value })}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          Email для сайта
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            value={value.emailInfo}
            onChange={(e) => onChange({ ...value, emailInfo: e.target.value })}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={savingPublic}
          onClick={savePublicContacts}
          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:bg-slate-800 disabled:opacity-60"
        >
          {savingPublic ? "Сохранение…" : "Сохранить контакты на сайт"}
        </button>
        {publicMsg ? <p className="text-sm text-slate-700">{publicMsg}</p> : null}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <label className="block text-sm">
          База партнёров
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            value={value.basePartners}
            onChange={(e) => onChange({ ...value, basePartners: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="block text-sm">
          Пользователей на 1 партнёра
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            value={value.usersPerPartner}
            onChange={(e) => onChange({ ...value, usersPerPartner: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="block text-sm">
          База призов
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            value={value.baseRewards}
            onChange={(e) => onChange({ ...value, baseRewards: Number(e.target.value) || 0 })}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-sky-100 bg-white p-4 text-sm md:grid-cols-2">
        <p>
          Реально в демо сейчас: <strong>{stats.realPartners}</strong> партнёров, <strong>{stats.realUsers}</strong>{" "}
          пользователей, <strong>{stats.realRewards}</strong> призов.
        </p>
        <p>
          На лендинге показываем: <strong>{stats.totalPartners}</strong> партнёров, <strong>{stats.totalUsers}</strong>{" "}
          пользователей, <strong>{stats.totalRewards}</strong> призов.
        </p>
      </div>
    </section>
  );
}

type RewardForm = {
  title: string;
  description: string;
  imageUrl: string;
  pointsCost: string;
  totalStock: string;
  stockLeft: string;
  startsAt: string;
  endsAt: string;
  partnerId: string;
  fundedByPlatform: boolean;
};

function emptyRewardForm(partners: Partner[]): RewardForm {
  return {
    title: "",
    description: "",
    imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
    pointsCost: "200",
    totalStock: "50",
    stockLeft: "50",
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: "2026-12-31",
    partnerId: partners[0]?.id ?? "",
    fundedByPlatform: false,
  };
}

function AdminRewardsPanel({
  rewards,
  partners,
  onChange,
}: {
  rewards: Reward[];
  partners: Partner[];
  onChange: (r: Reward[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RewardForm>(() => emptyRewardForm(partners));
  const [addForm, setAddForm] = useState<RewardForm>(() => emptyRewardForm(partners));

  function remove(id: string) {
    if (!confirm("Удалить приз из витрины?")) return;
    onChange(rewards.filter((r) => r.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function startEdit(r: Reward) {
    setEditingId(r.id);
    setEditForm({
      title: r.title,
      description: r.description,
      imageUrl: r.imageUrl,
      pointsCost: String(r.pointsCost),
      totalStock: String(r.totalStock),
      stockLeft: String(r.stockLeft),
      startsAt: r.startsAt.slice(0, 10),
      endsAt: r.endsAt.slice(0, 10),
      partnerId: r.partnerId ?? partners[0]?.id ?? "",
      fundedByPlatform: !!r.fundedByPlatform,
    });
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const partnerId = editForm.fundedByPlatform ? null : editForm.partnerId || partners[0]?.id || null;
    const total = Math.max(1, Number(editForm.totalStock) || 1);
    const left = Math.min(Math.max(0, Number(editForm.stockLeft) || 0), total);
    onChange(
      rewards.map((r) =>
        r.id === editingId
          ? {
              ...r,
              partnerId,
              fundedByPlatform: editForm.fundedByPlatform,
              title: editForm.title.trim(),
              description: editForm.description.trim(),
              imageUrl: editForm.imageUrl.trim(),
              pointsCost: Number(editForm.pointsCost) || 0,
              totalStock: total,
              stockLeft: left,
              startsAt: new Date(editForm.startsAt + "T00:00:00").toISOString(),
              endsAt: new Date(editForm.endsAt + "T23:59:59").toISOString(),
            }
          : r,
      ),
    );
    setEditingId(null);
  }

  function addReward(e: FormEvent) {
    e.preventDefault();
    const partnerId = addForm.fundedByPlatform ? null : addForm.partnerId || partners[0]?.id || null;
    const total = Math.max(1, Number(addForm.totalStock) || 1);
    const left = Math.min(Math.max(0, Number(addForm.stockLeft) || 0), total);
    const newR: Reward = {
      id: `r-new-${Date.now()}`,
      partnerId,
      fundedByPlatform: addForm.fundedByPlatform,
      title: addForm.title.trim() || "Новый приз",
      description: addForm.description.trim(),
      imageUrl: addForm.imageUrl.trim() || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
      pointsCost: Number(addForm.pointsCost) || 0,
      totalStock: total,
      stockLeft: left,
      startsAt: new Date(addForm.startsAt + "T00:00:00").toISOString(),
      endsAt: new Date(addForm.endsAt + "T23:59:59").toISOString(),
    };
    onChange([...rewards, newR]);
    setAddForm(emptyRewardForm(partners));
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-sky-50/80 to-violet-50/40 p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Призы — полный контроль</h2>
      <p className="mt-1 text-sm text-slate-600">
        Загрузите картинку (URL в демо), даты, тираж, остаток. Призы с бюджета платформы отмечайте галочкой — для старта,
        когда не все компании платят.
      </p>

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={saveEdit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto space-y-3 rounded-xl border border-white bg-white p-4 text-sm">
            <p className="font-semibold text-slate-900">Редактирование приза</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-slate-600">Название</span>
                <input
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-slate-600">Описание</span>
                <textarea
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-slate-600">URL картинки</span>
                <input
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  value={editForm.imageUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, imageUrl: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-slate-600">Баллы</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  value={editForm.pointsCost}
                  onChange={(e) => setEditForm((f) => ({ ...f, pointsCost: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-slate-600">Тираж / остаток</span>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    className="w-full rounded border border-slate-200 px-2 py-1.5"
                    value={editForm.totalStock}
                    onChange={(e) => setEditForm((f) => ({ ...f, totalStock: e.target.value }))}
                  />
                  <input
                    type="number"
                    className="w-full rounded border border-slate-200 px-2 py-1.5"
                    value={editForm.stockLeft}
                    onChange={(e) => setEditForm((f) => ({ ...f, stockLeft: e.target.value }))}
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-slate-600">Старт</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  value={editForm.startsAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-slate-600">Конец</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  value={editForm.endsAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={editForm.fundedByPlatform}
                  onChange={(e) => setEditForm((f) => ({ ...f, fundedByPlatform: e.target.checked }))}
                />
                <span>Бюджет платформы {BRAND_NAME}</span>
              </label>
              {!editForm.fundedByPlatform && (
                <label className="block sm:col-span-2">
                  <span className="text-slate-600">Партнёр</span>
                  <select
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                    value={editForm.partnerId}
                    onChange={(e) => setEditForm((f) => ({ ...f, partnerId: e.target.value }))}
                  >
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.brandName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-white">
                Сохранить
              </button>
              <button type="button" className="rounded-lg border border-slate-200 px-4 py-2" onClick={() => setEditingId(null)}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <form onSubmit={addReward} className="mt-4 space-y-3 rounded-xl border border-dashed border-violet-200 bg-white/60 p-4 text-sm">
        <p className="font-semibold text-slate-900">Добавить приз</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-slate-600">Название</span>
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
              value={addForm.title}
              onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Например: Дегустация"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-slate-600">Описание</span>
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
              value={addForm.description}
              onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-slate-600">Баллы</span>
            <input
              type="number"
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
              value={addForm.pointsCost}
              onChange={(e) => setAddForm((f) => ({ ...f, pointsCost: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-slate-600">Тираж</span>
            <input
              type="number"
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
              value={addForm.totalStock}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, totalStock: e.target.value, stockLeft: e.target.value }))
              }
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={addForm.fundedByPlatform}
              onChange={(e) => setAddForm((f) => ({ ...f, fundedByPlatform: e.target.checked }))}
            />
            <span>С бюджета платформы</span>
          </label>
          {!addForm.fundedByPlatform && (
            <label className="block sm:col-span-2">
              <span className="text-slate-600">Партнёр</span>
              <select
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={addForm.partnerId || partners[0]?.id}
                onChange={(e) => setAddForm((f) => ({ ...f, partnerId: e.target.value }))}
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brandName}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-white">
          Добавить в витрину
        </button>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((reward) => (
          <article key={reward.id} className="overflow-hidden rounded-xl border border-white/80 bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={reward.imageUrl} alt="" className="h-28 w-full object-cover" />
            <div className="p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <strong className="text-slate-900">{reward.title}</strong>
                <span className="shrink-0 font-semibold text-violet-700">{reward.pointsCost} б.</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {partnerLabel(reward.partnerId)}
                {reward.fundedByPlatform ? " · платформа" : ""}
              </p>
              <p className="mt-1 line-clamp-2 text-slate-600">{reward.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                Остаток {reward.stockLeft}/{reward.totalStock} · до {new Date(reward.endsAt).toLocaleDateString("ru-RU")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold"
                  onClick={() => startEdit(reward)}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700"
                  onClick={() => remove(reward.id)}
                >
                  Удалить
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PartnerAdminCard({ partner, onChange }: { partner: Partner; onChange: (p: Partner) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{partner.brandName}</strong>
        <button type="button" className="text-xs font-semibold text-violet-700" onClick={() => setOpen((o) => !o)}>
          {open ? "Свернуть" : "Править / активность"}
        </button>
      </div>
      <p className="mt-1 text-slate-600">
        Тариф: {partner.plan} · точек: {partner.locations} · отзывов (агрегат): {partner.reviewsCount}
      </p>
      <p className="mt-1 text-xs text-slate-500">{partner.lastActivityNote}</p>
      <p className="text-xs text-slate-500">Брифов за 30 дней (демо): {partner.briefsCompleted30d}</p>
      {open && (
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          <label className="block text-xs">
            Название сети
            <input
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
              value={partner.brandName}
              onChange={(e) => onChange({ ...partner, brandName: e.target.value })}
            />
          </label>
          <label className="block text-xs">
            Точек
            <input
              type="number"
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
              value={partner.locations}
              onChange={(e) => onChange({ ...partner, locations: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="block text-xs">
            Заметка активности
            <input
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
              value={partner.lastActivityNote ?? ""}
              onChange={(e) => onChange({ ...partner, lastActivityNote: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function UserAdminCard({
  user,
  onChange,
  passwordDraft,
  onPasswordChange,
  onSavePassword,
}: {
  user: UserProfile;
  onChange: (u: UserProfile) => void;
  passwordDraft: string;
  onPasswordChange: (v: string) => void;
  onSavePassword: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{userFullName(user)}</strong>
        <span className="font-semibold">{user.points} б.</span>
      </div>
      <p className="text-slate-600">{user.email}</p>
      <p className="text-slate-600">{user.phone}</p>
      <button type="button" className="mt-2 text-xs font-semibold text-violet-700" onClick={() => setOpen((o) => !o)}>
        {open ? "Свернуть" : "Редактировать / пароль"}
      </button>
      {open && (
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              Имя
              <input
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
                value={user.firstName}
                onChange={(e) => onChange({ ...user, firstName: e.target.value })}
              />
            </label>
            <label className="block text-xs">
              Фамилия
              <input
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
                value={user.lastName}
                onChange={(e) => onChange({ ...user, lastName: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-xs">
            Email
            <input
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
              value={user.email}
              onChange={(e) => onChange({ ...user, email: e.target.value })}
            />
          </label>
          <label className="block text-xs">
            Телефон
            <input
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
              value={user.phone}
              onChange={(e) => onChange({ ...user, phone: e.target.value })}
            />
          </label>
          <label className="block text-xs">
            Новый пароль (задаёт супер-админ)
            <input
              type="password"
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
              value={passwordDraft}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
            onClick={onSavePassword}
          >
            Сохранить пароль
          </button>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="card">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </article>
  );
}

function ReviewRow({ rev }: { rev: (typeof reviewRecords)[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50"
      >
        <span>
          <strong className="text-slate-900">{rev.userDisplay}</strong>
          <span className="ml-2 text-slate-500">
            {new Date(rev.submittedAt).toLocaleString("ru-RU")} · рейтинг {rev.rating}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
          <span>❤ {rev.likes}</span>
          <span>💬 {rev.comments}</span>
          <span className="text-violet-600">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ответы в брифе</p>
          <ul className="space-y-2">
            {rev.answers.map((a, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-2">
                <p className="text-xs font-medium text-violet-700">{a.question}</p>
                <p className="text-slate-800">{a.answer}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
