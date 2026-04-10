"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { SessionRole } from "@/lib/auth-session";
import { demoAuth } from "@/lib/mock-data";
import { cabinetPath, parseSessionRole, resolvePostLoginRedirect } from "@/lib/auth-routes";
import { BRAND_NAME } from "@/lib/brand";
import { PARTNER_CITY_OTHER, partnerRegistrationCities } from "@/lib/site-config";
import { isStoredRuPhone, normalizeLogin } from "@/lib/login-identity";

/** Старые ключи без привязки к аккаунту — иначе новый партнёр видит данные предыдущего входа в этом браузере. */
function clearLegacyPartnerBrowserState() {
  if (typeof window === "undefined") return;
  for (const k of [
    "clientsay_partner_briefs",
    "clientsay_partner_profile",
    "clientsay_partner_rewards",
    "clientsay_partner_brief_stats",
    "clientsay_accounts_user",
  ]) {
    try {
      localStorage.removeItem(k);
    } catch {
      // no-op
    }
  }
}

const ROLE_LABEL: Record<SessionRole, string> = {
  SUPER_ADMIN: "супер-админа",
  PARTNER: "партнёра",
  USER: "пользователя",
};

function hintForRole(role: SessionRole | null) {
  if (role === "SUPER_ADMIN") return { login: demoAuth.super_admin.login, password: demoAuth.super_admin.password };
  if (role === "PARTNER") return { login: demoAuth.partner.login, password: demoAuth.partner.password };
  if (role === "USER") return { login: demoAuth.user.login, password: demoAuth.user.password };
  return null;
}

function validateLoginField(login: string): string | null {
  const t = login.trim();
  if (!t) return "Введите email или телефон.";
  if (t.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? null : "Некорректный email.";
  }
  const digits = t.replace(/\D/g, "");
  return digits.length >= 10 ? null : "Телефон: не меньше 10 цифр (или укажите email с символом @).";
}

/** Регистрация: те же правила, что на сервере (в т.ч. итоговый вид телефона +7…10 цифр). */
function validateRegisterLogin(login: string): string | null {
  const t = login.trim();
  if (!t) return "Укажите email или телефон — это будет логином для входа.";
  if (t.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
      ? null
      : "Email: нужны символ @ и домен, например partner@mail.ru";
  }
  const digits = t.replace(/\D/g, "");
  if (digits.length < 10) {
    return "Телефон: минимум 10 цифр номера (РФ), например 89563654789 или +79563654789.";
  }
  const n = normalizeLogin(t);
  if (!n.email && (!n.phone || !isStoredRuPhone(n.phone))) {
    return "Телефон не распознан. Попробуйте 10 цифр после кода страны: 9563654789, 89563654789.";
  }
  return null;
}

type RegFieldKey = "company" | "city" | "login" | "password" | "name";

async function readResponseJson(res: Response): Promise<{ json: unknown | null; raw: string }> {
  const raw = await res.text();
  if (!raw.trim()) return { json: null, raw };
  try {
    return { json: JSON.parse(raw) as unknown, raw };
  } catch {
    return { json: null, raw };
  }
}

function extractApiErrorMessage(json: unknown | null, res: Response, raw: string): string {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    const er = o.error;
    if (er && typeof er === "object" && er !== null) {
      const m = (er as Record<string, unknown>).message;
      if (typeof m === "string" && m.trim()) return m.trim();
    }
    const top = o.message;
    if (typeof top === "string" && top.trim()) return top.trim();
  }

  const st = res.status;
  const head = raw.slice(0, 600).toLowerCase();
  if (head.includes("<!doctype") || head.includes("<html")) {
    return `Сервер вернул HTML вместо JSON (код ${st}). Часто это падение API или неверный nginx. Откройте /api/health — должно быть JSON с «db».`;
  }

  if (st === 502 || st === 504) {
    return `Нет ответа от приложения (${st}). Проверьте PM2 и совпадение порта с nginx.`;
  }
  if (st === 403) {
    return "Доступ к API запрещён (403). Проверьте nginx для POST /api/auth/register.";
  }
  if (st === 503) {
    return "Сервис временно недоступен. Откройте /api/health — поле db должно быть up; проверьте AUTH_SECRET и DATABASE_URL на сервере.";
  }
  if (st >= 500) {
    return "Ошибка сервера. Проверьте /api/health, DATABASE_URL и AUTH_SECRET (не короче 32 символов).";
  }
  if (st === 409) {
    return "Этот email или телефон уже зарегистрирован. Войдите или укажите другой логин.";
  }
  return `Запрос не выполнен (код ${st}). Проверьте сеть; если повторяется — откройте /api/health.`;
}

function diagFromResponse(res: Response, json: unknown | null): string {
  if (json && typeof json === "object") {
    const er = (json as Record<string, unknown>).error;
    if (er && typeof er === "object" && er !== null) {
      const c = (er as Record<string, unknown>).code;
      if (typeof c === "string" && c.trim()) return `HTTP ${res.status} · ${c.trim()}`;
    }
  }
  return `HTTP ${res.status}`;
}

export type SignInFormProps = {
  /** В модалке на главной: зафиксировать роль. Если не задано — из URL ?role= */
  embeddedRole?: SessionRole | null;
  hideChrome?: boolean;
  onRequestClose?: () => void;
  /** С сервера (RSC): если на экране нет этой строки или она не совпадает с GitHub — это кэш или другой домен. */
  serverBuildLabel?: string | null;
};

export default function SignInForm(props: SignInFormProps = {}) {
  const { embeddedRole: embeddedRoleProp, hideChrome = false, onRequestClose, serverBuildLabel = null } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const urlRole = parseSessionRole(searchParams.get("role"));
  /** В модалке «общий» режим: роль выбирают карточками локально. */
  const [modalCabinet, setModalCabinet] = useState<"USER" | "PARTNER" | null>(null);

  const roleParam = useMemo((): SessionRole | null => {
    if (embeddedRoleProp !== undefined) {
      if (embeddedRoleProp === "USER" || embeddedRoleProp === "PARTNER" || embeddedRoleProp === "SUPER_ADMIN") {
        return embeddedRoleProp;
      }
      return modalCabinet;
    }
    return urlRole;
  }, [embeddedRoleProp, modalCabinet, urlRole]);

  /** Старые ссылки с ?reason=wrong_role: сброс сессии и чистый URL без жёлтого баннера. */
  useEffect(() => {
    if (searchParams.get("reason") !== "wrong_role") return;
    let cancelled = false;
    void (async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include", cache: "no-store" });
      if (cancelled) return;
      const p = new URLSearchParams(searchParams.toString());
      p.delete("reason");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router, searchParams]);

  /** При открытии конкретной роли сбрасываем старую сессию другой роли, чтобы не было входа "в чужой кабинет". */
  useEffect(() => {
    if (!roleParam) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
        const d = (await r.json()) as { ok?: boolean; role?: SessionRole };
        if (cancelled || !d?.ok || !d.role) return;
        if (d.role !== roleParam) {
          await fetch("/api/auth/logout", { method: "POST", credentials: "include", cache: "no-store" });
          if (cancelled) return;
          setNotice(`Сессия роли ${ROLE_LABEL[d.role]} завершена. Теперь войдите как ${ROLE_LABEL[roleParam]}.`);
        } else {
          setNotice("");
        }
      } catch {
        // ignore network errors here
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roleParam]);

  const isSuperCabinet = roleParam === "SUPER_ADMIN";
  const canRegister = roleParam === "PARTNER" || roleParam === "USER";
  /** У админа только вход; у остальных — переключатель вход/регистрация. */
  const showAuthModeToggle = !isSuperCabinet;
  /** Полная страница /sign-in: всегда две большие карточки + запись ?role= в адрес (не спрятано за ссылкой с главной). */
  const showCabinetGrid = !isSuperCabinet && embeddedRoleProp === undefined;
  /** Модалка без фиксированной роли. */
  const showModalCabinetPicker = Boolean(hideChrome && embeddedRoleProp === null && !isSuperCabinet);
  /** Крупные карточки выбора кабинета (страница без ?role= или модалка «общий» режим). */
  const showCabinetChoiceCards =
    (showCabinetGrid && !urlRole) || (showModalCabinetPicker && !modalCabinet);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [partnerCity, setPartnerCity] = useState("");
  const [partnerCityCustom, setPartnerCityCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastDiag, setLastDiag] = useState<string | null>(null);
  const [regFieldErr, setRegFieldErr] = useState<Partial<Record<RegFieldKey, string>>>({});
  const [origin, setOrigin] = useState("");
  const [apiBuildLabel, setApiBuildLabel] = useState<string | null>(null);

  function setRoleOnUrl(nextRole: "USER" | "PARTNER") {
    const p = new URLSearchParams(searchParams.toString());
    p.set("role", nextRole);
    p.delete("reason");
    setNotice("");
    setLastDiag(null);
    router.replace(`${pathname}?${p.toString()}`);
  }

  function pickModalCabinet(nextRole: "USER" | "PARTNER") {
    setModalCabinet(nextRole);
    setRegFieldErr({});
    setError("");
    setNotice("");
    setLastDiag(null);
  }

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    void fetch(`/api/deploy-meta?bust=${Date.now()}`, { cache: "no-store", credentials: "same-origin" })
      .then((r) => r.json() as Promise<{ gitShort?: string; buildEpoch?: number }>)
      .then((j) => {
        const g = j.gitShort?.trim();
        if (!g) {
          setApiBuildLabel(null);
          return;
        }
        setApiBuildLabel(typeof j.buildEpoch === "number" ? `${g} · ${j.buildEpoch}` : g);
      })
      .catch(() => setApiBuildLabel(null));
  }, []);

  const title = useMemo(() => {
    if (isSuperCabinet) return "Кабинет супер-админа";
    if (mode === "register") {
      if (roleParam === "USER") return "Регистрация пользователя";
      if (roleParam === "PARTNER") return "Регистрация партнёра";
      return "Регистрация — выберите тип кабинета";
    }
    if (!roleParam) return `Вход в ${BRAND_NAME}`;
    return `Вход для ${ROLE_LABEL[roleParam]}`;
  }, [roleParam, mode, isSuperCabinet]);

  const registerLoginPreview = useMemo(() => {
    if (mode !== "register" || !canRegister) return null;
    const id = identifier.trim();
    if (!id || id.includes("@")) return null;
    const n = normalizeLogin(id);
    if (n.phone && isStoredRuPhone(n.phone)) return n.phone;
    return null;
  }, [mode, canRegister, identifier]);

  const demoHint = hintForRole(roleParam);

  function patchRegFieldErr(key: RegFieldKey, patch: string | undefined) {
    setRegFieldErr((prev) => {
      const next = { ...prev };
      if (patch === undefined || patch === "") delete next[key];
      else next[key] = patch;
      return next;
    });
  }

  /** true = текст показан у конкретного поля, общий блок ошибки не дублируем */
  function mapRegisterApiErrorToFields(msg: string): boolean {
    const m = msg.toLowerCase();
    if (
      m.includes("телефон") ||
      m.includes("email") ||
      m.includes("уже зарегистрирован") ||
      m.includes("уже занят") ||
      m.includes("укажите email") ||
      m.includes("российск")
    ) {
      patchRegFieldErr("login", msg);
      return true;
    }
    if (m.includes("компани") || m.includes("организац")) {
      patchRegFieldErr("company", msg);
      return true;
    }
    if (m.includes("город")) {
      patchRegFieldErr("city", msg);
      return true;
    }
    if (m.includes("парол")) {
      patchRegFieldErr("password", msg);
      return true;
    }
    if (m.includes("имя")) {
      patchRegFieldErr("name", msg);
      return true;
    }
    if (m.includes("html") || m.includes("nginx") || m.includes("pm2") || m.includes("/api/health")) {
      patchRegFieldErr("login", msg);
      return true;
    }
    return false;
  }

  /** Полная перезагрузка страницы — иначе Next.js иногда не подхватывает Set-Cookie до client navigation. */
  const redirectAfterAuth = useCallback(
    (userRole: SessionRole) => {
      const target = resolvePostLoginRedirect(next, userRole);
      if (typeof window !== "undefined") {
        window.location.assign(target);
        return;
      }
      router.push(target);
      router.refresh();
    },
    [next, router],
  );

  async function readApiResponse<T>(res: Response): Promise<T | null> {
    const raw = await res.text();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async function verifySessionAfterAuth(expectedRole: SessionRole): Promise<boolean> {
    try {
      const r = await fetch(`/api/auth/session?bust=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!r.ok) return false;
      const d = (await r.json()) as { ok?: boolean; role?: SessionRole };
      return d?.ok === true && d.role === expectedRole;
    } catch {
      return false;
    }
  }

  async function onLogin() {
    setError("");
    const id = identifier.trim();
    const pass = password.trim();
    if (!id || !pass) {
      setError("Введите логин и пароль.");
      return;
    }
    const loginErr = validateLoginField(id);
    if (loginErr) {
      setError(loginErr);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: id,
          password: pass,
          ...(roleParam ? { expectedRole: roleParam } : {}),
        }),
      });
      const data = await readApiResponse<{ ok?: boolean; role?: SessionRole; error?: { message?: string } }>(res);
      if (!res.ok) {
        setError(data?.error?.message ?? "Не удалось войти.");
        return;
      }
      if (!data?.role) {
        setError("Ответ сервера неполный. Попробуйте обновить страницу или откройте /api/health.");
        return;
      }
      const sessionOk = await verifySessionAfterAuth(data.role);
      if (!sessionOk) {
        setError(
          "Сессия не сохранилась после входа. Очистите cookie/кэш сайта и попробуйте снова. Если не поможет — проверьте HTTPS и прокси.",
        );
        return;
      }
      if (data.role === "PARTNER") clearLegacyPartnerBrowserState();
      redirectAfterAuth(data.role);
    } catch {
      setError("Сеть недоступна. Попробуйте снова.");
    } finally {
      setBusy(false);
    }
  }

  async function onRegister() {
    setError("");
    setRegFieldErr({});
    setLastDiag(null);
    if (!roleParam || !canRegister) {
      setError("Сначала выберите кабинет: пользователь или партнёр (карточки выше).");
      return;
    }
    const id = identifier.trim();
    const pass = password.trim();
    const fe: Partial<Record<RegFieldKey, string>> = {};

    if (roleParam === "USER") {
      if (!name.trim()) fe.name = "Укажите, как к вам обращаться (имя).";
    } else {
      if (!companyName.trim()) {
        fe.company = "Введите название компании или бренда точки.";
      } else if (companyName.trim().length < 2) {
        fe.company = "Название слишком короткое (минимум 2 символа).";
      }
      const resolvedCity =
        partnerCity === PARTNER_CITY_OTHER ? partnerCityCustom.trim() : partnerCity.trim();
      if (!partnerCity) {
        fe.city = "Выберите город из списка.";
      } else if (!resolvedCity) {
        fe.city = "Для «Другой город» введите название населённого пункта.";
      } else if (resolvedCity.length > 120) {
        fe.city = "Название города не длиннее 120 символов.";
      }
    }

    if (!id) fe.login = "Укажите email (с @) или телефон.";
    else {
      const le = validateRegisterLogin(id);
      if (le) fe.login = le;
    }

    if (!pass) fe.password = "Придумайте пароль.";
    else if (pass.length < 6) fe.password = "Пароль: не меньше 6 символов.";

    if (Object.keys(fe).length > 0) {
      setRegFieldErr(fe);
      setError("");
      return;
    }

    setBusy(true);
    try {
      if (roleParam === "USER") {
        const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/auth/register`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            role: "USER",
            login: id,
            password: pass,
            firstName: name.trim(),
            lastName: "",
          }),
        });
        const { json, raw } = await readResponseJson(res);
        const typed = json as { ok?: boolean; role?: SessionRole } | null;
        if (!res.ok) {
          setLastDiag(diagFromResponse(res, json));
          const msg = extractApiErrorMessage(json, res, raw);
          const mapped = mapRegisterApiErrorToFields(msg);
          setError(mapped ? "" : msg);
          return;
        }
        if (!typed?.role) {
          setError("Ответ сервера неполный. Попробуйте войти с тем же email или телефоном.");
          return;
        }
        const sessionOk = await verifySessionAfterAuth(typed.role);
        if (!sessionOk) {
          setError(
            "Регистрация выполнена, но сессия не сохранилась. Очистите cookie/кэш сайта и повторите вход.",
          );
          return;
        }
        if (typed.role === "PARTNER") clearLegacyPartnerBrowserState();
        redirectAfterAuth(typed.role);
        return;
      }

      const resolvedCity =
        partnerCity === PARTNER_CITY_OTHER ? partnerCityCustom.trim() : partnerCity.trim();
      const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/auth/register`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          role: "PARTNER",
          login: id,
          password: pass,
          companyName: companyName.trim(),
          city: resolvedCity,
          firstName: name.trim() || "Партнёр",
        }),
      });
      const { json, raw } = await readResponseJson(res);
      const typed = json as { ok?: boolean; role?: SessionRole } | null;
      if (!res.ok) {
        setLastDiag(diagFromResponse(res, json));
        const msg = extractApiErrorMessage(json, res, raw);
        const mapped = mapRegisterApiErrorToFields(msg);
        setError(mapped ? "" : msg);
        return;
      }
      if (!typed?.role) {
        setError("Ответ сервера неполный. Попробуйте войти с тем же email или телефоном.");
        return;
      }
      const sessionOk = await verifySessionAfterAuth(typed.role);
      if (!sessionOk) {
        setError(
          "Регистрация выполнена, но сессия не сохранилась. Очистите cookie/кэш сайта и повторите вход.",
        );
        return;
      }
      if (typed.role === "PARTNER") clearLegacyPartnerBrowserState();
      redirectAfterAuth(typed.role);
    } catch {
      setLastDiag("Сеть: исключение fetch");
      setError("Сеть недоступна. Попробуйте снова.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "register") {
      if (!canRegister) {
        setError("Сначала выберите кабинет: пользователь или партнёр (карточки выше).");
        return;
      }
      void onRegister();
      return;
    }
    void onLogin();
  }

  const inner = (
        <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-violet-900/5 backdrop-blur-md md:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Безопасный вход</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {hideChrome
              ? showModalCabinetPicker && !modalCabinet
                ? "Выберите тип кабинета крупными кнопками ниже, затем войдите или зарегистрируйтесь."
                : "Войдите или зарегистрируйтесь. После входа вы попадёте в нужный кабинет (партнёр или пользователь)."
              : showCabinetGrid && !urlRole
                ? "Выберите кабинет ниже: пользователь или партнёр. В адрес добавится ?role=… Для регистрации выбор обязателен; для входа можно отправить форму и без выбора — откроется кабинет по учётке."
                : "Сессия в защищённой cookie. После входа вы вернётесь в запрошенный раздел."}
          </p>
          {notice ? (
            <p className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
              {notice}
            </p>
          ) : null}

          {showCabinetChoiceCards ? (
            <div className="mt-6 space-y-3">
              <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500">Кабинет</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  className="rounded-2xl border-2 border-violet-200/90 bg-gradient-to-br from-white to-violet-50/90 p-5 text-left shadow-md transition hover:border-violet-400 hover:shadow-lg"
                  onClick={() => (showCabinetGrid ? setRoleOnUrl("USER") : pickModalCabinet("USER"))}
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-violet-600">Пользователь</span>
                  <span className="mt-2 block text-lg font-bold text-slate-900">Личный кабинет</span>
                  <span className="mt-1 block text-sm text-slate-600">Участвовать в брифах как частное лицо.</span>
                </button>
                <button
                  type="button"
                  className="rounded-2xl border-2 border-indigo-200/90 bg-gradient-to-br from-white to-indigo-50/90 p-5 text-left shadow-md transition hover:border-indigo-400 hover:shadow-lg"
                  onClick={() => (showCabinetGrid ? setRoleOnUrl("PARTNER") : pickModalCabinet("PARTNER"))}
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Партнёр</span>
                  <span className="mt-2 block text-lg font-bold text-slate-900">Кабинет организации</span>
                  <span className="mt-1 block text-sm text-slate-600">Публиковать брифы и вести точку.</span>
                </button>
              </div>
            </div>
          ) : null}

          {showAuthModeToggle && (
            <div className="mt-5 inline-flex rounded-full border border-slate-200/80 bg-slate-50/80 p-1 text-sm shadow-inner">
              <button
                type="button"
                className={`rounded-full px-4 py-2 font-semibold transition-all ${mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                onClick={() => {
                  setMode("login");
                  setRegFieldErr({});
                  setError("");
                }}
              >
                Вход
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 font-semibold transition-all ${mode === "register" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                onClick={() => {
                  setMode("register");
                  setRegFieldErr({});
                  setError("");
                  setLastDiag(null);
                }}
              >
                Регистрация
              </button>
            </div>
          )}

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            {mode === "register" && !isSuperCabinet && !canRegister ? (
              <p className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                Сначала выберите кабинет крупными кнопками выше — «Пользователь» или «Партнёр» — затем заполните поля регистрации.
              </p>
            ) : null}
            {mode === "register" && canRegister && (
              <>
                {roleParam === "PARTNER" ? (
                  <>
                    <div className="space-y-1">
                      <input
                        className={`input-cs ${regFieldErr.company ? "ring-2 ring-rose-400/60" : ""}`}
                        placeholder="Название компании"
                        value={companyName}
                        onChange={(e) => {
                          setCompanyName(e.target.value);
                          patchRegFieldErr("company", undefined);
                        }}
                        autoComplete="organization"
                      />
                      <p className="text-xs text-slate-500">Как в договоре или на вывеске — так вас увидят пользователи.</p>
                      {regFieldErr.company ? (
                        <p className="text-xs font-medium text-rose-600">{regFieldErr.company}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-600">
                        Город
                        <select
                          className={`input-cs mt-1 ${regFieldErr.city ? "ring-2 ring-rose-400/60" : ""}`}
                          value={partnerCity}
                          onChange={(e) => {
                            setPartnerCity(e.target.value);
                            patchRegFieldErr("city", undefined);
                          }}
                          autoComplete="address-level1"
                        >
                          <option value="">— Выберите город —</option>
                          {partnerRegistrationCities.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          <option value={PARTNER_CITY_OTHER}>Другой город…</option>
                        </select>
                      </label>
                      <p className="text-xs text-slate-500">Нужен для подбора «партнёры рядом».</p>
                      {regFieldErr.city && partnerCity !== PARTNER_CITY_OTHER ? (
                        <p className="text-xs font-medium text-rose-600">{regFieldErr.city}</p>
                      ) : null}
                    </div>
                    {partnerCity === PARTNER_CITY_OTHER ? (
                      <div className="space-y-1">
                        <input
                          className={`input-cs ${regFieldErr.city ? "ring-2 ring-rose-400/60" : ""}`}
                          placeholder="Название города"
                          value={partnerCityCustom}
                          onChange={(e) => {
                            setPartnerCityCustom(e.target.value);
                            patchRegFieldErr("city", undefined);
                          }}
                        />
                        {regFieldErr.city ? (
                          <p className="text-xs font-medium text-rose-600">{regFieldErr.city}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-1">
                    <input
                      className={`input-cs ${regFieldErr.name ? "ring-2 ring-rose-400/60" : ""}`}
                      placeholder="Имя"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        patchRegFieldErr("name", undefined);
                      }}
                      autoComplete="given-name"
                    />
                    <p className="text-xs text-slate-500">Как к вам обращаться в сервисе.</p>
                    {regFieldErr.name ? (
                      <p className="text-xs font-medium text-rose-600">{regFieldErr.name}</p>
                    ) : null}
                  </div>
                )}
                {roleParam === "PARTNER" && (
                  <div className="space-y-1">
                    <input
                      className={`input-cs ${regFieldErr.name ? "ring-2 ring-rose-400/60" : ""}`}
                      placeholder="Имя контакта (необязательно)"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        patchRegFieldErr("name", undefined);
                      }}
                      autoComplete="name"
                    />
                    {regFieldErr.name ? (
                      <p className="text-xs font-medium text-rose-600">{regFieldErr.name}</p>
                    ) : null}
                  </div>
                )}
              </>
            )}
            <div className="space-y-1">
              <input
                className={`input-cs ${regFieldErr.login ? "ring-2 ring-rose-400/60" : ""}`}
                placeholder={
                  isSuperCabinet && mode === "login"
                    ? "clientsay@mail.ru"
                    : mode === "register"
                      ? "Email (с @) или телефон — 10 цифр"
                      : "Email (с @) или телефон (от 10 цифр)"
                }
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  patchRegFieldErr("login", undefined);
                }}
                autoComplete="username"
              />
              {mode === "register" && !isSuperCabinet && canRegister ? (
                <>
                  <p className="text-xs text-slate-500">
                    {identifier.trim().includes("@")
                      ? "Этот email будет логином для входа."
                      : "Телефон РФ: 10 цифр номера (можно с 8 или +7)."}
                  </p>
                  {registerLoginPreview ? (
                    <p className="text-xs font-medium text-emerald-700">Сохраним в базе как: {registerLoginPreview}</p>
                  ) : null}
                </>
              ) : null}
              {regFieldErr.login ? (
                <p className="text-xs font-medium text-rose-600">{regFieldErr.login}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <input
                type="password"
                className={`input-cs ${regFieldErr.password ? "ring-2 ring-rose-400/60" : ""}`}
                placeholder="Пароль"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  patchRegFieldErr("password", undefined);
                }}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
              {mode === "register" && !isSuperCabinet && canRegister ? (
                <p className="text-xs text-slate-500">Минимум 6 символов.</p>
              ) : null}
              {regFieldErr.password ? (
                <p className="text-xs font-medium text-rose-600">{regFieldErr.password}</p>
              ) : null}
            </div>
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            {lastDiag ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-600" title="Ответ сервера">
                {lastDiag}
              </p>
            ) : null}
            {error &&
              (error.includes("База данных") ||
                error.includes("DATABASE_URL") ||
                error.includes("Vercel") ||
                error.includes("PostgreSQL") ||
                error.includes("/api/health") ||
                error.includes("AUTH_SECRET") ||
                error.includes("Ошибка сервера") ||
                error.includes("Сервис временно")) && (
                <div className="rounded-xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
                  <p className="font-semibold text-amber-900">Почему так, если prisma на ПК уже «ок»?</p>
                  <p className="mt-1">
                    Форма шлёт запрос на <strong className="text-slate-900">{origin || "этот сайт"}</strong> — база должна быть
                    настроена <em>там</em>. Команды <code className="rounded bg-white/80 px-1">db:push</code> /{" "}
                    <code className="rounded bg-white/80 px-1">db:seed</code> у вас в терминале настраивают только ту БД,
                    что в <strong className="text-slate-900">локальном</strong> <code className="rounded bg-white/80 px-1">.env</code>{" "}
                    (обычно <code className="rounded bg-white/80 px-1">localhost</code>).
                  </p>
                  <p className="mt-2">
                    Локальная проверка: запустите <code className="rounded bg-white/80 px-1">npm run dev</code> и откройте{" "}
                    <strong className="text-slate-900">http://localhost:3000</strong> (и поднимите Postgres, например{" "}
                    <code className="rounded bg-white/80 px-1">npm run db:docker</code>).
                  </p>
                  <p className="mt-2">
                    Диагностика на <em>этом</em> домене:{" "}
                    <Link href="/api/health" className="font-semibold text-violet-700 underline">
                      /api/health
                    </Link>{" "}
                    — должно быть <code className="rounded bg-white/80 px-1">&quot;db&quot;:&quot;up&quot;</code>.
                  </p>
                </div>
              )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/35 disabled:opacity-60"
            >
              {busy
                ? "Подождите…"
                : mode === "register" && !isSuperCabinet
                  ? "Зарегистрироваться"
                  : "Войти"}
            </button>
          </form>

          <div className="mt-4 rounded-xl border border-dashed border-slate-300/90 bg-slate-50/90 px-3 py-2 text-center">
            <p className="font-mono text-[10px] leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-700">Сборка (сервер HTML):</span> {serverBuildLabel ?? "—"}
              <br />
              <span className="font-semibold text-slate-700">Сборка (GET /api/deploy-meta):</span> {apiBuildLabel ?? "…"}
            </p>
            {serverBuildLabel && apiBuildLabel && serverBuildLabel !== apiBuildLabel ? (
              <p className="mt-1 text-[10px] font-medium text-amber-900">
                Версии разошлись — сделайте жёсткое обновление (Ctrl+Shift+R). Если не поможет, на CDN/nginx отключите кэш для
                HTML и пути /sign-in.
              </p>
            ) : null}
            {!serverBuildLabel && apiBuildLabel ? (
              <p className="mt-1 text-[10px] text-slate-500">Модальное окно: ориентируйтесь на строку с API.</p>
            ) : null}
          </div>

          {demoHint && process.env.NODE_ENV === "development" && (
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
              {isSuperCabinet ? "Демо владелец: " : "После db:seed: "}
              {demoHint.login} / {demoHint.password}
            </p>
          )}
        </section>
  );

  if (hideChrome) {
    return (
      <div className="w-full">
        {inner}
        {onRequestClose ? (
          <p className="mt-3 text-center text-xs text-slate-500">
            <button type="button" onClick={onRequestClose} className="font-semibold text-violet-700 hover:underline">
              Закрыть окно
            </button>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-white/40 bg-white/60 px-5 py-3 backdrop-blur-md md:px-8">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            href="/"
            className="font-brand-logo bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-lg tracking-tight text-transparent"
          >
            {BRAND_NAME}
          </Link>
          <Link href="/" className="text-xs font-semibold text-slate-600 hover:text-violet-700">
            ← На главную
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-5 py-10 md:py-14">
        {inner}

        <p className="text-center text-xs text-slate-600">
          <Link href="/" className="font-semibold text-violet-700 hover:underline">
            На главную
          </Link>
          {roleParam && (
            <>
              {" · "}
              <span className="text-slate-500">далее {cabinetPath(roleParam)}</span>
            </>
          )}
        </p>
      </main>
    </>
  );
}
