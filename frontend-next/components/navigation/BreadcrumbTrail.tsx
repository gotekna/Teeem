"use client";

/**
 * Breadcrumb Trail Bar
 *
 * Shows navigation path as clickable breadcrumbs.
 * Position: Below HeaderBar, respects sidebar width
 * Always visible when trail has items.
 *
 * Props:
 * - topOffset: Distance from top (default: 48px for HeaderBar)
 *
 * Features:
 * - Horizontal scroll for overflow
 * - Dark mode support
 */

import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Home,
  Building2,
  Users,
  ShoppingCart,
  BookOpen,
  Calculator,
  Target,
  DollarSign,
  Building,
  Shield,
  FileText,
  Settings,
  Link,
  Database,
  GraduationCap,
  LayoutDashboard,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";
import { useLayoutMode } from "@/contexts/LayoutModeContext";
import {
  breadcrumbTrailAtom,
  type BreadcrumbItem,
} from "@/lib/breadcrumb-atoms";
import { tableFullscreenAtom } from "@/lib/table-atoms";

/**
 * Icon mapping for dynamic icon rendering
 */
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Building2,
  Users,
  ShoppingCart,
  BookOpen,
  Calculator,
  Target,
  DollarSign,
  Building,
  Shield,
  FileText,
  Settings,
  Link,
  Database,
  GraduationCap,
  Home,
  Warehouse,
};

/**
 * Get icon component by name
 */
function getIconComponent(iconName?: string): React.ElementType | null {
  if (!iconName) return null;
  return ICON_MAP[iconName] || null;
}

/**
 * Height of the breadcrumb bar in pixels
 * Used for layout calculations when pinned
 */
export const BREADCRUMB_BAR_HEIGHT = 41;

interface BreadcrumbTrailProps {
  /** Distance from top of viewport (default: 48px for HeaderBar) */
  topOffset?: number;
}

export function BreadcrumbTrail({ topOffset = 48 }: BreadcrumbTrailProps) {
  const trail = useAtomValue(breadcrumbTrailAtom);
  const isTableFullscreen = useAtomValue(tableFullscreenAtom);
  const router = useRouter();
  const { sidebarWidth } = useSidebar();
  const { shouldHideSidebar } = useLayoutMode();

  // Don't render if trail is empty or in fullscreen mode (table or layout)
  if (trail.length === 0 || isTableFullscreen || shouldHideSidebar) return null;

  // Calculate left offset based on sidebar
  const leftOffset = shouldHideSidebar ? 0 : sidebarWidth;

  /**
   * Navigate to a breadcrumb item
   */
  const handleItemClick = (item: BreadcrumbItem) => {
    const url = item.searchParams
      ? `${item.pathname}?${item.searchParams}`
      : item.pathname;
    router.push(url);
  };

  return (
    <div
      className={cn(
        // Position: Below HeaderBar, respects sidebar
        // z-[110] to appear above fullscreen tabs like Plans (z-[100])
        "fixed right-0 z-[110] hidden md:block"
      )}
      style={{ left: leftOffset, top: topOffset }}
    >
      <div className="bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="px-4 py-1.5 flex items-center">
          {/* Breadcrumb items */}
          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide min-w-0 flex-1">
            {trail.map((item, index) => {
              const Icon = getIconComponent(item.icon);
              const isLast = index === trail.length - 1;

              return (
                <div key={item.id} className="flex items-center shrink-0">
                  {/* Separator */}
                  {index > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-0.5 shrink-0" />
                  )}

                  {/* Breadcrumb button */}
                  <button
                    onClick={() => {
                      if (!isLast) {
                        handleItemClick(item);
                      }
                    }}
                    disabled={isLast}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors",
                      isLast
                        ? "font-medium text-foreground cursor-default"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                    )}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                    <span className={cn("truncate", isLast ? "max-w-[400px]" : "max-w-[180px]")}>
                      {item.displayName}
                    </span>
                  </button>
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
