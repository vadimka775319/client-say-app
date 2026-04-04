"use client";

import { useEffect, useState } from "react";

export default function HealthCheckPage() {
  const [body, setBody] = useState("Загрузка…");

  useEffect(() => {
    void fetch("/api/health", { cache: "no-store", credentials: "omit" })
      .then((r) => r.text())
      .then(setBody)
      .catch(() => setBody("Не удалось запросить /api/health"));
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-bold">Проверка: вы на нужном сайте?</h1>
        <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Как правильно открывать адрес</p>
          <p>
            В адресной строке обязательно должны быть <strong>https://</strong> и <strong>полный домен</strong> (как у
            вашего сайта в интернете), например:
          </p>
          <code className="block rounded bg-white px-2 py-2 text-xs">
            https://ваш-домен.ru/health
          </code>
          <p className="text-xs">
            Неправильно: <code className="bg-red-100 px-1">clientsay/api/health</code> — без протокола и зоны (.ru и т.д.)
            браузер не знает, куда идти → ошибка DNS (NXDOMAIN).
          </p>
        </div>
        <p className="mt-6 text-sm font-medium text-slate-600">Ответ сервера GET /api/health (сырой JSON):</p>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs shadow-sm">
          {body}
        </pre>
        <p className="mt-4 text-xs text-slate-500">
          Надёжная ссылка без статики:{" "}
          <a href="/api/deploy-meta" className="font-semibold text-violet-700 underline">
            /api/deploy-meta
          </a>
          . Поле <code className="rounded bg-slate-200 px-1">source</code>: <strong>file</strong> — из{" "}
          <code className="rounded bg-slate-200 px-1">public/deploy-meta.json</code>, <strong>git</strong> — из{" "}
          <code className="rounded bg-slate-200 px-1">git rev-parse</code> в каталоге приложения на сервере (если есть .git).
        </p>
      </div>
    </main>
  );
}
