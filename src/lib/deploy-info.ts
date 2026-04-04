import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type DeployInfoSource = "file" | "git" | "env" | "none";

export type DeployInfo = {
  gitShort: string | null;
  deployedAt: string | null;
  source: DeployInfoSource;
};

/**
 * Версия деплоя: файл (после write-deploy-meta), иначе git в каталоге приложения (на VPS есть .git),
 * иначе переменные окружения.
 */
export function getDeployInfo(): DeployInfo {
  try {
    const p = join(process.cwd(), "public", "deploy-meta.json");
    if (existsSync(p)) {
      const j = JSON.parse(readFileSync(p, "utf8")) as { gitShort?: string; deployedAt?: string };
      return {
        gitShort: j.gitShort ?? null,
        deployedAt: j.deployedAt ?? null,
        source: "file",
      };
    }
  } catch {
    // дальше fallback
  }

  try {
    const sha = execSync("git rev-parse --short HEAD", {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (sha && /^[0-9a-f]+$/i.test(sha)) {
      return { gitShort: sha, deployedAt: null, source: "git" };
    }
  } catch {
    // нет git / не репозиторий
  }

  const gitShort = process.env.DEPLOY_GIT_SHA?.replace(/^"|"$/g, "") ?? null;
  const deployedAt = process.env.DEPLOYED_AT?.replace(/^"|"$/g, "") ?? null;
  if (gitShort || deployedAt) {
    return { gitShort, deployedAt, source: "env" };
  }
  return { gitShort: null, deployedAt: null, source: "none" };
}
