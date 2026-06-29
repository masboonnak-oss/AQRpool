import { FC, ReactNode } from "react";
import { LucideIcon, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** tailwind `from-* to-*` stops for the icon tile; defaults to brand ocean */
  gradient?: string;
  /** right-aligned content (buttons, counts, …) */
  actions?: ReactNode;
  className?: string;
}

/** Consistent page heading: dimensional icon tile + gradient title + actions. */
export const PageHeader: FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  gradient = "from-brand-from to-brand-to",
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-border/70 bg-card/96 px-4 py-3.5 shadow-sm shadow-black/[0.03] sm:px-5",
        className,
      )}
    >
      {/* topic-tinted glow + subtle water — decorative, matches each page's gradient */}
      <div className={cn("pointer-events-none absolute -top-10 -right-8 h-40 w-40 rounded-full bg-gradient-to-br opacity-20 blur-3xl", gradient)} />
      <Waves className="pointer-events-none absolute -bottom-4 right-3 h-24 w-24 text-primary/[0.06]" strokeWidth={1.2} aria-hidden />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className={cn("icon-tile rounded-md p-2.5 bg-gradient-to-br text-white shrink-0", gradient)}>
              <Icon className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-extrabold tracking-tight text-gradient truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
