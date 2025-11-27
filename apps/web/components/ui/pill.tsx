import { type VariantProps, cva } from "class-variance-authority";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

const pillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-none text-brand-base font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-text-secondary",
        primary:
          "bg-foreground text-background",
        secondary:
          "bg-secondary text-secondary-foreground",
        success:
          "bg-status-success text-status-success-foreground",
        warning:
          "bg-status-warning text-status-warning-foreground",
        error:
          "bg-status-error text-status-error-foreground",
        info:
          "bg-status-info text-status-info-foreground",
        outline:
          "bg-transparent border border-border text-foreground",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-brand-xs",
        default: "px-2.5 py-1 text-brand-base",
        lg: "px-3 py-1.5 text-brand-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface PillProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof pillVariants> {
  onRemove?: () => void;
  removable?: boolean;
  icon?: React.ReactNode;
}

function Pill({
  className,
  variant,
  size,
  onRemove,
  removable = false,
  icon,
  children,
  ...props
}: PillProps) {
  return (
    <div className={cn(pillVariants({ variant, size }), className)} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {removable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="shrink-0 ml-0.5 hover:opacity-70 transition-opacity"
        >
          <X className="h-3 w-3" />
          <span className="sr-only">Remove</span>
        </button>
      )}
    </div>
  );
}

// Status Pill - Pre-configured for common status indicators
const statusVariants = {
  active: "success",
  inactive: "default",
  pending: "warning",
  error: "error",
  draft: "secondary",
  published: "success",
  archived: "default",
  processing: "info",
  completed: "success",
  failed: "error",
  cancelled: "default",
} as const;

type StatusType = keyof typeof statusVariants;

interface StatusPillProps extends Omit<PillProps, "variant"> {
  status: StatusType;
}

function StatusPill({ status, children, ...props }: StatusPillProps) {
  const variant = statusVariants[status];
  return (
    <Pill variant={variant} {...props}>
      {children || status.charAt(0).toUpperCase() + status.slice(1)}
    </Pill>
  );
}

export { Pill, pillVariants, StatusPill, type StatusType };
