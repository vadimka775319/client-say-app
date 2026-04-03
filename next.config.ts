import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Каталог этого приложения (не родительский C:\\Users\\user с чужим lockfile). */
const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: appDir,
  },
};

export default nextConfig;
