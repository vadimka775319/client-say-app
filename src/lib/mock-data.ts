import { BRAND_NAME } from "./brand";

export type Role = "super_admin" | "partner" | "user";

export type PartnerPlan = "trial" | "monthly" | "half_year" | "yearly";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled";

export type PartnerPlanDef = {
  id: PartnerPlan;
  title: string;
  priceRub: number;
  periodMonths: number;
  badge?: string;
  benefits: string[];
};

export type Partner = {
  id: string;
  brandName: string;
  locations: number;
  plan: PartnerPlan;
  planPriceRub: number;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  renewAt?: string;
  rating: number;
  reviewsCount: number;
  /** Демо: активность для супер-админа */
  lastActivityNote?: string;
  briefsCompleted30d?: number;
};

export type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  points: number;
  avatarUrl?: string;
  lastBriefAt?: string;
};

/** Тип вопроса в брифе: текст, шкала 1–5, выбор из вариантов */
export type BriefQuestionType = "text" | "rating" | "choice";

export type BriefQuestion = {
  id: string;
  type: BriefQuestionType;
  prompt: string;
  /** Для type === "choice" — варианты ответа */
  options?: string[];
};

export type Reward = {
  id: string;
  /** null = приз с бюджета платформы (супер-админ) */
  partnerId: string | null;
  title: string;
  imageUrl: string;
  description: string;
  pointsCost: number;
  totalStock: number;
  stockLeft: number;
  startsAt: string;
  endsAt: string;
  /** Супер-админ финансирует из своего бюджета на старте */
  fundedByPlatform?: boolean;
};

export type Brief = {
  id: string;
  partnerId: string;
  title: string;
  questions: BriefQuestion[];
  /** Автоматически от числа вопросов: до 10 → 25 б., 11–20 → 50 б. */
  pointsForComplete: number;
};

export type ReviewRecord = {
  id: string;
  partnerId: string;
  userId: string;
  userDisplay: string;
  rating: number;
  submittedAt: string;
  likes: number;
  comments: number;
  answers: { question: string; answer: string }[];
};

/** Правила начисления и лимитов (единая точка для UI и будущего API) */
export const economyRules = {
  /** Баллы за прохождение брифа при ≤10 вопросов */
  pointsBriefUpTo10Questions: 25,
  /** Баллы за прохождение брифа при 11–20 вопросов */
  pointsBrief11To20Questions: 50,
  /** Один пользователь — один проход брифа у одной компании не чаще раз в 30 дней */
  minDaysBetweenSamePartnerBrief: 30,
} as const;

export function computeBriefPoints(questionCount: number): number {
  if (questionCount <= 0) return 0;
  if (questionCount <= 10) return economyRules.pointsBriefUpTo10Questions;
  if (questionCount <= 20) return economyRules.pointsBrief11To20Questions;
  return economyRules.pointsBrief11To20Questions;
}

export const partnerPlans: PartnerPlanDef[] = [
  {
    id: "trial",
    title: "Старт (3 месяца)",
    priceRub: 0,
    periodMonths: 3,
    badge: "Ознакомление",
    benefits: [
      "До 2 брифов и 5 QR-кодов",
      "До 5 вопросов в одном брифе",
      "Базовая статистика по ответам",
      "Витрина призов для пользователей",
    ],
  },
  {
    id: "monthly",
    title: "Базовый",
    priceRub: 1090,
    periodMonths: 1,
    badge: "Старт с выгодной ценой",
    benefits: [
      "До 5 брифов и 15 QR-кодов",
      "До 10 вопросов в брифе",
      "Экспорт отчётов в Excel",
      "Сводка: средний балл, число отзывов",
    ],
  },
  {
    id: "half_year",
    title: "Полгода",
    priceRub: 5230,
    periodMonths: 6,
    badge: "−20% к помесячной оплате",
    benefits: [
      "До 15 брифов и 50 QR-кодов",
      "До 20 вопросов в брифе",
      "Графики и разбор каждого отзыва",
      "Приоритет в поддержке",
    ],
  },
  {
    id: "yearly",
    title: "Год",
    priceRub: 7850,
    periodMonths: 12,
    badge: "−40% к помесячной оплате",
    benefits: [
      "До 40 брифов и 150 QR-кодов",
      "До 20 вопросов в брифе",
      "Расширенная аналитика",
      "Персональный менеджер (в планах)",
    ],
  },
];

export type PlanLimits = {
  maxBriefs: number;
  maxQr: number;
  maxQuestionsPerBrief: number;
  excel: boolean;
  deepAnalytics: boolean;
};

export const planLimits: Record<PartnerPlan, PlanLimits> = {
  trial: { maxBriefs: 2, maxQr: 5, maxQuestionsPerBrief: 5, excel: false, deepAnalytics: false },
  monthly: { maxBriefs: 5, maxQr: 15, maxQuestionsPerBrief: 10, excel: true, deepAnalytics: false },
  half_year: { maxBriefs: 15, maxQr: 50, maxQuestionsPerBrief: 20, excel: true, deepAnalytics: true },
  yearly: { maxBriefs: 40, maxQr: 150, maxQuestionsPerBrief: 20, excel: true, deepAnalytics: true },
};

export const partners: Partner[] = [
  {
    id: "p-1",
    brandName: "Coffee Nova",
    locations: 3,
    plan: "trial",
    planPriceRub: 0,
    status: "trialing",
    trialEndsAt: "2026-06-20",
    rating: 4.6,
    reviewsCount: 1482,
    lastActivityNote: "12 брифов за 7 дней, 3 жалобы на скорость",
    briefsCompleted30d: 412,
  },
  {
    id: "p-2",
    brandName: "Urban Burger",
    locations: 5,
    plan: "half_year",
    planPriceRub: 5230,
    status: "active",
    renewAt: "2026-09-01",
    rating: 4.3,
    reviewsCount: 2901,
    lastActivityNote: "Рост QR-сканов +18% к прошлой неделе",
    briefsCompleted30d: 1205,
  },
];

export const users: UserProfile[] = [
  {
    id: "u-1",
    firstName: "Иван",
    lastName: "Петров",
    email: "ivan@example.com",
    phone: "+7 900 123-45-67",
    points: 1320,
    lastBriefAt: "2026-03-27T12:20:00Z",
  },
  {
    id: "u-2",
    firstName: "Amina",
    lastName: "Lee",
    email: "amina@example.com",
    phone: "+7 901 555-00-11",
    points: 430,
    lastBriefAt: "2026-03-26T16:15:00Z",
  },
];

export function userFullName(u: UserProfile) {
  return `${u.firstName} ${u.lastName}`.trim();
}

export const demoAuth = {
  super_admin: {
    login: "clientsay@mail.ru",
    password: "OwnerOnly#2026",
  },
  partner: {
    login: "partner@clientsay.ru",
    password: "PartnerDemo2026!",
  },
  user: {
    login: "user@clientsay.ru",
    password: "UserDemo2026!",
  },
} as const;

export const rewards: Reward[] = [
  {
    id: "r-1",
    partnerId: "p-1",
    title: "Капучино в подарок",
    imageUrl: "https://picsum.photos/seed/pulse-r1/800/440",
    description: "Классический капучино 300 мл. Покажите код сотруднику.",
    pointsCost: 300,
    totalStock: 100,
    stockLeft: 42,
    startsAt: "2026-03-01T00:00:00Z",
    endsAt: "2026-04-15T23:59:59Z",
  },
  {
    id: "r-2",
    partnerId: "p-2",
    title: "Комбо бургер + напиток",
    imageUrl: "https://picsum.photos/seed/pulse-r2/800/440",
    description: "Комбо в любом филиале сети по правилам акции.",
    pointsCost: 700,
    totalStock: 60,
    stockLeft: 9,
    startsAt: "2026-03-15T00:00:00Z",
    endsAt: "2026-04-05T23:59:59Z",
  },
  {
    id: "r-3",
    partnerId: "p-1",
    title: "Десерт дня",
    imageUrl: "https://picsum.photos/seed/pulse-r3/800/440",
    description: "Любой десерт из витрины на выбор бариста.",
    pointsCost: 450,
    totalStock: 40,
    stockLeft: 18,
    startsAt: "2026-03-01T00:00:00Z",
    endsAt: "2026-04-30T23:59:59Z",
  },
  {
    id: "r-4",
    partnerId: "p-1",
    title: "Скидка 15% на следующий визит",
    imageUrl: "https://picsum.photos/seed/pulse-r4/800/440",
    description: "Промокод на чек от 500 ₽, действует 14 дней.",
    pointsCost: 200,
    totalStock: 200,
    stockLeft: 112,
    startsAt: "2026-02-01T00:00:00Z",
    endsAt: "2026-05-31T23:59:59Z",
  },
  {
    id: "r-5",
    partnerId: "p-2",
    title: "Фирменный мерч",
    imageUrl: "https://picsum.photos/seed/pulse-r5/800/440",
    description: "Футболка или кружка — уточняйте наличие в точке.",
    pointsCost: 1200,
    totalStock: 25,
    stockLeft: 4,
    startsAt: "2026-03-10T00:00:00Z",
    endsAt: "2026-06-01T23:59:59Z",
  },
  {
    id: "r-6",
    partnerId: "p-2",
    title: "Бесплатная доставка",
    imageUrl: "https://picsum.photos/seed/pulse-r6/800/440",
    description: "Один заказ без платы за доставку в зоне обслуживания.",
    pointsCost: 550,
    totalStock: 80,
    stockLeft: 31,
    startsAt: "2026-03-01T00:00:00Z",
    endsAt: "2026-04-20T23:59:59Z",
  },
];

export const superAdminDemoAuth = {
  login: demoAuth.super_admin.login,
  password: demoAuth.super_admin.password,
} as const;

const q = (id: string, type: BriefQuestionType, prompt: string, options?: string[]): BriefQuestion => ({
  id,
  type,
  prompt,
  options,
});

export const briefs: Brief[] = [
  {
    id: "b-1",
    partnerId: "p-1",
    title: "Оцените сервис и скорость",
    questions: [
      q("b1q1", "rating", "Общая оценка визита"),
      q("b1q2", "text", "Что понравилось больше всего?"),
      q("b1q3", "choice", "Как оцените скорость обслуживания?", ["Очень быстро", "Нормально", "Пришлось подождать"]),
    ],
    pointsForComplete: computeBriefPoints(3),
  },
  {
    id: "b-2",
    partnerId: "p-2",
    title: "Качество кухни и чистота",
    questions: [
      q("b2q1", "rating", "Качество блюда"),
      q("b2q2", "rating", "Чистота зала"),
      q("b2q3", "choice", "Порекомендуете друзьям?", ["Да", "Скорее да", "Нет"]),
      q("b2q4", "text", "Что улучшить?"),
    ],
    pointsForComplete: computeBriefPoints(4),
  },
];

export const reviewRecords: ReviewRecord[] = [
  {
    id: "rev-1",
    partnerId: "p-1",
    userId: "u-1",
    userDisplay: "Иван П.",
    rating: 5,
    submittedAt: "2026-03-28T10:12:00Z",
    likes: 3,
    comments: 0,
    answers: [
      { question: "Общая оценка визита", answer: "5 из 5" },
      { question: "Скорость обслуживания", answer: "Быстро, без очереди" },
      { question: "Что понравилось больше всего?", answer: "Атмосфера и кофе" },
    ],
  },
  {
    id: "rev-2",
    partnerId: "p-1",
    userId: "u-2",
    userDisplay: "Гость #8821",
    rating: 4,
    submittedAt: "2026-03-27T18:40:00Z",
    likes: 1,
    comments: 2,
    answers: [
      { question: "Общая оценка визита", answer: "4 из 5" },
      { question: "Скорость обслуживания", answer: "Немного ждали напиток" },
      { question: "Комментарий", answer: "Хотелось бы больше мест у окна" },
    ],
  },
  {
    id: "rev-3",
    partnerId: "p-2",
    userId: "u-1",
    userDisplay: "Иван П.",
    rating: 5,
    submittedAt: "2026-03-26T19:05:00Z",
    likes: 8,
    comments: 1,
    answers: [
      { question: "Качество блюда", answer: "Отлично" },
      { question: "Чистота зала", answer: "Чисто" },
      { question: "Порекомендуете друзьям?", answer: "Да" },
    ],
  },
];

export const globalReviewStats = {
  totalReviews: 1284,
  avgRating: 4.52,
  totalLikes: 4021,
  totalComments: 318,
  last30Days: 186,
};

export function rewardStatus(reward: Reward, now = new Date()) {
  const isStarted = now >= new Date(reward.startsAt);
  const isExpired = now > new Date(reward.endsAt);
  const isOutOfStock = reward.stockLeft <= 0;

  if (!isStarted) return "upcoming";
  if (isExpired || isOutOfStock) return "unavailable";
  return "active";
}

export function daysLeft(dateISO: string) {
  const ms = new Date(dateISO).getTime() - Date.now();
  return Math.max(Math.ceil(ms / (1000 * 60 * 60 * 24)), 0);
}

export function partnerLabel(id: string | null) {
  if (!id) return `Платформа ${BRAND_NAME}`;
  return partners.find((p) => p.id === id)?.brandName ?? id;
}
