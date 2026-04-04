import type { Reward } from "@/lib/mock-data";

const KEY = "clientsay_partner_rewards";

/** Призы, добавленные партнёром (расширяют Reward условиями акции). */
export type PartnerUploadedReward = Reward & {
  giftTerms?: string;
  giftConditions?: string;
};

export function readPartnerUploadedRewards(): PartnerUploadedReward[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PartnerUploadedReward[]) : [];
  } catch {
    return [];
  }
}

export function writePartnerUploadedRewards(rewards: PartnerUploadedReward[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(rewards));
  window.dispatchEvent(new Event("clientsay-partner-rewards-changed"));
}
