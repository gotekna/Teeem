"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "@radix-ui/react-icons";
import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * React 19 + Radix UI compatibility fix:
 * Use useImperativeHandle with a stable ref to avoid infinite loops
 * caused by useComposedRefs in Radix primitives.
 */
const Checkbox = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, forwardedRef) => {
  const internalRef = React.useRef<HTMLButtonElement>(null);

  // Sync the forwarded ref with our internal ref (React 19 compatible)
  React.useImperativeHandle(forwardedRef, () => internalRef.current!, []);

  return (
    <CheckboxPrimitive.Root
      ref={internalRef}
      className={cn(
        "peer h-4 w-4 shrink-0 border border-border bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-background data-[state=checked]:border-primary",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-foreground")}
      >
        <CheckIcon className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
