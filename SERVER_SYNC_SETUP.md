# Настройка Cursor и автодеплоя на сервер

Ниже минимальная конфигурация, чтобы изменения из проекта быстро попадали на сервер.

## 1) Что настроить в Cursor для 100% работы

- Открыть именно корень проекта: `D:\Client Say\client-say\client-say-app`
- Разрешить агенту:
  - чтение/запись файлов проекта;
  - запуск терминала;
  - установку зависимостей и запуск команд `build/test/lint`.
- Убедиться, что установлен Node.js LTS (`node -v`, `npm -v`).

## 2) Подключение к серверу по SSH

В PowerShell:

```powershell
ssh user@SERVER_IP
```

Опционально через `C:\Users\Irkutsk\.ssh\config`:

```sshconfig
Host clientsay-prod
  HostName SERVER_IP
  User deploy
  Port 22
  IdentityFile C:/Users/Irkutsk/.ssh/id_ed25519
```

Тогда вход:

```powershell
ssh clientsay-prod
```

## 3) Режим "изменения сразу на сервер" (рекомендуемый)

Самый надежный и простой способ: деплой по Git push (CI/CD).

### Вариант A: Vercel (самый быстрый)

1. Создайте репозиторий на GitHub.
2. Залейте проект.
3. Подключите репозиторий в Vercel.
4. При каждом push в `main` Vercel автоматически обновляет сайт.

Плюс: не нужен ручной деплой.

### Вариант B: VPS + GitHub Actions + PM2

Логика:
- Вы пушите в `main`.
- GitHub Actions подключается по SSH на сервер.
- Выполняет `git pull`, `npm install`, `npm run build`, `pm2 restart`.

Это и есть "автоматически в online режиме".

## 4) Пример команд для сервера (один раз)

```bash
mkdir -p /var/www/client-say
cd /var/www/client-say
git clone <your-repo-url> .
npm install
npm run build
pm2 start npm --name client-say -- start
pm2 save
```

## 5) Что выбрать прямо сейчас

- Если нужен запуск за 1 день: **Vercel**.
- Если нужен ваш собственный сервер: **VPS + PM2 + GitHub Actions**.

## 6) Важно

- Не подключайте root-доступ для ежедневных деплоев.
- Используйте отдельного deploy-пользователя.
- Добавьте бэкап БД перед автодеплоем после подключения реальной базы.
