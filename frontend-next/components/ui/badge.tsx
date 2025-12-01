import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 text-brand-base font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-status-error text-status-error-foreground hover:bg-status-error/80",
        outline:
          "rounded-none bg-transparent text-brand-xs font-normal border-border border text-primary",
        tag: "text-text-muted bg-secondary text-brand-xs dark:bg-secondary border-none font-normal rounded-none",
        "tag-rounded":
          "text-text-muted bg-secondary text-brand-base dark:bg-secondary font-normal px-3 py-1 border-none",
        "tag-outline":
          "border-transparent bg-zinc-700 text-zinc-200 hover:bg-zinc-700/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
