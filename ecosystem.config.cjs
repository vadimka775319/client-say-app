/**
 * PM2: cwd = корень репозитория; старт через scripts/start-prod.cjs — явная загрузка .env до next start.
 */
module.exports = {
  apps: [
    {
      name: "client-say-app",
      cwd: __dirname,
      script: "scripts/start-prod.cjs",
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
    },
  ],
};
