const POOL_KEY = "clientsay_reward_redemption_pools";

type Pools = Record<string, string[]>;

function readPools(): Pools {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(POOL_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return {};
    return p as Pools;
  } catch {
    return {};
  }
}

function writePools(pools: Pools): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(POOL_KEY, JSON.stringify(pools));
}

function buildUniqueCodes(rewardId: string, count: number): string[] {
  const slug = rewardId.replace(/\W/g, "").toUpperCase().slice(-8).padStart(4, "X");
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const seq = String(i + 1).padStart(3, "0");
    const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
    out.push(`PRZ-${slug}-${seq}-${rnd}`);
  }
  return out;
}

/** Создаёт пул из `stockLeft` уникальных кодов, если пул пуст (первая выдача или после сброса). */
export function ensureRedemptionPool(rewardId: string, stockLeft: number): void {
  if (stockLeft <= 0) return;
  const pools = readPools();
  const cur = pools[rewardId];
  if (cur && cur.length > 0) return;
  pools[rewardId] = buildUniqueCodes(rewardId, stockLeft);
  writePools(pools);
}

/** При создании/обновлении приза партнёром — сразу резервируем коды под тираж. */
export function seedRedemptionPoolForNewReward(rewardId: string, totalStock: number): void {
  if (totalStock <= 0) return;
  const pools = readPools();
  pools[rewardId] = buildUniqueCodes(rewardId, totalStock);
  writePools(pools);
}

/** Забрать следующий код выдачи. */
export function takePooledRedemptionCode(rewardId: string): string | null {
  const pools = readPools();
  const cur = pools[rewardId];
  if (!cur?.length) return null;
  const [first, ...rest] = cur;
  pools[rewardId] = rest;
  writePools(pools);
  return first ?? null;
}
