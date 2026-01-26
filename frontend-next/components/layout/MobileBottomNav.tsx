"use client";

/**
 * MobileBottomNav
 *
 * Fixed bottom navigation bar for mobile devices.
 * Provides quick access to key areas: Jobs, Tasks, Photos, POs, More.
 *
 * Only renders on mobile (< 768px viewport).
 * Uses the same navigation patterns as the sidebar.
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  CheckSquare,
  Camera,
  FileText,
  Menu,
  Home,
  FolderOpen,
  Settings,
  X,
} from "lucide-react";
import { useIsMobile } from "@/lib/hooks/use-device-context";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Match paths that start with this prefix */
  matchPrefix?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Navigation Items
// ═══════════════════════════════════════════════════════════════════════════

const BOTTOM_NAV_ITEMS: NavItem[] = [
  {
    id: "jobs",
    label: "Jobs",
    href: "/jobs",
    icon: Briefcase,
    matchPrefix: "/jobs",
  },
  {
    id: "tasks",
    label: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    matchPrefix: "/tasks",
  },
  {
    id: "photos",
    label: "Photos",
    href: "/job-photos",
    icon: Camera,
    matchPrefix: "/job-photos",
  },
  {
    id: "pos",
    label: "POs",
    href: "/purchase-orders",
    icon: FileText,
    matchPrefix: "/purchase-orders",
  },
];

const MORE_MENU_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    id: "warehouse",
    label: "Warehouse",
    href: "/warehouse",
    icon: FolderOpen,
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    matchPrefix: "/settings",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Don't render on desktop
  if (!isMobile) {
    return null;
  }

  // Check if a nav item is active
  const isActive = (item: NavItem) => {
    if (item.matchPrefix) {
      return pathname.startsWith(item.matchPrefix);
    }
    return pathname === item.href;
  };

  // Check if any "More" item is active
  const isMoreActive = MORE_MENU_ITEMS.some((item) => isActive(item));

  return (
    <>
      {/* Fixed bottom navigation */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden",
          "bg-background border-t border-border",
          "safe-area-inset-bottom" // For iOS notch/home indicator
        )}
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {/* Main nav items */}
          {BOTTOM_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center",
                  "min-w-[64px] h-full px-2",
                  "text-xs font-medium transition-colors",
                  "touch-manipulation", // Prevent double-tap zoom
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 mb-1",
                    active && "text-primary"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {/* More menu (Sheet) */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center",
                  "min-w-[64px] h-full px-2",
                  "text-xs font-medium transition-colors",
                  "touch-manipulation",
                  isMoreActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="More options"
              >
                <Menu
                  className={cn(
                    "h-6 w-6 mb-1",
                    isMoreActive && "text-primary"
                  )}
                />
                <span>More</span>
              </button>
            </SheetTrigger>

            <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-xl">
              <SheetTitle className="sr-only">More navigation options</SheetTitle>
              <div className="py-4">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-lg font-semibold">More</h3>
                  <button
                    onClick={() => setMoreOpen(false)}
                    className="p-2 rounded-full hover:bg-muted"
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 px-2">
                  {MORE_MENU_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex flex-col items-center justify-center",
                          "p-4 rounded-xl transition-colors",
                          "touch-manipulation",
                          active
                            ? "bg-primary/10 text-primary"
                            : "bg-muted/50 hover:bg-muted text-foreground"
                        )}
                      >
                        <Icon className="h-8 w-8 mb-2" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
}

export default MobileBottomNav;
