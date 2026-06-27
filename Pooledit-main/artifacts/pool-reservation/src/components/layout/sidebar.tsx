import { FC, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/i18n";
import {
  LayoutDashboard, CalendarDays, CalendarPlus, Calendar, User,
  Settings, Users, LogOut, Droplets, Building2, GraduationCap,
  Bell, Wallet, CreditCard, Crown, MessageCircle, QrCode, ScanLine, ShoppingBag, Bot, Package, Sparkles, Palette, LifeBuoy, Clock, TrendingUp, CalendarOff,
  ClipboardList, ShieldCheck, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand";

export const Sidebar: FC = () => {
  const [location] = useLocation();
  const { user, isAdmin, isInstructor, isStaff, isDev, logout } = useAuth();
  const { t } = useTranslation();
  // super_admin-only items also show for dev (dev is a superset).
  const isSuper = (user as any)?.role === "super_admin" || isDev;
  const token = localStorage.getItem("pool_token");
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [unreadChat, setUnreadChat] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [devUnread, setDevUnread] = useState(0);
  const [leavePending, setLeavePending] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchCounts = () => {
      fetch(`${baseUrl}/api/chat/unread`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setUnreadChat(d.unreadCount || 0)).catch(() => {});
      fetch(`${baseUrl}/api/orders/admin/pending-count`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setPendingOrders(d.count || 0)).catch(() => {});
      fetch(`${baseUrl}/api/dev-support/unread`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setDevUnread(d.unreadCount || 0)).catch(() => {});
      fetch(`${baseUrl}/api/leave/pending-count`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setLeavePending(d.count || 0)).catch(() => {});
    };
    fetchCounts();
    const iv = setInterval(fetchCounts, 60000);
    return () => clearInterval(iv);
  }, [isAdmin]);

  // Member menu, grouped by category so related items sit together (e.g. shop +
  // orders in one section). Mirrors the admin grouped layout for a consistent feel.
  const memberGroups = [
    {
      title: "ภาพรวม",
      links: [
        { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
        { href: "/membership-card", label: "บัตรสมาชิก", icon: QrCode },
      ],
    },
    {
      title: "จองและบริการ",
      links: [
        { href: "/book", label: t("nav.book"), icon: CalendarPlus },
        { href: "/reservations", label: t("nav.reservations"), icon: CalendarDays },
        { href: "/instructors", label: "ครูฝึก", icon: GraduationCap },
        { href: "/services", label: "บริการอื่นๆ", icon: Sparkles },
      ],
    },
    {
      // "คำสั่งซื้อของฉัน" now lives inside the ร้านค้าสโมสร page (a tab there),
      // so it is no longer a separate menu item.
      title: "ร้านค้าและการเงิน",
      links: [
        { href: "/products", label: "ร้านค้าสโมสร", icon: ShoppingBag },
        { href: "/wallet", label: t("nav.wallet"), icon: Wallet },
        { href: "/packages", label: t("nav.packages"), icon: Crown },
      ],
    },
    {
      title: "บัญชีและช่วยเหลือ",
      links: [
        { href: "/chat", label: t("nav.chat"), icon: MessageCircle },
        { href: "/profile", label: t("nav.profile"), icon: User },
      ],
    },
  ];

  // Flat list for roles that embed the member menu (e.g. instructors).
  const memberLinks = memberGroups.flatMap((g) => g.links);

  const adminLinks = [
    { href: "/admin", label: t("nav.admin.dashboard"), icon: LayoutDashboard },
    ...((user as any)?.role === "super_admin" ? [
      { href: "/admin/overview", label: "ภาพรวมทุกสาขา", icon: TrendingUp },
      { href: "/admin/branches", label: "จัดการสาขา", icon: Building2 },
    ] : []),
    { href: "/admin/reservations", label: t("nav.admin.reservations"), icon: CalendarDays },
    { href: "/admin/members", label: t("nav.admin.members"), icon: Users },
    { href: "/admin/facilities", label: t("nav.admin.facilities"), icon: Building2 },
    { href: "/admin/instructors", label: t("nav.admin.instructors"), icon: GraduationCap },
    { href: "/admin/checkin", label: "สแกนเช็คอิน", icon: ScanLine },
    { href: "/admin/announcements", label: t("nav.admin.announcements"), icon: Bell },
    { href: "/admin/wallet", label: t("nav.admin.wallet"), icon: Wallet },
    { href: "/admin/packages", label: t("nav.admin.packages"), icon: Crown },
    { href: "/admin/products", label: "ผลิตภัณฑ์", icon: ShoppingBag },
    { href: "/admin/orders", label: "คำสั่งซื้อ", icon: Package, badge: pendingOrders > 0 ? pendingOrders : undefined },
    { href: "/admin/chat", label: t("nav.admin.chat"), icon: MessageCircle, badge: unreadChat > 0 ? unreadChat : undefined },
    // AI chat analytics span every branch (flat logs), so only the franchise owner sees them.
    ...((user as any)?.role === "super_admin" ? [{ href: "/admin/ai-chat", label: "วิเคราะห์แชท AI", icon: Bot }] : []),
    { href: "/admin/theme", label: "ธีมสีเว็บไซต์", icon: Palette },
    { href: "/admin/help", label: "ศูนย์ช่วยเหลือ", icon: LifeBuoy, badge: devUnread > 0 ? devUnread : undefined },
    { href: "/admin/work-plan", label: "วางแผนงาน", icon: ClipboardList },
    { href: "/admin/attendance", label: "ลงเวลา/กะพนักงาน", icon: Clock },
    { href: "/admin/leave", label: "คำขอลาพนักงาน", icon: CalendarOff, badge: leavePending > 0 ? leavePending : undefined },
    { href: "/admin/settings", label: t("nav.admin.settings"), icon: Settings },
  ];

  const adminGroups = [
    {
      title: "ภาพรวมระบบ",
      links: [
        { href: "/admin", label: t("nav.admin.dashboard"), icon: LayoutDashboard },
        ...(isSuper ? [
          { href: "/admin/overview", label: "ภาพรวมทุกสาขา", icon: TrendingUp },
          { href: "/admin/branches", label: "จัดการสาขา", icon: Building2 },
        ] : []),
      ],
    },
    {
      title: "การจองและการสอน",
      links: [
        { href: "/admin/reservations", label: t("nav.admin.reservations"), icon: CalendarDays },
        { href: "/admin/facilities", label: t("nav.admin.facilities"), icon: Building2 },
        { href: "/admin/instructors", label: t("nav.admin.instructors"), icon: GraduationCap },
        { href: "/admin/checkin", label: "สแกนเช็คอิน", icon: ScanLine },
      ],
    },
    {
      title: "สมาชิกและแพ็กเกจ",
      links: [
        { href: "/admin/members", label: t("nav.admin.members"), icon: Users },
        { href: "/admin/wallet", label: t("nav.admin.wallet"), icon: Wallet },
        { href: "/admin/packages", label: t("nav.admin.packages"), icon: Crown },
      ],
    },
    {
      title: "ร้านค้าและคำสั่งซื้อ",
      links: [
        { href: "/admin/products", label: "ผลิตภัณฑ์", icon: ShoppingBag },
        { href: "/admin/orders", label: "คำสั่งซื้อ", icon: Package, badge: pendingOrders > 0 ? pendingOrders : undefined },
      ],
    },
    {
      title: "สื่อสารและช่วยเหลือ",
      links: [
        { href: "/admin/announcements", label: t("nav.admin.announcements"), icon: Bell },
        { href: "/admin/chat", label: t("nav.admin.chat"), icon: MessageCircle, badge: unreadChat > 0 ? unreadChat : undefined },
        ...(isSuper ? [{ href: "/admin/ai-chat", label: "วิเคราะห์แชท AI", icon: Bot }] : []),
        { href: "/admin/help", label: "ศูนย์ช่วยเหลือ", icon: LifeBuoy, badge: devUnread > 0 ? devUnread : undefined },
      ],
    },
    {
      title: "พนักงาน",
      links: [
        { href: "/admin/work-plan", label: "วางแผนงาน", icon: ClipboardList },
        { href: "/admin/attendance", label: "ลงเวลา/กะพนักงาน", icon: Clock },
        { href: "/admin/leave", label: "คำขอลาพนักงาน", icon: CalendarOff, badge: leavePending > 0 ? leavePending : undefined },
      ],
    },
    {
      title: "ตั้งค่าระบบ",
      links: [
        ...(isDev ? [
          { href: "/admin/update", label: "อัพเดทระบบ (DEV)", icon: RefreshCw },
        ] : []),
        ...(isSuper ? [
          { href: "/admin/audit-logs", label: "บันทึกความปลอดภัย", icon: ShieldCheck },
        ] : []),
        { href: "/admin/theme", label: "ธีมสีเว็บไซต์", icon: Palette },
        { href: "/admin/settings", label: t("nav.admin.settings"), icon: Settings },
      ],
    },
  ];

  const instructorLinks = [
    { href: "/instructor/schedule", label: "ตารางสอนของฉัน", icon: CalendarDays },
    { href: "/tasks", label: "ภารกิจประจำวัน", icon: ClipboardList },
    { href: "/attendance", label: "ลงเวลางาน", icon: Clock },
    { href: "/leave", label: "การลา", icon: CalendarOff },
    ...memberLinks,
  ];

  // Employees (staff) — clock in/out, leave, and their own profile.
  const staffLinks = [
    { href: "/tasks", label: "ภารกิจประจำวัน", icon: ClipboardList },
    { href: "/attendance", label: "ลงเวลางาน", icon: Clock },
    { href: "/leave", label: "การลา", icon: CalendarOff },
    { href: "/profile", label: t("nav.profile"), icon: User },
  ];

  const links = isAdmin ? adminLinks : isInstructor ? instructorLinks : isStaff ? staffLinks : memberLinks;

  // Dev sees EVERY menu in the app: all admin groups + the member view + the worker view.
  const devExtraGroups = [
    { title: "มุมมองสมาชิก (Dev)", links: memberLinks },
    {
      title: "มุมมองพนักงาน/ครู (Dev)",
      links: [
        { href: "/instructor/schedule", label: "ตารางสอนของฉัน", icon: CalendarDays },
        { href: "/tasks", label: "ภารกิจประจำวัน", icon: ClipboardList },
        { href: "/attendance", label: "ลงเวลางาน", icon: Clock },
        { href: "/leave", label: "การลา", icon: CalendarOff },
      ],
    },
  ];

  // Dev → every group; admins → admin groups; members → member groups; instructors/staff keep a flat list.
  const navGroups = isDev
    ? [...adminGroups, ...devExtraGroups]
    : isAdmin ? adminGroups : (isInstructor || isStaff) ? null : memberGroups;
  const initials = user ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() : "U";
  const avatarUrl = (user as any)?.profileImageUrl;

  return (
    <aside className="hidden md:flex w-64 flex-col bg-sidebar/95 border-r border-primary/20 shadow-[10px_0_30px_-28px_hsl(var(--glow)/0.45)] h-[100dvh] sticky top-0 backdrop-blur">
      <div className="p-4 border-b border-primary/15">
        <BrandMark size="md" tagline />
      </div>

      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground mb-3 px-3">{isDev ? "DEV" : isAdmin ? "ADMIN" : isInstructor ? "INSTRUCTOR" : isStaff ? "พนักงาน" : "MEMBER"}</div>
        {navGroups ? navGroups.map((group) => (
          <div key={group.title} className="space-y-0.5">
            <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/80">
              {group.title}
            </div>
            {group.links.map((link) => {
              const isActive = location === link.href;
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer",
                    isActive
                      ? "bg-gold text-primary-foreground shadow-md shadow-[hsl(var(--gold)/0.32)]"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5"
                  )}>
                    <div className={cn("p-1 rounded-lg transition-colors", isActive ? "bg-white/25" : "bg-primary/10 text-primary")}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="flex-1">{link.label}</span>
                    {(link as any).badge && (
                      <Badge className="ml-auto bg-red-500 text-white text-xs min-w-5 h-5 flex items-center justify-center rounded-full px-1">
                        {(link as any).badge}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )) : links.map((link) => {
          const isActive = location === link.href;
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer",
                isActive
                  ? "bg-gold text-primary-foreground shadow-md shadow-[hsl(var(--gold)/0.32)]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5"
              )}>
                <div className={cn("p-1 rounded-lg transition-colors", isActive ? "bg-white/25" : "bg-primary/10 text-primary")}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="flex-1">{link.label}</span>
                {(link as any).badge && (
                  <Badge className="ml-auto bg-red-500 text-white text-xs min-w-5 h-5 flex items-center justify-center rounded-full px-1">
                    {(link as any).badge}
                  </Badge>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-primary/15 space-y-4">
        {user && (
          <div className="flex items-center gap-3 px-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-primary/20">
              {avatarUrl ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-sidebar-foreground truncate">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate font-mono">{(user as any).memberCode ?? ""}</div>
            </div>
          </div>
        )}
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:text-destructive hover:bg-destructive/10" onClick={logout}>
          <LogOut className="w-5 h-5 mr-3" />{t("nav.logout")}
        </Button>
      </div>
    </aside>
  );
};
