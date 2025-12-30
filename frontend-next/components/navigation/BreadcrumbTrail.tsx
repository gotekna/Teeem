"use client";

/**
 * Breadcrumb Trail Floating Overlay
 *
 * Shows navigation path as clickable breadcrumbs.
 * Position: Below HeaderBar (top-12), respects sidebar width
 *
 * Features:
 * - Slide in/out animation
 * - Pin button to keep visible and push content down
 * - Hover zone to reveal when unpinned
 * - Horizontal scroll for overflow
 * - Dark mode support
 */

import { useAtom, useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Pin,
  PinOff,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";
import { useLayoutMode } from "@/contexts/LayoutModeContext";
import {
  breadcrumbTrailAtom,
  breadcrumbPinnedAtom,
  breadcrumbVisibleAtom,
  type BreadcrumbItem,
} from "@/lib/breadcrumb-atoms";

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
export const BREADCRUMB_BAR_HEIGHT = 36;

export function BreadcrumbTrail() {
  const trail = useAtomValue(breadcrumbTrailAtom);
  const [isPinned, setIsPinned] = useAtom(breadcrumbPinnedAtom);
  const [isVisible, setIsVisible] = useAtom(breadcrumbVisibleAtom);
  const router = useRouter();
  const { sidebarWidth } = useSidebar();
  const { shouldHideSidebar } = useLayoutMode();

  // Don't render if trail is empty
  if (trail.length === 0) return null;

  // Show when pinned or when visible via hover
  const shouldShow = isPinned || isVisible;

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
    <>
      {/* Hover trigger zone - invisible strip at top when not pinned */}
      {!isPinned && !isVisible && (
        <div
          className="fixed top-12 right-0 h-3 z-[45] bg-transparent cursor-pointer hidden md:block"
          style={{ left: leftOffset }}
          onMouseEnter={() => setIsVisible(true)}
        />
      )}

      {/* Breadcrumb bar */}
      <div
        className={cn(
          // Position: Below HeaderBar (h-12 = 48px), respects sidebar
          "fixed top-12 right-0 z-[45] hidden md:block",
          // Slide animation
          "transition-all duration-200 ease-in-out",
          shouldShow
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        )}
        style={{ left: leftOffset }}
        onMouseEnter={() => !isPinned && setIsVisible(true)}
        onMouseLeave={() => !isPinned && setIsVisible(false)}
      >
        <div className="bg-background/95 backdrop-blur-sm border-b shadow-sm">
          <div className="px-4 py-1.5 flex items-center justify-between">
            {/* Breadcrumb items */}
            <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide min-w-0 flex-1 pr-2">
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
                      onClick={() => !isLast && handleItemClick(item)}
                      disabled={isLast}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors",
                        isLast
                          ? "font-medium text-foreground cursor-default"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                      )}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate max-w-[180px]">
                        {item.displayName}
                      </span>
                    </button>
                  </div>
                );
              })}
            </nav>

            {/* Pin button */}
            <button
              onClick={() => setIsPinned(!isPinned)}
              className={cn(
                "p-1.5 rounded transition-colors shrink-0 ml-2",
                isPinned
                  ? "text-primary bg-primary/10 hover:bg-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={isPinned ? "Unpin breadcrumb trail" : "Pin breadcrumb trail"}
            >
              {isPinned ? (
                <Pin className="h-4 w-4" />
              ) : (
                <PinOff className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
