import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Каталог этого приложения (не родительский C:\\Users\\user с чужим lockfile). */
const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: appDir,
  },
  /** Статический путь без файла в public → отдаём через API (и nginx не режет до Node). */
  async rewrites() {
    return [
      { source: "/deploy-meta.json", destination: "/api/site/deploy-meta" },
    ];
  },
  /** Снимаем отдачу старого HTML из nginx/CDN для кабинетов и входа */
  async headers() {
    const noStore = "private, no-store, must-revalidate";
    return [
      { source: "/", headers: [{ key: "Cache-Control", value: noStore }] },
      { source: "/brief/:path*", headers: [{ key: "Cache-Control", value: noStore }] },
      { source: "/partner", headers: [{ key: "Cache-Control", value: noStore }] },
      { source: "/partner/:path*", headers: [{ key: "Cache-Control", value: noStore }] },
      { source: "/user", headers: [{ key: "Cache-Control", value: noStore }] },
      { source: "/user/:path*", headers: [{ key: "Cache-Control", value: noStore }] },
      { source: "/sign-in", headers: [{ key: "Cache-Control", value: noStore }] },
      { source: "/sign-in/:path*", headers: [{ key: "Cache-Control", value: noStore }] },
      { source: "/admin", headers: [{ key: "Cache-Control", value: noStore }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: noStore }] },
      { source: "/api/health", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] },
      { source: "/api/deploy-meta", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] },
      { source: "/api/site/deploy-meta", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] },
      { source: "/health", headers: [{ key: "Cache-Control", value: "private, no-store, must-revalidate" }] },
      { source: "/deploy-meta.json", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
