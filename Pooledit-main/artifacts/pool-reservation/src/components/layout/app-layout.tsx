import { FC, ReactNode, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { AssistantWidget } from "@/components/assistant-widget";
import { AmbientBackground } from "@/components/ambient-background";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { CalendarPlus, Crown, LayoutDashboard, QrCode, Wallet } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

const MobileBottomNav: FC = () => {
  const [location] = useLocation();
  const { isAdmin, isStaff } = useAuth();
  if (isAdmin || isStaff) return null;

  const links = [
    { href: "/dashboard", label: "หน้าหลัก", icon: LayoutDashboard },
    { href: "/book", label: "จอง", icon: CalendarPlus },
    { href: "/membership-card", label: "บัตร", icon: QrCode },
    { href: "/packages", label: "แพ็กเกจ", icon: Crown },
    { href: "/wallet", label: "เงิน", icon: Wallet },
  ];

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-primary/20 bg-card/95 shadow-[0_-10px_30px_-22px_hsl(var(--glow)/0.55)] backdrop-blur supports-[backdrop-filter]:bg-card/85 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {links.map((link) => {
          const active = location === link.href;
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <div className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors", active ? "text-primary-foreground" : "text-muted-foreground")}>
                <span className={cn("flex h-7 w-9 items-center justify-center rounded-full transition-all", active ? "bg-gold shadow-sm shadow-[hsl(var(--gold)/0.35)]" : "hover:bg-accent")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span>{link.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export const AppLayout: FC<AppLayoutProps> = ({ children }) => {
  const { isAuthenticated, isAdmin } = useAuth();
  const [location] = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // On every route change, jump the scroller back to the top so each page starts fresh.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [location]);

  if (!isAuthenticated) {
    return <div className="min-h-screen bg-background flex flex-col">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row relative">
      {/* Interactive ambient backdrop shared across all pages */}
      <AmbientBackground />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <Header />
        <main
          ref={mainRef}
          className={`flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-8 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-[max(0.75rem,env(safe-area-inset-bottom))] ${isAdmin ? "admin-portal" : "member-portal"}`}
        >
          {/* keyed wrapper → quick GPU fade/slide on each navigation */}
          <div key={location} className="animate-page">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
      <AssistantWidget />
    </div>
  );
};
