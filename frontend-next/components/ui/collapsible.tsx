"use client";

/**
 * @deprecated Use Accordion component instead.
 *
 * Migration guide:
 * - <Collapsible open={x} onOpenChange={setX}> → <Accordion type="single" collapsible value={x ? "item" : ""} onValueChange={(v) => setX(v === "item")}>
 * - <CollapsibleTrigger> → <AccordionTrigger>
 * - <CollapsibleContent> → <AccordionContent>
 * - Wrap content in <AccordionItem value="item">
 * - Add className="border-none" to AccordionItem to remove default borders
 * - Add className="hover:no-underline [&>svg]:hidden" to AccordionTrigger to hide built-in chevron
 *
 * See: TEEEM_DOCS/STANDARD_COMPONENTS.md
 */

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger> & {
    showIcon?: boolean;
  }
>(({ className, children, showIcon = true, asChild, ...props }, ref) => {
  // When asChild is true, pass through directly to the primitive without wrapping
  if (asChild) {
    return (
      <CollapsiblePrimitive.Trigger ref={ref} asChild {...props}>
        {children}
      </CollapsiblePrimitive.Trigger>
    );
  }

  return (
    <CollapsiblePrimitive.Trigger
      ref={ref}
      className={cn(
        "flex w-full items-center justify-between py-2 text-brand-md font-medium transition-all [&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      {showIcon && (
        <ChevronDown className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-200" />
      )}
    </CollapsiblePrimitive.Trigger>
  );
});
CollapsibleTrigger.displayName = CollapsiblePrimitive.Trigger.displayName;

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden text-brand-md data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      className,
    )}
    {...props}
  >
    <div className="pb-4 pt-0">{children}</div>
  </CollapsiblePrimitive.Content>
));
CollapsibleContent.displayName = CollapsiblePrimitive.Content.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
