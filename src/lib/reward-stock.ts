import type { Reward } from "@/lib/mock-data";
import { readPartnerUploadedRewards, writePartnerUploadedRewards } from "@/lib/partner-uploaded-rewards";

const SEED_STOCK_KEY = "clientsay_seed_reward_stock";

export function getEffectiveStockLeft(r: Reward): number {
  if (typeof window === "undefined") return r.stockLeft;
  if (r.id.startsWith("pr-cabinet-")) {
    const list = readPartnerUploadedRewards();
    const found = list.find((x) => x.id === r.id);
    return found?.stockLeft ?? r.stockLeft;
  }
  try {
    const raw = localStorage.getItem(SEED_STOCK_KEY);
    if (!raw) return r.stockLeft;
    const m = JSON.parse(raw) as Record<string, unknown>;
    const v = m[r.id];
    if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  } catch {
    // no-op
  }
  return r.stockLeft;
}

export function decrementStockAfterRedeem(r: Reward): void {
  if (typeof window === "undefined") return;
  if (r.id.startsWith("pr-cabinet-")) {
    const list = readPartnerUploadedRewards();
    const next = list.map((x) => (x.id === r.id ? { ...x, stockLeft: Math.max(0, x.stockLeft - 1) } : x));
    writePartnerUploadedRewards(next);
    window.dispatchEvent(new Event("clientsay-partner-rewards-changed"));
    return;
  }
  try {
    const raw = localStorage.getItem(SEED_STOCK_KEY);
    const m: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const cur = typeof m[r.id] === "number" ? m[r.id] : r.stockLeft;
    m[r.id] = Math.max(0, cur - 1);
    localStorage.setItem(SEED_STOCK_KEY, JSON.stringify(m));
  } catch {
    // no-op
  }
}
