import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
" hover-elevate active-elevate-2 active:scale-[.98]",
  {
    variants: {
      variant: {
        // Primary CTA — deep navy (the brand trust colour). Gold is now an opt-in accent.
        default:
           "bg-primary text-primary-foreground border border-[hsl(var(--primary)/0.5)] shadow-md shadow-[hsl(var(--primary)/0.28)] hover:shadow-lg hover:shadow-[hsl(var(--primary)/0.42)] hover:brightness-110 active:brightness-95",
        // Premium gold accent — for the ~10% special CTAs (use sparingly).
        gold:
           "bg-gold text-primary-foreground border border-[hsl(var(--gold-deep)/0.35)] shadow-md shadow-[hsl(var(--gold)/0.28)] hover:shadow-lg hover:shadow-[hsl(var(--gold)/0.38)] hover:brightness-[1.04] active:brightness-95",
        success:
          "bg-emerald-600 text-white shadow-sm border border-emerald-700/40 hover:brightness-105",
        warning:
          "bg-amber-500 text-amber-950 shadow-sm border border-amber-600/40 hover:brightness-105",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm border border-destructive-border hover:brightness-105",
        outline:
          "border border-primary/25 bg-card/75 text-foreground shadow-xs hover:border-primary/55 hover:bg-primary/10 hover:text-foreground active:shadow-none",
        secondary:
          "border border-secondary-border bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "border border-transparent hover:bg-accent/80 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:text-[hsl(var(--gold-deep))] hover:underline",
      },
      size: {
        // @replit changed sizes
        default: "min-h-10 px-4 py-2",
        sm: "min-h-8 rounded-lg px-3 text-xs",
        lg: "min-h-11 rounded-md px-8",
        icon: "h-10 w-10 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
