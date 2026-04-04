"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import type { SessionRole } from "@/lib/auth-session";
import { demoAuth } from "@/lib/mock-data";
import { cabinetPath, parseSessionRole, resolvePostLoginRedirect } from "@/lib/auth-routes";
import { BRAND_NAME } from "@/lib/brand";
import { PARTNER_CITY_OTHER, partnerRegistrationCities } from "@/lib/site-config";

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

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const roleParam = parseSessionRole(searchParams.get("role"));
  const reason = searchParams.get("reason");

  const isSuperCabinet = roleParam === "SUPER_ADMIN";
  const canRegister = roleParam === "PARTNER" || roleParam === "USER";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [partnerCity, setPartnerCity] = useState("");
  const [partnerCityCustom, setPartnerCityCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(() => {
    if (!roleParam) return `Вход в ${BRAND_NAME}`;
    return `Вход для ${ROLE_LABEL[roleParam]}`;
  }, [roleParam]);

  const demoHint = hintForRole(roleParam);

  const redirectAfterAuth = useCallback(
    (userRole: SessionRole) => {
      const target = resolvePostLoginRedirect(next, userRole);
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

  async function logoutHere() {
    setBusy(true);
    setError("");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      const q = new URLSearchParams();
      if (next) q.set("next", next);
      if (roleParam) q.set("role", roleParam);
      const suffix = q.toString();
      router.replace(suffix ? `/sign-in?${suffix}` : "/sign-in");
      router.refresh();
    } finally {
      setBusy(false);
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
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
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
      if (data?.role) redirectAfterAuth(data.role);
    } catch {
      setError("Сеть недоступна. Попробуйте снова.");
    } finally {
      setBusy(false);
    }
  }

  async function onRegister() {
    setError("");
    if (!canRegister || !roleParam) return;
    const id = identifier.trim();
    const pass = password.trim();
    if (!id || !pass || pass.length < 6) {
      setError("Минимум 6 символов в пароле и непустой логин.");
      return;
    }

    setBusy(true);
    try {
      if (roleParam === "USER") {
        if (!name.trim()) {
          setError("Укажите имя.");
          setBusy(false);
          return;
        }
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "USER",
            login: id,
            password: pass,
            firstName: name.trim(),
          }),
        });
        const data = await readApiResponse<{ ok?: boolean; role?: SessionRole; error?: { message?: string } }>(res);
        if (!res.ok) {
          setError(data?.error?.message ?? "Регистрация не удалась.");
          return;
        }
        if (data?.role) redirectAfterAuth(data.role);
        return;
      }

      if (!companyName.trim()) {
        setError("Укажите название компании.");
        setBusy(false);
        return;
      }
      const resolvedCity =
        partnerCity === PARTNER_CITY_OTHER ? partnerCityCustom.trim() : partnerCity.trim();
      if (!partnerCity || !resolvedCity) {
        setError("Выберите город из списка или укажите название в поле «Другой город».");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "PARTNER",
          login: id,
          password: pass,
          companyName: companyName.trim(),
          city: resolvedCity,
          firstName: name.trim() || "Партнёр",
        }),
      });
      const data = await readApiResponse<{ ok?: boolean; role?: SessionRole; error?: { message?: string } }>(res);
      if (!res.ok) {
        setError(data?.error?.message ?? "Регистрация не удалась.");
        return;
      }
      if (data?.role) redirectAfterAuth(data.role);
    } catch {
      setError("Сеть недоступна. Попробуйте снова.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "register" && canRegister) void onRegister();
    else void onLogin();
  }

  return (
    <>
      <header className="border-b border-white/40 bg-white/60 px-5 py-3 backdrop-blur-md md:px-8">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/" className="text-lg font-black tracking-tight text-transparent bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text">
            {BRAND_NAME}
          </Link>
          <Link href="/" className="text-xs font-semibold text-slate-600 hover:text-violet-700">
            ← На главную
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-5 py-10 md:py-14">
        <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-violet-900/5 backdrop-blur-md md:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Безопасный вход</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {roleParam == null
              ? "Войдите учётной записью из базы (после db:seed) или откройте нужный кабинет с главной — откроется вход с проверкой роли."
              : "Сессия в защищённой cookie. После входа вы вернётесь в запрошенный раздел."}
          </p>

          {reason === "wrong_role" && (
            <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <span>Вы вошли под другой ролью. Выйдите и войдите нужной учёткой.</span>
              <button
                type="button"
                disabled={busy}
                onClick={logoutHere}
                className="shrink-0 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              >
                Выйти из сессии
              </button>
            </div>
          )}

          {canRegister && (
            <div className="mt-5 inline-flex rounded-full border border-slate-200/80 bg-slate-50/80 p-1 text-sm shadow-inner">
              <button
                type="button"
                className={`rounded-full px-4 py-2 font-semibold transition-all ${mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                onClick={() => setMode("login")}
              >
                Вход
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 font-semibold transition-all ${mode === "register" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                onClick={() => setMode("register")}
              >
                Регистрация
              </button>
            </div>
          )}

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            {mode === "register" && canRegister && (
              <>
                {roleParam === "PARTNER" ? (
                  <>
                    <input
                      className="input-cs"
                      placeholder="Название компании"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      autoComplete="organization"
                    />
                    <label className="block text-xs font-medium text-slate-600">
                      Город
                      <select
                        className="input-cs mt-1"
                        value={partnerCity}
                        onChange={(e) => setPartnerCity(e.target.value)}
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
                    {partnerCity === PARTNER_CITY_OTHER ? (
                      <input
                        className="input-cs"
                        placeholder="Название города"
                        value={partnerCityCustom}
                        onChange={(e) => setPartnerCityCustom(e.target.value)}
                      />
                    ) : null}
                  </>
                ) : (
                  <input
                    className="input-cs"
                    placeholder="Имя"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="given-name"
                  />
                )}
                {roleParam === "PARTNER" && (
                  <input
                    className="input-cs"
                    placeholder="Имя контакта (необязательно)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                )}
              </>
            )}
            <input
              className="input-cs"
              placeholder="Email или телефон"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
            />
            <input
              type="password"
              className="input-cs"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/35 disabled:opacity-60"
            >
              {busy ? "Подождите…" : mode === "register" && canRegister ? "Зарегистрироваться" : "Войти"}
            </button>
          </form>

          {demoHint && process.env.NODE_ENV === "development" && (
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
              {isSuperCabinet ? "Демо владелец: " : "После db:seed: "}
              {demoHint.login} / {demoHint.password}
            </p>
          )}
        </section>

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
