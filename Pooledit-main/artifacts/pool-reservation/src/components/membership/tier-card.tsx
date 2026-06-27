import { FC } from "react";
import { motion } from "framer-motion";
import { Sparkles, BadgePercent, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TierTheme } from "@/lib/membership-tiers";

export type TierInfo = {
  id: string;
  label: string;
  discount: number;
  totalSpent: number;
  next: { id: string; label: string; minSpend: number } | null;
  amountToNext: number;
  progress: number;
};

const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

// Fixed sparkle positions (top%, left%, size px, delay s) — deterministic so the
// layout never jumps between renders.
const SPARKLES = [
  { top: 16, left: 12, s: 10, d: 0 },
  { top: 64, left: 22, s: 7, d: 0.6 },
  { top: 30, left: 78, s: 12, d: 1.1 },
  { top: 74, left: 88, s: 8, d: 0.3 },
  { top: 48, left: 50, s: 6, d: 0.9 },
  { top: 12, left: 62, s: 7, d: 1.4 },
];

/** The premium, animated loyalty-rank card — metallic surface, light sweep,
 *  floating sparkles, (holographic shimmer for Diamond) and a progress bar
 *  toward the next rank. Surface colours are supplied by `theme`. */
export const TierCard: FC<{
  theme: TierTheme;
  tier: TierInfo;
  name: string;
  memberCode?: string;
  initials: string;
  points?: number;
}> = ({ theme, tier, name, memberCode, initials, points }) => {
  const Icon = theme.Icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, scale: 1.012 }}
      className={cn(
        "tier-card tier-sweep relative rounded-[1.6rem] p-5 sm:p-6 select-none",
        theme.holo && "tier-holo",
      )}
      style={{ background: theme.surface, color: theme.ink, boxShadow: theme.glow }}
      data-testid="tier-card"
      data-tier={tier.id}
    >
      {theme.holo && <div className="tier-holo-layer rounded-[1.6rem]" />}

      {/* floating sparkles */}
      <div className="absolute inset-0 z-[2] overflow-hidden rounded-[1.6rem] pointer-events-none">
        {SPARKLES.map((sp, i) => (
          <motion.div
            key={i}
            className="absolute tier-twinkle"
            style={{ top: `${sp.top}%`, left: `${sp.left}%`, animationDelay: `${sp.d}s` }}
            animate={{ y: [0, -10, 0], x: [0, 6, 0] }}
            transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles style={{ width: sp.s, height: sp.s, color: theme.ink, opacity: 0.85 }} />
          </motion.div>
        ))}
      </div>

      <div className="relative z-[4]">
        {/* top row: brand + rank pill */}
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: theme.inkSoft }}
          >
            Aquarich Member
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm"
            style={{ background: "rgba(255,255,255,.18)", boxShadow: `inset 0 0 0 1px ${theme.ring}` }}
          >
            <Icon className="w-3.5 h-3.5" /> {theme.label}
          </span>
        </div>

        {/* hero: icon + tier name */}
        <div className="mt-4 flex items-center gap-3.5">
          <div
            className="grid place-items-center w-14 h-14 rounded-2xl shrink-0"
            style={{ background: "rgba(255,255,255,.16)", boxShadow: `inset 0 1px 0 rgba(255,255,255,.45), 0 8px 20px -10px rgba(0,0,0,.5)` }}
          >
            <Icon className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl sm:text-[1.7rem] font-display font-extrabold leading-tight">
              {theme.labelTh} <span className="opacity-70 text-base font-bold">· {theme.label}</span>
            </div>
            <div className="text-xs font-medium" style={{ color: theme.inkSoft }}>
              {theme.tagline}
            </div>
          </div>
        </div>

        {/* chip + member identity */}
        <div className="mt-5 flex items-center gap-3">
          <div
            className="w-11 h-8 rounded-md shrink-0"
            style={{ background: theme.chip, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.4), inset 0 -2px 4px rgba(0,0,0,.25)" }}
          />
          <div
            className="grid place-items-center w-10 h-10 rounded-full text-sm font-bold shrink-0"
            style={{ background: "rgba(255,255,255,.2)", boxShadow: `inset 0 0 0 2px ${theme.ring}` }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-base truncate">{name}</div>
            <div className="text-[11px] font-mono tracking-widest" style={{ color: theme.inkSoft }}>
              {memberCode ?? ""}
            </div>
          </div>
          {tier.discount > 0 && (
            <div
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shrink-0"
              style={{ background: "rgba(255,255,255,.2)", boxShadow: `inset 0 0 0 1px ${theme.ring}` }}
            >
              <BadgePercent className="w-3.5 h-3.5" /> ลด {tier.discount}%
            </div>
          )}
        </div>

        {/* progress to next rank */}
        <div
          className="mt-5 rounded-2xl p-3.5 backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,.16)", boxShadow: `inset 0 0 0 1px ${theme.ring}` }}
        >
          {typeof points === "number" && (
            <div className="mb-2 flex items-center justify-between text-xs font-bold">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> แต้มสะสม
              </span>
              <span>{points.toLocaleString("th-TH")} แต้ม</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: theme.inkSoft }}>
            <span>ยอดสะสม {baht(tier.totalSpent)}</span>
            {tier.next ? (
              <span className="inline-flex items-center gap-1">
                อีก {baht(tier.amountToNext)} <ArrowRight className="w-3 h-3" /> {tier.next.label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold">แรงค์สูงสุดแล้ว 👑</span>
            )}
          </div>
          <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.22)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,.95), rgba(255,255,255,.6))" }}
              initial={{ width: 0 }}
              animate={{ width: `${tier.progress}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
