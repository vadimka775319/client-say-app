# Client Say (Clearance A)

Платформа для сбора отзывов через QR-коды с бонусами/призами для пользователей.

## Что уже реализовано в каркасе

- Роли и отдельные кабинеты:
  - `/admin` — супер-админ (партнеры, пользователи, баллы, призы)
  - `/partner` — партнер (брифы, QR-логика, награды, аналитика)
  - `/user` — пользователь (баланс, профиль, обмен баллов на призы)
- Тарифная модель:
  - Trial 3 месяца
  - 1090 RUB/месяц (базовый)
  - 6 месяцев: 5230 RUB (-20%)
  - 12 месяцев: 7850 RUB (-40%)
- Правила призов:
  - лимит остатков
  - таймер начала/конца акции
  - автоматический переход в недоступные
- Антифрод и экономика (см. `economyRules` в `mock-data`):
  - не чаще 1 брифа у одной компании на пользователя за 30 дней
  - до 10 вопросов в брифе → 25 б.; 11–20 вопросов → 50 б.
  - типы вопросов: текст, оценка 1–5, выбор из вариантов

## Быстрый запуск

```bash
npm install
```

Создайте `.env` (иначе Prisma выдаст `P1012 Environment variable not found: DATABASE_URL`):

```bash
npm run env:init
```

Либо в PowerShell: `Copy-Item .env.example .env`

Отредактируйте `.env`: укажите рабочий `DATABASE_URL` к PostgreSQL и в продакшене — длинный `AUTH_SECRET` (≥32 символов).

Поднимите PostgreSQL и примените схему + демо-пользователей.

**Вариант A — Docker** (если установлен Docker Desktop):

```bash
npm run db:docker
npm run db:push
npm run db:seed
```

После обновления схемы (новые таблицы в `prisma/schema.prisma`) снова выполните `npm run db:push` и при необходимости `npm run db:seed` — в том числе для строки публичных контактов `SitePublicConfig` (футер на главной).

**Вариант B — свой Postgres на Windows:** создайте БД `client_say`, пользователя и пароль как в `.env`, затем:

```bash
npm run db:push
npm run db:seed
```

Если видите `P1001` / `Can't reach database server` — сервер не запущен или неверный `DATABASE_URL` в `.env`. Остановить контейнер: `npm run db:docker:down`.

```bash
npm run dev
```

Откройте `http://localhost:3000`. Кабинеты `/admin`, `/partner`, `/user` доступны только после входа: при переходе откроется `/sign-in` с проверкой роли на уровне middleware и httpOnly-сессии (JWT).

Демо-логины после сида совпадают с подсказками в `src/lib/mock-data.ts` (`owner@…`, `partner@…`, `user@…`).

## Структура

- `src/app/page.tsx` — главная (продуктовый каркас)
- `src/app/sign-in/` — общий экран входа и регистрации (партнёр/пользователь)
- `src/app/api/auth/` — вход, выход, регистрация в БД + httpOnly JWT
- `src/app/components/cabinet-shell.tsx` — общая шапка кабинетов (навигация, выход)
- `src/proxy.ts` — защита кабинетов по роли до отдачи страницы (Next.js 16: бывший `middleware`)
- `.github/workflows/deploy.yml` — CI (lint, typecheck, build), деплой на VPS по push в `main`, на сервере проверка `127.0.0.1/api/health`; опционально секрет **`PUBLIC_SITE_URL`** (`https://ваш-домен.ru`) — после деплоя GitHub запросит с интернета `/api/health` и упадёт, если сайт или БД недоступны снаружи
- `src/app/admin/page.tsx` — супер-админ
- `src/app/partner/page.tsx` — партнер
- `src/app/user/page.tsx` — пользователь
- `src/lib/mock-data.ts` — демо-данные и бизнес-правила
- `SERVER_SYNC_SETUP.md` — как настроить автодеплой на сервер

## Следующий этап (чтобы стать production-ready)

- Перенести продуктовые сущности с `mock-data` на Prisma и единый API
- Усилить auth (восстановление пароля, аудит сессий, политика cookie в API)
- Реальные API для:
  - сканирования QR,
  - отправки брифа,
  - транзакций баллов,
  - редемпшена призов
- Платежи партнеров (например, YooKassa/Stripe)
- Фоновые задачи (таймеры, уведомления, истечение призов)
