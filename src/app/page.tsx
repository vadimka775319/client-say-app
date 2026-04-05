"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthModal, type HomeAuthRole } from "@/app/components/auth-modal";
import { DeployBadge } from "@/app/components/deploy-badge";
import { DemoQrCard } from "@/app/components/demo-qr-card";
import { partnerPlans, partners, rewards, users } from "@/lib/mock-data";
import { coverageCities } from "@/lib/site-config";
import { BRAND_NAME } from "@/lib/brand";
import {
  computeLandingStats,
  defaultSiteSettings,
  SITE_SETTINGS_KEY,
  type SiteSettings,
} from "@/lib/site-settings";

const INDUSTRIES = [
  "Общепит",
  "Ритейл",
  "Медицина",
  "Красота",
  "HoReCa",
  "Доставка",
  "Образование",
  "Услуги",
  "Логистика",
  "Застройка и ЖКХ",
];

const HOW_STEPS = [
  {
    n: 1,
    title: "QR у вас в точке",
    text: "Партнёр создаёт бриф и кладёт QR на стол, ресепшен или чек.",
  },
  {
    n: 2,
    title: "Клиент проходит бриф",
    text: "Несколько вопросов на телефоне — быстро и понятно.",
  },
  {
    n: 3,
    title: "Баллы → подарок",
    text: "За ответы начисляются баллы. Их можно обменять на призы из витрины.",
  },
  {
    n: 4,
    title: "Вы видите всё",
    text: "Статистика, средний балл, каждый отзыв и ответы по полям. Экспорт в Excel на нужных тарифах.",
  },
];

const TRUST_SIGNALS = [
  "Запуск за 1 рабочий день",
  "Без обязательной публикации отзывов на картах",
  "Прозрачные тарифы без скрытых платежей",
];

const QUICK_START = [
  {
    title: "Быстрый запуск без интеграций",
    text: "Создаёте бриф, печатаете QR и запускаете сбор обратной связи без сложной технической настройки.",
  },
  {
    title: "Готовые сценарии для точек",
    text: "Ресепшен, стол, чек, доставка — выбираете подходящие места размещения и получаете стабильный поток ответов.",
  },
  {
    title: "Поддержка в первые недели",
    text: "Помогаем адаптировать вопросы, механику баллов и витрину призов, чтобы быстрее получить измеримый эффект.",
  },
];

const CASE_STUDIES = [
  {
    title: "Сеть кофеен (8 точек)",
    before: "Отзывы собирались нерегулярно, персонал видел только общие жалобы без деталей по сменам.",
    after: "За 6 недель выросла доля завершённых брифов, а негативные сигналы начали обрабатываться в день обращения.",
    result: "+34% завершённых анкет, среднее время реакции на негатив: < 2 часов.",
  },
  {
    title: "Стоматология (3 филиала)",
    before: "Пациенты редко оставляли обратную связь после визита, трудно было понять причины отказа от повторного приёма.",
    after: "После размещения QR в зоне оплаты клиника получила стабильный поток структурированных ответов по врачам и сервису.",
    result: "+27% повторных записей у пациентов, оценка сервиса выросла с 4.2 до 4.6.",
  },
];

function trackEvent(eventName: string, params: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Array<Record<string, unknown>>;
  };
  if (typeof w.gtag === "function") {
    w.gtag("event", eventName, params);
  }
  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push({ event: eventName, ...params });
  }
}

export default function Home() {
  const monthlyPlan = partnerPlans.find((p) => p.id === "monthly");
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<HomeAuthRole>("GENERAL");

  const openAuth = (mode: HomeAuthRole) => {
    setAuthMode(mode);
    setAuthOpen(true);
    setMobileMenuOpen(false);
  };
  const pricingRef = useRef<HTMLElement | null>(null);
  const pricingViewSent = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site/public", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || cancelled) return;
        setSiteSettings((s) => ({
          ...s,
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

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(SITE_SETTINGS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<SiteSettings>;
        setSiteSettings((prev) => ({
          ...prev,
          basePartners: typeof parsed.basePartners === "number" ? parsed.basePartners : prev.basePartners,
          usersPerPartner: typeof parsed.usersPerPartner === "number" ? parsed.usersPerPartner : prev.usersPerPartner,
          baseRewards: typeof parsed.baseRewards === "number" ? parsed.baseRewards : prev.baseRewards,
        }));
      } catch {
        /* ignore */
      }
    });
  }, []);

  const landingStats = useMemo(
    () => computeLandingStats(siteSettings, partners.length, users.length, rewards.length),
    [siteSettings],
  );

  useEffect(() => {
    if (!pricingRef.current || pricingViewSent.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries.some((entry) => entry.isIntersecting);
        if (!inView || pricingViewSent.current) return;
        pricingViewSent.current = true;
        trackEvent("pricing_view", { section: "pricing" });
      },
      { threshold: 0.35 },
    );
    observer.observe(pricingRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-full bg-[var(--background)] text-slate-800">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        К основному содержанию
      </a>

      <header className="sticky top-0 z-40 border-b border-sky-100/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 md:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2 no-underline">
            <span className="font-brand-logo bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-2xl tracking-tight text-transparent md:text-3xl">
              {BRAND_NAME}
            </span>
          </Link>
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm md:hidden"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-main-menu"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            {mobileMenuOpen ? "Закрыть" : "Меню"}
          </button>
          <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex md:min-w-0 lg:gap-4">
            <nav className="scrollbar-none flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-0.5 overflow-x-auto overscroll-x-contain py-1 text-sm [-ms-overflow-style:none] [scrollbar-width:none] lg:gap-1 [&::-webkit-scrollbar]:hidden">
              <a
                href="#how"
                className="whitespace-nowrap rounded-full px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-slate-900"
              >
                Как работает
              </a>
              <a
                href="#prizes"
                className="whitespace-nowrap rounded-full px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-slate-900"
              >
                Призы
              </a>
              <a
                href="#placement"
                className="whitespace-nowrap rounded-full px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-slate-900"
              >
                Где разместить QR
              </a>
              <a
                href="#pricing"
                className="whitespace-nowrap rounded-full px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-slate-900"
              >
                Тарифы
              </a>
              <a
                href="#materials"
                className="whitespace-nowrap rounded-full px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-slate-900"
              >
                Материалы
              </a>
            </nav>
            <div className="flex shrink-0 flex-nowrap items-center gap-2 border-l border-slate-100 pl-2 lg:pl-3">
              <button
                type="button"
                onClick={() => openAuth("PARTNER")}
                className="whitespace-nowrap rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:border-violet-200 hover:shadow-md"
              >
                Войти как партнёр
              </button>
              <button
                type="button"
                onClick={() => openAuth("USER")}
                className="whitespace-nowrap rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50"
              >
                Войти как пользователь
              </button>
              <button
                type="button"
                onClick={() => openAuth("GENERAL")}
                className="whitespace-nowrap rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Вход
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen ? (
          <div id="mobile-main-menu" className="border-t border-sky-100 bg-white px-5 py-4 md:hidden">
            <nav className="flex flex-col gap-2 text-sm">
              <a
                href="#how"
                className="rounded-xl px-3 py-2 font-medium text-slate-700 hover:bg-sky-50 hover:text-slate-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Как работает
              </a>
              <a
                href="#prizes"
                className="rounded-xl px-3 py-2 font-medium text-slate-700 hover:bg-sky-50 hover:text-slate-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Призы
              </a>
              <a
                href="#placement"
                className="rounded-xl px-3 py-2 font-medium text-slate-700 hover:bg-sky-50 hover:text-slate-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Где разместить QR
              </a>
              <a
                href="#pricing"
                className="rounded-xl px-3 py-2 font-medium text-slate-700 hover:bg-sky-50 hover:text-slate-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Тарифы
              </a>
              <a
                href="#materials"
                className="rounded-xl px-3 py-2 font-medium text-slate-700 hover:bg-sky-50 hover:text-slate-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Материалы
              </a>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  className="rounded-full border border-sky-200 bg-white px-4 py-2 text-center font-semibold text-slate-800 shadow-sm"
                  onClick={() => openAuth("PARTNER")}
                >
                  Войти как партнёр
                </button>
                <button
                  type="button"
                  className="rounded-full border border-transparent px-4 py-2 text-center font-semibold text-violet-700 hover:bg-violet-50"
                  onClick={() => openAuth("USER")}
                >
                  Войти как пользователь
                </button>
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-4 py-2 text-center font-semibold text-white shadow-md"
                  onClick={() => openAuth("GENERAL")}
                >
                  Вход
                </button>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="main">
        <section className="relative overflow-hidden border-b border-sky-100/60 bg-gradient-to-b from-sky-100/90 via-violet-50/40 to-[var(--background)]">
          <div
            className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-violet-200/35 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-5 py-14 md:flex md:items-center md:justify-between md:gap-12 md:py-20 md:px-8">
            <div className="max-w-xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-violet-800 shadow-sm backdrop-blur-sm">
                Отзывы по QR — с бонусом клиенту
              </p>
              <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-5xl md:leading-[1.1]">
                Клиент получает баллы — вы получаете честную обратную связь
              </h1>
              <p className="mt-5 text-pretty text-base leading-relaxed text-slate-600 md:text-lg">
                Короткий бриф после сканирования QR. За заполнение — баллы и призы. Вы видите статистику и каждый ответ,
                без обязательных отзывов на картах.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#cta"
                  onClick={() => trackEvent("hero_cta_click", { placement: "hero", target: "cta_section" })}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  Получить демо и расчёт
                </a>
                <a
                  href="#pricing"
                  className="inline-flex items-center justify-center rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition-all hover:border-violet-200 hover:shadow-md"
                >
                  От {monthlyPlan?.priceRub ?? 1090} ₽ / месяц
                </a>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {TRUST_SIGNALS.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-sky-100 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-10 md:mt-0 md:max-w-sm md:flex-shrink-0">
              <DemoQrCard />
            </div>
          </div>
        </section>

        <section className="border-b border-sky-100/80 bg-white/60 py-6 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl justify-center px-5 md:px-8">
            <div className="flex flex-wrap items-center justify-center gap-8 text-center text-sm md:gap-12">
              <StatPill label="зарегистрированных партнёров" value={String(landingStats.partners)} />
              <StatPill label="пользователей" value={String(landingStats.users)} />
              <StatPill label="призов в витрине" value={String(landingStats.rewards)} />
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-20 border-b border-sky-100/60 bg-white py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Как работает сервис</h2>
              <p className="mt-3 text-slate-600">Простая цепочка: QR → бриф → баллы → аналитика для компании.</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {HOW_STEPS.map((step) => (
                <article
                  key={step.n}
                  className="group relative rounded-2xl border border-sky-100 bg-gradient-to-b from-white to-sky-50/30 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-200/60 hover:shadow-lg"
                >
                  <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 text-lg font-bold text-white shadow-md transition-transform duration-300 group-hover:scale-105">
                    {step.n}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="prizes" className="scroll-mt-20 border-b border-violet-100/50 bg-gradient-to-b from-violet-50/40 to-white py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">Призы за баллы</h2>
              <p className="mt-3 text-slate-600">
                Партнёры загружают подарки в админке: фото, описание, срок акции и остаток. Пользователь видит витрину и
                меняет баллы на приз — в точке показывает код подтверждения.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rewards.slice(0, 6).map((reward) => (
                <article
                  key={reward.id}
                  className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-md transition-shadow hover:shadow-lg"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reward.imageUrl}
                    alt=""
                    className="h-44 w-full object-cover"
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.onerror = null;
                      el.src =
                        "data:image/svg+xml," +
                        encodeURIComponent(
                          '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="176"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e0e7ff"/><stop offset="100%" stop-color="#f5f3ff"/></linearGradient></defs><rect width="800" height="176" fill="url(#g)"/></svg>',
                        );
                    }}
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900">{reward.title}</h3>
                      <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800">
                        {reward.pointsCost} б.
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{reward.description}</p>
                    <p className="mt-3 text-xs text-slate-500">
                      Остаток {reward.stockLeft}/{reward.totalStock} · до{" "}
                      {new Date(reward.endsAt).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-violet-100/50 bg-gradient-to-b from-sky-50/30 to-[var(--background)] py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="flex flex-col items-center gap-8 rounded-3xl border border-white/80 bg-white/70 p-8 shadow-lg backdrop-blur-md md:flex-row md:justify-between md:p-10">
              <div className="max-w-lg text-center md:text-left">
                <h2 className="text-2xl font-extrabold text-slate-900 md:text-3xl">Загляните в кабинеты</h2>
                <p className="mt-3 text-slate-600">
                  Партнёр управляет брифами, QR, статистикой и призами. Пользователь ведёт профиль, копит баллы и
                  обменивает их на подарки.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openAuth("PARTNER")}
                  className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5"
                >
                  Войти как партнёр
                </button>
                <button
                  type="button"
                  onClick={() => openAuth("USER")}
                  className="rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition-all hover:border-violet-200"
                >
                  Войти как пользователь
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="business" className="scroll-mt-20 border-b border-sky-100/60 bg-white py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 className="text-center text-3xl font-extrabold text-slate-900 md:text-4xl">Зачем {BRAND_NAME} бизнесу</h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-base leading-relaxed text-slate-600">
              Как у сильных игроков на рынке QR-обратной связи, только с акцентом на вашу модель: не обязательные отзывы
              на картах, а структурированный бриф, баллы и призы — чтобы гость дошёл до конца и честно ответил на
              вопросы, которые важны именно вам.
            </p>
            <div className="mt-12 grid gap-8 lg:grid-cols-3">
              <BenefitCard
                title="Больше завершённых отзывов"
                body="Чем проще путь и понятнее награда, тем выше доля завершённых брифов. Баллы и витрина призов работают как мягкая мотивация без «нажима» на публичные площадки."
                icon="◆"
              />
              <BenefitCard
                title="Полная картина по каждому ответу"
                body="Текст, оценки 1–5, выбор из вариантов — все ответы хранятся вместе. Удобно смотреть средние значения, динамику и разбирать конкретные кейсы с персоналом точки."
                icon="◇"
              />
              <BenefitCard
                title="Тарифы под масштаб и прозрачные правила"
                body="Лимиты брифов и QR под ваш план — без сюрпризов в счёте. Повторные проходы у одной сети регулируются понятными интервалами, остатки призов и сроки акций видны в кабинете. На старших тарифах — выгрузки для отчётности и бухгалтерии."
                icon="○"
              />
            </div>
            <div className="mt-12 grid gap-8 border-t border-slate-100 pt-12 md:grid-cols-2">
              <article className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/50 to-white p-8">
                <h3 className="text-xl font-bold text-slate-900">Быстрее реагировать на негатив</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Обратная связь приходит в привычный кабинет: видно время, бриф и все поля. Можно оперативно связаться с
                  гостем и закрыть вопрос до того, как он уйдёт в публичный негатив — скорость реакции становится частью
                  вашего сервиса.
                </p>
              </article>
              <article className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-white p-8">
                <h3 className="text-xl font-bold text-slate-900">Дисциплина сервиса в точках</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Единый QR и понятные вопросы помогают держать единый стандарт: сеть видит однотипные данные по всем
                  филиалам, а команда понимает, за что отвечает зал, кухня или доставка.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="border-b border-sky-100/60 bg-gradient-to-b from-sky-50/40 to-white py-16 md:py-24">
          <div className="mx-auto max-w-4xl px-5 text-center md:px-8">
            <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">Клиенту тоже выгодно</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Людям важно, что их слышат. Короткий бриф на телефоне, понятный бонус и прозрачные правила обмена баллов на
              подарок — без длинных регистраций «ради формы». Код подтверждения в точке защищает и гостя, и партнёра от
              недопонимания при выдаче приза.
            </p>
            <p className="mx-auto mt-6 max-w-2xl text-sm text-slate-500">
              Мы сознательно отделяем модель {BRAND_NAME} от агрегаторов карт: фокус — качественная обратная связь для
              компании и честная мотивация гостя, а не только звезды на внешних площадках.
            </p>
          </div>
        </section>

        <section className="border-b border-sky-100/60 bg-white py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 className="text-center text-3xl font-extrabold text-slate-900 md:text-4xl">
              Что помогает продавать лучше уже в первый месяц
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-slate-600">
              Не только сбор отзывов, но и управляемая воронка обратной связи: больше завершённых ответов, быстрее реакция
              на негатив, понятная аналитика по каждому филиалу.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {QUICK_START.map((item) => (
                <article key={item.title} className="rounded-2xl border border-sky-100 bg-sky-50/30 p-6">
                  <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cases" className="scroll-mt-20 border-b border-violet-100/40 bg-gradient-to-b from-violet-50/30 to-white py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 className="text-center text-3xl font-extrabold text-slate-900 md:text-4xl">Кейсы: до / после внедрения</h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-slate-600">
              Примеры сценариев, где структурированная QR-обратная связь помогла улучшить сервис и повторные продажи.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {CASE_STUDIES.map((item) => (
                <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                  <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-rose-700">До</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.before}</p>
                  </div>
                  <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">После</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.after}</p>
                  </div>
                  <p className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">{item.result}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="industries" className="scroll-mt-20 border-b border-sky-100/60 bg-white py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 className="text-center text-2xl font-extrabold text-slate-900 md:text-3xl">Кому подойдёт</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-600">
              Любой бизнес с очным или сервисным контактом.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2 md:gap-3">
              {INDUSTRIES.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-sky-100 bg-sky-50/80 px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:border-violet-200 hover:bg-violet-50/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="placement" className="scroll-mt-20 border-b border-sky-100/60 bg-white py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 className="text-center text-3xl font-extrabold text-slate-900 md:text-4xl">Где разместить QR-код</h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-slate-600">
              Типичные точки контакта — от ресепшена и стола до чека, упаковки и зоны ожидания: там, где гость уже
              взаимодействует с брендом.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Ресепшен и касса",
                "Столы и подстаканники",
                "Меню и тейбл-тенты",
                "Стаканы и навынос",
                "Чек и визитка",
                "Зона ожидания и лифт",
                "Номер / стол в общепите",
                "Доставка: листовка и пакет",
              ].map((place) => (
                <div
                  key={place}
                  className="rounded-xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/30 px-4 py-3 text-sm font-medium text-slate-800"
                >
                  {place}
                </div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
              После подключения партнёр получает ссылку на бриф и может скачать макет QR в кабинете — размещайте столько
              копий, сколько позволяет тариф.
            </p>
          </div>
        </section>

        <section id="regions" className="scroll-mt-20 border-b border-violet-100/40 bg-gradient-to-b from-violet-50/20 to-white py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 className="text-center text-2xl font-extrabold text-slate-900 md:text-3xl">География</h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-600">
              {BRAND_NAME} подходит для сетей и одиночных точек в городах любого масштаба. Ниже — пример крупных городов; список
              можно расширять под вашу сеть.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {coverageCities.map((city) => (
                <span
                  key={city}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {city}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="materials" className="scroll-mt-20 border-b border-sky-100/60 bg-white py-14 md:py-16">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-50/50 to-white p-8 md:flex md:items-center md:justify-between md:gap-10 md:p-10">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 md:text-3xl">Материалы</h2>
                <p className="mt-2 max-w-xl text-sm text-slate-600">
                  Презентацию и реквизиты можно будет скачать здесь после загрузки файлов на сервер. Пока —
                  зарезервировано место под PDF.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 md:mt-0">
                <span
                  className="inline-flex cursor-default items-center rounded-full border border-slate-300 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-500"
                  title="Загрузите PDF позже — кнопка станет активной"
                >
                  Скачать презентацию (скоро)
                </span>
                <Link
                  href="/terms"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:border-violet-200"
                >
                  Реквизиты (в соглашении)
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" ref={pricingRef} className="scroll-mt-20 bg-gradient-to-b from-white to-sky-50/30 py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 className="text-center text-3xl font-extrabold text-slate-900 md:text-4xl">Тарифы</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
              Одна компания — один тариф. Дольше срок — ниже цена за месяц и больше брифов, QR и аналитики.
            </p>
            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              {partnerPlans.map((plan) => (
                <article
                  key={plan.id}
                  className={`flex flex-col rounded-2xl border p-6 shadow-sm transition-all duration-300 hover:shadow-md ${
                    plan.id === "half_year"
                      ? "border-violet-300 bg-gradient-to-br from-violet-50/80 to-white ring-2 ring-violet-200/60"
                      : "border-sky-100 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{plan.title}</h3>
                      {plan.badge && <p className="text-xs font-semibold text-violet-700">{plan.badge}</p>}
                    </div>
                    <p className="text-2xl font-extrabold text-violet-700">
                      {plan.priceRub === 0 ? "0 ₽" : `${plan.priceRub.toLocaleString("ru-RU")} ₽`}
                      {plan.periodMonths > 0 && (
                        <span className="block text-right text-xs font-normal text-slate-500">
                          {plan.periodMonths === 1 ? "в месяц" : `за ${plan.periodMonths} мес.`}
                        </span>
                      )}
                    </p>
                  </div>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                    {plan.benefits.map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="text-violet-500">✓</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cta" className="scroll-mt-20 border-t border-sky-100/60 bg-white py-14 md:py-16">
          <div className="mx-auto max-w-4xl px-5 text-center md:px-8">
            <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">Готовы протестировать на своей точке?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Поможем подобрать сценарий под ваш бизнес, рассчитать экономику баллов и запустить пилот без лишней
              бюрократии.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href={`mailto:${siteSettings.emailInfo}`}
                onClick={() => trackEvent("footer_cta_click", { placement: "footer_cta", action: "email" })}
                className="inline-flex items-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5"
              >
                Написать: {siteSettings.emailInfo}
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-800 bg-gradient-to-b from-slate-950 to-black text-slate-400">
          <div className="mx-auto max-w-6xl px-5 py-12 md:px-8">
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              <div className="lg:col-span-1">
                <p className="text-xs font-bold uppercase tracking-widest text-violet-400/90">Связь с нами</p>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">{siteSettings.brandLine}</p>
                <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">E-mail</p>
                  <a
                    href={`mailto:${siteSettings.emailInfo}`}
                    className="mt-1 inline-block break-all text-lg font-semibold text-violet-400 transition-colors hover:text-violet-300 sm:text-xl"
                  >
                    {siteSettings.emailInfo}
                  </a>
                  <p className="mt-4 text-sm text-slate-500">{siteSettings.schedule}</p>
                  {(siteSettings.phoneTel?.trim() || siteSettings.phoneDisplay?.trim()) ? (
                    <>
                      <div className="mt-4 h-px w-full bg-slate-800" />
                      {siteSettings.phoneTel ? (
                        <a
                          href={`tel:${siteSettings.phoneTel}`}
                          className="mt-4 block text-lg font-bold tabular-nums tracking-tight text-white transition-colors hover:text-violet-300"
                        >
                          {siteSettings.phoneDisplay || siteSettings.phoneTel}
                        </a>
                      ) : (
                        <p className="mt-4 text-lg font-bold text-white">{siteSettings.phoneDisplay}</p>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
              <div id="sitemap">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Карта сайта</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li>
                    <a href="#how" className="hover:text-slate-200">
                      Как работает сервис
                    </a>
                  </li>
                  <li>
                    <a href="#prizes" className="hover:text-slate-200">
                      Призы за баллы
                    </a>
                  </li>
                  <li>
                    <a href="#business" className="hover:text-slate-200">
                      Зачем {BRAND_NAME} бизнесу
                    </a>
                  </li>
                  <li>
                    <a href="#placement" className="hover:text-slate-200">
                      Где разместить QR
                    </a>
                  </li>
                  <li>
                    <a href="#industries" className="hover:text-slate-200">
                      Кому подойдёт
                    </a>
                  </li>
                  <li>
                    <a href="#regions" className="hover:text-slate-200">
                      География
                    </a>
                  </li>
                  <li>
                    <a href="#pricing" className="hover:text-slate-200">
                      Тарифы
                    </a>
                  </li>
                  <li>
                    <Link href="/sign-in" className="hover:text-slate-200">
                      Вход и регистрация (выбор кабинета)
                    </Link>
                  </li>
                  <li>
                    <Link href="/sign-in?role=PARTNER&next=/partner" className="hover:text-slate-200">
                      Вход / регистрация партнёра
                    </Link>
                  </li>
                  <li>
                    <Link href="/sign-in?role=USER&next=/user" className="hover:text-slate-200">
                      Вход / регистрация пользователя
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin" className="hover:text-slate-200">
                      Вход для SuperAdmin
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Материалы</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li>
                    <span className="text-slate-500">Презентация — скоро (PDF)</span>
                  </li>
                  <li>
                    <Link href="/terms" className="hover:text-slate-200">
                      Пользовательское соглашение
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy" className="hover:text-slate-200">
                      Политика конфиденциальности
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Города</p>
                <p className="mt-4 text-xs leading-relaxed text-slate-500">
                  {coverageCities.slice(0, 12).join(" · ")}
                  <span className="text-slate-600"> · …</span>
                </p>
              </div>
            </div>
            <div className="mt-12 border-t border-slate-800 pt-8 text-center text-xs text-slate-500">
              <p>
                  © 2024-2026 {BRAND_NAME}. Все права защищены.
              </p>
              <DeployBadge />
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <Link href="/privacy" className="hover:text-slate-300">
                  Политика конфиденциальности
                </Link>
                <Link href="/terms" className="hover:text-slate-300">
                  Пользовательское соглашение
                </Link>
                <Link href="/admin" className="hover:text-slate-300">
                  SuperAdmin
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </main>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function BenefitCard({ title, body, icon }: { title: string; body: string; icon: string }) {
  return (
    <article className="rounded-2xl border border-sky-100 bg-gradient-to-b from-white to-violet-50/20 p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <span className="text-2xl text-violet-500" aria-hidden>
        {icon}
      </span>
      <h3 className="mt-4 text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{body}</p>
    </article>
  );
}
