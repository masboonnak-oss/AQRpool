// Loyalty rank/tier for members — derived automatically from lifetime spend
// (sum of pricePaid across all non-cancelled member_packages). This is the single
// source of truth for thresholds + rank perks; the frontend owns only the visuals.
//
// Higher rank → bigger booking discount and more perks. The card art is keyed off
// `id` in artifacts/pool-reservation/src/lib/membership-tiers.ts.

export type TierId = "bronze" | "silver" | "gold" | "diamond";

export type TierDef = {
  id: TierId;
  label: string;
  /** Lifetime spend (THB) required to reach this rank. */
  minSpend: number;
  /** Extra booking discount granted by holding this rank, in percent. */
  discount: number;
};

// Ordered low → high. Keep minSpend strictly increasing.
export const TIERS: readonly TierDef[] = [
  { id: "bronze", label: "Bronze", minSpend: 0, discount: 0 },
  { id: "silver", label: "Silver", minSpend: 5_000, discount: 5 },
  { id: "gold", label: "Gold", minSpend: 20_000, discount: 10 },
  { id: "diamond", label: "Diamond", minSpend: 50_000, discount: 15 },
] as const;

export type MemberTier = {
  id: TierId;
  label: string;
  discount: number;
  minSpend: number;
  totalSpent: number;
  /** The next rank up, or null when already at the top. */
  next: { id: TierId; label: string; minSpend: number } | null;
  /** THB still needed to reach the next rank (0 at the top). */
  amountToNext: number;
  /** Progress toward the next rank, 0–100 (100 at the top). */
  progress: number;
};

export function computeTier(totalSpent: number): MemberTier {
  const spent = Math.max(0, Number(totalSpent) || 0);
  let currentIdx = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (spent >= TIERS[i].minSpend) currentIdx = i;
  }
  const current = TIERS[currentIdx];
  const next = TIERS[currentIdx + 1] ?? null;
  const span = next ? next.minSpend - current.minSpend : 0;
  const into = spent - current.minSpend;
  const progress = next && span > 0 ? Math.min(100, Math.max(0, Math.round((into / span) * 100))) : 100;

  return {
    id: current.id,
    label: current.label,
    discount: current.discount,
    minSpend: current.minSpend,
    totalSpent: spent,
    next: next ? { id: next.id, label: next.label, minSpend: next.minSpend } : null,
    amountToNext: next ? Math.max(0, next.minSpend - spent) : 0,
    progress,
  };
}
