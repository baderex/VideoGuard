import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-primary/50 bg-primary/10 text-primary shadow-[0_0_10px_rgba(0,255,255,0.2)]",
    secondary: "border-secondary-foreground/20 bg-secondary text-secondary-foreground",
    destructive: "border-destructive/50 bg-destructive/10 text-destructive shadow-[0_0_10px_rgba(255,0,0,0.2)]",
    outline: "text-foreground",
    success: "border-success/50 bg-success/10 text-success shadow-[0_0_10px_rgba(0,255,0,0.2)]",
    warning: "border-warning/50 bg-warning/10 text-warning shadow-[0_0_10px_rgba(255,165,0,0.2)]",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 uppercase tracking-wider font-display",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
