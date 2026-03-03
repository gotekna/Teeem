"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "../../lib/utils";
import { ExpandButton, ExpandableSection, useExpandedState } from "./expandable-section";

/**
 * TabsExpandContext - shared between Tabs (with expandKey) and its TabsList.
 *
 * When a <Tabs expandKey="..."> is rendered, it provides this context so
 * TabsList automatically shows the ↗ expand button — no prop needed on TabsList.
 */
const TabsExpandContext = React.createContext<{ expanded: boolean; toggle: () => void } | null>(null);

/**
 * TabsWithExpand - internal wrapper used when Tabs receives expandKey.
 * Separate component so hooks aren't called conditionally.
 *
 * Behaviour:
 *  - Collapsed: renders normally; TabsList shows ↗ button at right edge
 *  - Expanded:  entire Tabs fills viewport (ExpandableSection fixed overlay);
 *               TabsList hides; ↙ button visible at top-right of overlay
 *  - Escape exits fullscreen
 */
function TabsWithExpand({
  expandKey,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & { expandKey: string }) {
  const [expanded, toggle] = useExpandedState(expandKey);
  return (
    <TabsExpandContext.Provider value={{ expanded, toggle }}>
      <ExpandableSection expanded={expanded} onToggle={toggle}>
        <TabsPrimitive.Root className={className} {...props}>
          {children}
        </TabsPrimitive.Root>
      </ExpandableSection>
    </TabsExpandContext.Provider>
  );
}

/**
 * Tabs - standard shadcn/radix Tabs root.
 *
 * Add expandKey="unique-key" to get a free ↗ expand button on every TabsList
 * inside this Tabs. No other changes needed — content auto-expands to full screen.
 *
 * Example:
 *   <Tabs expandKey="financial-tabs" value={tab} onValueChange={setTab}>
 *     <TabsList>...</TabsList>
 *     <TabsContent>...</TabsContent>
 *   </Tabs>
 */
const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & { expandKey?: string }
>(({ expandKey, ...props }, ref) => {
  if (expandKey) {
    // ref not forwarded here — acceptable tradeoff for the expand wrapper
    return <TabsWithExpand expandKey={expandKey} {...props} />;
  }
  return <TabsPrimitive.Root ref={ref} {...props} />;
});
Tabs.displayName = TabsPrimitive.Root.displayName;

/**
 * TabsListInner - reads TabsExpandContext to show ↗ button automatically.
 * Used by TabsList when no standalone expandKey prop is provided.
 */
function TabsListInner({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  const expandContext = React.useContext(TabsExpandContext);

  if (!expandContext) {
    return (
      <TabsPrimitive.List
        className={cn("inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1", className)}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    );
  }

  const { expanded, toggle } = expandContext;

  // Hidden when expanded — ↙ button in ExpandableSection overlay handles exit
  if (expanded) return null;

  return (
    <div className="flex items-center gap-2">
      <TabsPrimitive.List
        className={cn(
          "inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 flex-1 min-w-0",
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
      <ExpandButton expanded={false} onToggle={toggle} />
    </div>
  );
}

/**
 * TabsListWithExpand - standalone TabsList with its own expandKey (no parent Tabs needed).
 * Separate component so useExpandedState hook isn't called conditionally.
 */
function TabsListWithExpand({
  expandKey,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { expandKey: string }) {
  const [expanded, toggle] = useExpandedState(expandKey);

  if (expanded) {
    return (
      <div className="flex justify-end pb-1">
        <ExpandButton expanded={true} onToggle={toggle} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <TabsPrimitive.List
        className={cn(
          "inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 flex-1 min-w-0",
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
      <ExpandButton expanded={false} onToggle={toggle} />
    </div>
  );
}

/**
 * TabsList - standard tab bar.
 *
 * Gets a free ↗ expand button when inside <Tabs expandKey="..."> (no prop needed here).
 * Or use standalone expandKey prop for pages that don't use the Tabs root pattern.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { expandKey?: string }
>(({ className, expandKey, ...props }, ref) => {
  if (expandKey) {
    return <TabsListWithExpand expandKey={expandKey} className={className} {...props} />;
  }
  // ref not forwarded when using context-aware inner — acceptable since expand wraps in a div anyway
  return <TabsListInner className={className} {...props} />;
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
      "text-foreground/80 hover:text-foreground hover:bg-accent",
      "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
