"use client";

import { useMemo, useState, type ReactNode } from "react";
import { demoAuth } from "@/lib/mock-data";

type GateRole = "super_admin" | "partner" | "user";
type Session = { role: GateRole; identifier: string; at: number };
type StoredAccount = {
  identifier: string;
  password: string;
  name?: string;
  companyName?: string;
};

function getAccounts(role: GateRole): StoredAccount[] {
  try {
    const raw = localStorage.getItem(`clientsay_accounts_${role}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setAccounts(role: GateRole, accounts: StoredAccount[]) {
  localStorage.setItem(`clientsay_accounts_${role}`, JSON.stringify(accounts));
}

export function RoleGate({ role, title, children }: { role: GateRole; title: string; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const isAllowed = useMemo(() => session?.role === role, [session, role]);

  function login() {
    setError("");
    const id = identifier.trim();
    const pass = password.trim();
    if (!id || !pass) return setError("Введите email/телефон и пароль.");

    const creds = demoAuth[role];
    const localAccounts = getAccounts(role);
    const matched = localAccounts.find((x) => x.identifier === id && x.password === pass);
    if (matched) {
      const s = { role, identifier: id, at: Date.now() } as Session;
      setSession(s);
      return;
    }
    if (id === creds.login && pass === creds.password) {
      const s = { role, identifier: id, at: Date.now() } as Session;
      setSession(s);
      return;
    }
    setError("Неверные данные для входа.");
  }

  function register() {
    setError("");
    if (role === "super_admin") return;
    const id = identifier.trim();
    const pass = password.trim();
    if (role === "partner") {
      if (!name.trim() || !id || !pass) return setError("Заполните название компании, логин и пароль.");
      localStorage.setItem(
        "clientsay_partner_profile",
        JSON.stringify({ companyName: name.trim(), locations: 0, reviewsCount: 0, rating: 0 }),
      );
      const all = getAccounts(role);
      if (all.some((x) => x.identifier === id)) return setError("Такой логин уже зарегистрирован.");
      setAccounts(role, [...all, { companyName: name.trim(), identifier: id, password: pass }]);
    } else {
      if (!name.trim() || !id || !pass) return setError("Заполните имя, email или телефон, и пароль.");
      const all = getAccounts(role);
      if (all.some((x) => x.identifier === id)) return setError("Такой логин уже зарегистрирован.");
      setAccounts(role, [...all, { name: name.trim(), identifier: id, password: pass }]);
    }

    const s = { role, identifier: id, at: Date.now() } as Session;
    setSession(s);
  }

  function logout() {
    setSession(null);
    setIdentifier("");
    setPassword("");
    setError("");
  }

  if (isAllowed) {
    return (
      <>
        <AuthTopBar logout={logout} />
        {children}
      </>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-violet-600">{title}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {role === "super_admin" ? "Вход в SuperAdmin" : "Войдите в кабинет"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {role === "super_admin" ? "Доступ только для администратора." : "Сначала войдите или зарегистрируйтесь."}
        </p>

        {role !== "super_admin" && (
          <div className="mt-4 inline-flex rounded-lg border border-slate-200 p-1 text-sm">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 ${tab === "login" ? "bg-slate-900 text-white" : "text-slate-600"}`}
              onClick={() => setTab("login")}
            >
              Вход
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 ${tab === "register" ? "bg-slate-900 text-white" : "text-slate-600"}`}
              onClick={() => setTab("register")}
            >
              Регистрация
            </button>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {tab === "register" && role !== "super_admin" && (
            <>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder={role === "partner" ? "Название компании" : "Имя"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {role === "partner" && (
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Телефон (необязательно)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              )}
            </>
          )}
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Email или телефон" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <input type="password" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button
            type="button"
            onClick={tab === "register" && role !== "super_admin" ? register : login}
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white"
          >
            {tab === "register" && role !== "super_admin" ? "Зарегистрироваться" : "Войти"}
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Демо: {demoAuth[role].login} / {demoAuth[role].password}
        </p>
      </section>
    </main>
  );
}

function AuthTopBar({
  logout,
}: {
  logout: () => void;
}) {
  return (
    <div className="mx-auto mt-6 flex w-full max-w-6xl items-center justify-end px-5 md:px-8">
      <button
        type="button"
        onClick={logout}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Выйти
      </button>
    </div>
  );
}
