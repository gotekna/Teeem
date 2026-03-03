"use client";

import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList } from "@/components/ui/tabs";

// Module-level state that survives component remounts (e.g., Next.js tab navigation)
// Each key maps to whether that section is expanded
const expandedStates = new Map<string, boolean>();
const listeners = new Map<string, Set<(v: boolean) => void>>();

/**
 * useExpandedState - Persistent expanded state that survives remounts
 *
 * Next.js App Router remounts page components on URL changes (tab switches).
 * Regular useState(false) resets on every remount. This hook stores state
 * in a module-level Map so it persists across remounts within the same session.
 */
/**
 * collapseExpandedState - Programmatically collapse a specific section
 * Use when navigating away to a full-page route while expanded.
 */
export function collapseExpandedState(key: string) {
  if (expandedStates.get(key)) {
    expandedStates.set(key, false);
    listeners.get(key)?.forEach(fn => fn(false));
  }
}

export function useExpandedState(key: string): [boolean, () => void] {
  const [expanded, setExpanded] = React.useState(() => expandedStates.get(key) ?? false);

  // Subscribe to external updates (in case multiple instances share a key)
  React.useEffect(() => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    const set = listeners.get(key)!;
    set.add(setExpanded);
    // Sync on mount in case value changed while unmounted
    const current = expandedStates.get(key) ?? false;
    if (current !== expanded) setExpanded(current);
    return () => { set.delete(setExpanded); };
  }, [key]);

  const toggle = React.useCallback(() => {
    const next = !(expandedStates.get(key) ?? false);
    expandedStates.set(key, next);
    // Notify all listeners for this key
    listeners.get(key)?.forEach(fn => fn(next));
  }, [key]);

  return [expanded, toggle];
}

/**
 * ExpandableSection - Renders children normally or as a fixed overlay
 *
 * When expanded, content fills the viewport below the breadcrumb bar (top-24),
 * respecting sidebar width on desktop. Escape key exits expanded mode.
 *
 * Pattern reused from EntityConfigurationTab's fixed overlay.
 */
interface ExpandableSectionProps {
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export function ExpandableSection({
  expanded,
  onToggle,
  children,
  className,
}: ExpandableSectionProps) {
  const { sidebarWidth } = useSidebar();

  // Escape key exits expanded mode
  React.useEffect(() => {
    if (!expanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onToggle();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expanded, onToggle]);

  // Lock body scroll when expanded
  React.useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  if (!expanded) {
    // No wrapper when collapsed — must be transparent to preserve parent flex/height chains
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        "fixed top-24 left-0 md:left-[var(--sidebar-width)] right-0 bottom-0 bg-background flex flex-col z-50 transition-[left] duration-300",
        className
      )}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* Minimize button - always visible inside the overlay so users can exit regardless of layout */}
      <div className="absolute top-2 right-2 z-[51]">
        <ExpandButton expanded={true} onToggle={onToggle} />
      </div>
      {children}
    </div>
  );
}

/**
 * ExpandButton - Small toggle button for tab bars
 *
 * Shows Maximize2 when collapsed, Minimize2 when expanded.
 * Designed to sit inline with TabsList.
 */
interface ExpandButtonProps {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

export function ExpandButton({ expanded, onToggle, className }: ExpandButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8 shrink-0", className)}
      onClick={onToggle}
      title={expanded ? "Exit fullscreen (Esc)" : "Expand to fullscreen"}
    >
      {expanded ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </Button>
  );
}

/**
 * ExpandableTabs - Standard tabs + expand button, all in one
 *
 * Usage:
 *   <ExpandableTabs expandKey="my-section" value={tab} onValueChange={setTab}>
 *     <ExpandableTabs.List>
 *       <TabsTrigger value="a">Tab A</TabsTrigger>
 *       <TabsTrigger value="b">Tab B</TabsTrigger>
 *     </ExpandableTabs.List>
 *     <ExpandableTabs.Section>
 *       <TabsContent value="a">...</TabsContent>
 *       <TabsContent value="b">...</TabsContent>
 *     </ExpandableTabs.Section>
 *   </ExpandableTabs>
 *
 * When expanded: tab bar hides, content fills the viewport (matches Settings pattern).
 * Press Escape to exit fullscreen.
 */
interface ExpandableTabsContextValue {
  expanded: boolean;
  toggle: () => void;
}

const ExpandableTabsContext = React.createContext<ExpandableTabsContextValue>({
  expanded: false,
  toggle: () => {},
});

interface ExpandableTabsProps extends React.ComponentProps<typeof Tabs> {
  expandKey: string;
}

function ExpandableTabsRoot({ expandKey, children, ...tabsProps }: ExpandableTabsProps) {
  const [expanded, toggle] = useExpandedState(expandKey);
  return (
    <ExpandableTabsContext.Provider value={{ expanded, toggle }}>
      <Tabs {...tabsProps}>
        {children}
      </Tabs>
    </ExpandableTabsContext.Provider>
  );
}

function ExpandableTabsListComponent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  const { expanded, toggle } = React.useContext(ExpandableTabsContext);
  // Hide tab bar when expanded — matches Settings pattern (content fills screen)
  // Press Escape or click the minimize button in the expanded content to exit
  if (expanded) {
    return (
      <div className="flex justify-end pb-1">
        <ExpandButton expanded={expanded} onToggle={toggle} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <TabsList className={cn("flex-1 min-w-0", className)} {...props}>
        {children}
      </TabsList>
      <ExpandButton expanded={false} onToggle={toggle} />
    </div>
  );
}

function ExpandableTabsSectionComponent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { expanded, toggle } = React.useContext(ExpandableTabsContext);
  return (
    <ExpandableSection expanded={expanded} onToggle={toggle} className={className}>
      {children}
    </ExpandableSection>
  );
}

export const ExpandableTabs = Object.assign(ExpandableTabsRoot, {
  List: ExpandableTabsListComponent,
  Section: ExpandableTabsSectionComponent,
});
