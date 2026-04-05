"use client";

import { Suspense, useEffect } from "react";
import SignInForm from "@/app/sign-in/sign-in-form";
import type { SessionRole } from "@/lib/auth-session";

export type HomeAuthRole = "PARTNER" | "USER" | "GENERAL";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  /** Какой режим входа подсветить при открытии */
  initialMode: HomeAuthRole;
};

function roleForForm(mode: HomeAuthRole): SessionRole | null {
  if (mode === "PARTNER") return "PARTNER";
  if (mode === "USER") return "USER";
  return null;
}

export function AuthModal({ open, onClose, initialMode }: AuthModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12 sm:items-center sm:pt-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Закрыть окно"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--background)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
          <p id="auth-modal-title" className="text-sm font-bold text-slate-800">
            Вход или регистрация
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Закрыть
          </button>
        </div>
        <div className="max-h-[min(80vh,720px)] overflow-y-auto px-2 pb-4 pt-2">
          <Suspense fallback={<p className="p-6 text-sm text-slate-600">Загрузка формы…</p>}>
            <SignInForm
              embeddedRole={roleForForm(initialMode)}
              hideChrome
              onRequestClose={onClose}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
