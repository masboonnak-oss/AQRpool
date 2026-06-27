// Visual identity for each loyalty rank (Bronze → Silver → Gold → Diamond).
// Thresholds/discounts come from the API (server is the source of truth); this file
// owns ONLY the look: card gradients, metallic chip, glow, icon and the localized
// perk copy shown on the membership card and admin badges.
import { Award, Medal, Crown, Gem, type LucideIcon } from "lucide-react";

export type TierId = "bronze" | "silver" | "gold" | "diamond";

export const TIER_ORDER: TierId[] = ["bronze", "silver", "gold", "diamond"];

export type TierTheme = {
  id: TierId;
  label: string;
  /** Thai display name. */
  labelTh: string;
  tagline: string;
  Icon: LucideIcon;
  /** Full card background (CSS gradient value). */
  surface: string;
  /** Primary text color that sits on `surface`. */
  ink: string;
  /** Muted text color on `surface`. */
  inkSoft: string;
  /** Metallic EMV-chip gradient. */
  chip: string;
  /** Outer glow / drop shadow for the hero card. */
  glow: string;
  /** Subtle inner ring color. */
  ring: string;
  /** Whether to layer the holographic shimmer (Diamond only). */
  holo: boolean;
  /** Tailwind classes for the compact rank badge (admin list, chips). */
  badgeClass: string;
  perks: string[];
};

export const TIER_THEME: Record<TierId, TierTheme> = {
  bronze: {
    id: "bronze",
    label: "Bronze",
    labelTh: "บรอนซ์",
    tagline: "เริ่มต้นเส้นทางสมาชิก",
    Icon: Award,
    surface:
      "radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,.28), transparent 42%), linear-gradient(135deg, #4f3115 0%, #8a5527 36%, #c07e3e 58%, #6b4322 100%)",
    ink: "#fcf1e2",
    inkSoft: "rgba(252,241,226,.78)",
    chip: "linear-gradient(135deg, #f4d9a6, #c98f47 60%, #8a5b27)",
    glow: "0 22px 55px -20px rgba(176,110,53,.75), 0 0 0 1px rgba(255,225,180,.25)",
    ring: "rgba(255,221,170,.30)",
    holo: false,
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    perks: [
      "สะสมยอดทุกการใช้บริการเพื่อเลื่อนแรงค์",
      "จองสระและซื้อแพ็กเกจได้ตามปกติ",
      "รับข่าวสารและโปรโมชันสมาชิก",
    ],
  },
  silver: {
    id: "silver",
    label: "Silver",
    labelTh: "ซิลเวอร์",
    tagline: "สมาชิกคนพิเศษ",
    Icon: Medal,
    surface:
      "radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,.55), transparent 45%), linear-gradient(135deg, #8390a1 0%, #c8d2de 28%, #eef2f7 48%, #9aa6b6 72%, #6c7787 100%)",
    ink: "#1d2733",
    inkSoft: "rgba(29,39,51,.66)",
    chip: "linear-gradient(135deg, #ffffff, #c2ccda 60%, #94a0b2)",
    glow: "0 22px 55px -20px rgba(120,140,165,.7), 0 0 0 1px rgba(255,255,255,.4)",
    ring: "rgba(255,255,255,.45)",
    holo: false,
    badgeClass: "bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200",
    perks: [
      "ส่วนลดซื้อคอร์ส/แพ็กเกจ 5%",
      "สิทธิ์จองล่วงหน้าได้มากขึ้น",
      "ของขวัญต้อนรับขึ้นแรงค์ Silver",
    ],
  },
  gold: {
    id: "gold",
    label: "Gold",
    labelTh: "โกลด์",
    tagline: "สิทธิพิเศษระดับพรีเมียม",
    Icon: Crown,
    surface:
      "radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,.5), transparent 42%), linear-gradient(135deg, #7a560f 0%, #d6a92f 26%, #fbe79a 50%, #d4a52c 74%, #7a560f 100%)",
    ink: "#41310a",
    inkSoft: "rgba(65,49,10,.7)",
    chip: "linear-gradient(135deg, #fff6da, #f0cf6b 55%, #b88a25)",
    glow: "0 24px 60px -20px rgba(214,169,47,.85), 0 0 0 1px rgba(255,235,170,.4)",
    ring: "rgba(255,235,170,.5)",
    holo: false,
    badgeClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
    perks: [
      "ส่วนลดซื้อคอร์ส/แพ็กเกจ 10%",
      "สิทธิ์จองคิวพิเศษช่วงเวลาทอง",
      "ของขวัญวันเกิดพิเศษ",
      "บริการช่วยเหลือก่อนใคร",
    ],
  },
  diamond: {
    id: "diamond",
    label: "Diamond",
    labelTh: "ไดมอนด์",
    tagline: "สุดยอดสมาชิกระดับสูงสุด",
    Icon: Gem,
    surface:
      "radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,.35), transparent 40%), linear-gradient(135deg, #0f1f3d 0%, #234e7e 28%, #3a86b3 50%, #1f4a8c 76%, #0c1830 100%)",
    ink: "#eaf6ff",
    inkSoft: "rgba(234,246,255,.78)",
    chip: "linear-gradient(135deg, #eafcff, #a9d8ff 50%, #7fb0e6)",
    glow: "0 26px 70px -20px rgba(72,156,214,.85), 0 0 0 1px rgba(180,230,255,.4)",
    ring: "rgba(190,235,255,.45)",
    holo: true,
    badgeClass:
      "bg-gradient-to-r from-cyan-100 to-fuchsia-100 text-sky-800 dark:from-cyan-900/40 dark:to-fuchsia-900/40 dark:text-cyan-100",
    perks: [
      "ส่วนลดซื้อคอร์ส/แพ็กเกจ 15%",
      "สิทธิ์จองก่อนใครทุกช่วงเวลา",
      "ที่ปรึกษาส่วนตัว & บริการ VIP",
      "เชิญร่วมอีเวนต์สุดเอกซ์คลูซีฟ",
      "ของขวัญพรีเมียมประจำปี",
    ],
  },
};

export function tierTheme(id?: string | null): TierTheme {
  return TIER_THEME[(id as TierId)] ?? TIER_THEME.bronze;
}
