const KEY = "clientsay_partner_brief_stats";

export function getBriefResponseCounts(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function incrementBriefResponseCount(briefId: string): void {
  if (typeof window === "undefined") return;
  const all = getBriefResponseCounts();
  all[briefId] = (all[briefId] ?? 0) + 1;
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("clientsay-brief-stats-changed"));
}
