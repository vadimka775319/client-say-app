# Структура проекта client-say-app

Цель: один понятный каркас, чтобы деплой (GitHub → VPS) и правки не ломали окружение.

## Стек (зафиксировано)

| Слой | Технология |
|------|------------|
| Фреймворк | Next.js 16 (App Router), React 19 |
| API | Route Handlers в `src/app/api/**` |
| БД | PostgreSQL + Prisma ORM |
| Аутентификация | JWT в httpOnly cookie (`jose`), `AUTH_SECRET` ≥ 32 символов |
| Прод-процесс | PM2 + `ecosystem.config.cjs` → `scripts/start-prod.cjs` (загрузка `.env` до `next start`) |
| БД в Docker | `docker-compose.yml` сервис `db`, порт `5432` на хост |

Миграция на другой бэкенд «вместо Next API» не заложена в текущую кодовую базу; смена стека — отдельный проект.

## Каталоги

```
src/app/                 # Маршруты и UI
  api/                   # REST-подобные эндпоинты (auth, health, partner, user, site)
  admin/                 # Супер-админ (клиентский UI + mock-таблицы; публичные настройки — БД)
  partner/               # Кабинет партнёра
  user/                  # Кабинет пользователя
  sign-in/               # Вход / регистрация
  components/            # Общие компоненты (CabinetShell, AuthModal, …)
src/lib/                 # Серверная логика, Prisma, auth, настройки сайта
prisma/                  # schema.prisma, seed
scripts/                 # Сборка, деплой-обвязка, VPS PowerShell
.github/workflows/       # CI + SSH-деплой на VPS
```

## Переменные окружения (прод)

- `DATABASE_URL` — строка PostgreSQL (на VPS обычно `127.0.0.1:5432` к Docker).
- `AUTH_SECRET` — минимум 32 символа.
- `NEXT_PUBLIC_APP_URL` — публичный URL сайта (QR/абсолютные ссылки).

Файл `.env` на сервере должен совпадать с тем, откуда стартует PM2 (`cwd` в `ecosystem.config.cjs`).

## Деплой

1. **Автоматически:** push в `main` → `verify` (lint, typecheck, build) → `deploy` (SSH на VPS, `git pull`, `npm ci`, `prisma db push`, `db:seed`, `build`, `pm2 reload`).
2. **Вручную:** SSH на VPS, `cd` в каталог приложения, те же шаги или `npm run vps:db` / диагностика с ПК: `npm run vps:diag`.

Секреты GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, опционально `VPS_APP_DIR`, `PUBLIC_SITE_URL`.

## Проверка после выката

- `GET /api/health` — `ok`, `db: up`.
- С ПК: `npm run prod:health` (из корня репозитория).

## Пароль PostgreSQL и том Docker

Пароль задаётся при **первой** инициализации тома. Смена `POSTGRES_PASSWORD` в `docker-compose.yml` не меняет уже созданный том. При рассинхроне с `DATABASE_URL`: `ALTER USER postgres WITH PASSWORD '…'` под пользователем с доступом в контейнер.

При каждом деплое через GitHub Actions после `docker compose up -d db` выполняется **`ALTER USER postgres WITH PASSWORD 'postgres'`**, чтобы совпасть с `POSTGRES_PASSWORD` из `docker-compose.yml` и с типовым `DATABASE_URL` в `.env`.

### Как понять, какая версия API на проде

Ответ **`GET /api/health`** в актуальной сборке при ошибке БД содержит поля **`hintEn`**, **`errorCode`**, **`deploy`**. Если их нет — отдаётся **старая** версия приложения (не тот процесс PM2, не тот порт в nginx или деплой не дошёл).
