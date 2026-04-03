import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Вход — ClientSay",
  description: "Вход в кабинет ClientSay",
};

export default function SignInLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-gradient-to-b from-sky-100/90 via-violet-50/50 to-[var(--background)]">
      <div
        className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-violet-200/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-1 flex-col">{children}</div>
    </div>
  );
}
