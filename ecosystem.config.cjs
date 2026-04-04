/**
 * PM2: рабочая директория = корень репозитория, чтобы Next.js подхватил `.env` и Prisma видел DATABASE_URL.
 */
module.exports = {
  apps: [
    {
      name: "client-say-app",
      cwd: __dirname,
      script: "npm",
      args: "run start",
      interpreter: "none",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
    },
  ],
};
