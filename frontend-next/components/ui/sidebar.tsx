
"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  Users,
  Settings,
  Sun,
  Moon,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  Persona,
  getStoredPersona,
  setStoredPersona,
} from "@/lib/personas";
import { useTheme } from "next-themes";
import { Button } from "./button";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import { Badge } from "./badge";
import { api } from "@/lib/api";
import { useNavigation, useToggleNavCollapse, type NavigationItem, type NavigationChildItem } from "@/hooks/useNavigation";
import { getIcon } from "@/lib/icon-map";

export function Sidebar() {
  const { isExpanded, setIsExpanded } = useSidebar();
  const [persona, setPersona] = useState<Persona>('manager');
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const [herokuRelease, setHerokuRelease] = useState<string | null>(null);

  // Fetch navigation from API (SSoT - order from NavigationItem, collapse from user prefs)
  const { data: apiNavigation, isLoading: navLoading, isError: navError } = useNavigation();
  const toggleCollapseMutation = useToggleNavCollapse();
  const [deployedAt, setDeployedAt] = useState<string | null>(null);
  const [loadingHref, setLoadingHref] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();

  // Prevent duplicate fetches (React StrictMode double-mount)
  const badgeFetchingRef = useRef(false);

  // Clear loading state when navigation completes (pathname changes)
  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  // Load persona from localStorage on mount
  useEffect(() => {
    setPersona(getStoredPersona());
  }, []);

  // Collapse state is now managed by the API (stored in database per user)
  // No need for local state - use apiNavigation.items[].is_collapsed directly

  // Load backend version
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const response = await api.get<{ version: string; heroku_release?: string; timestamp?: string }>("/version");
        setBackendVersion(response.version);
        if (response?.heroku_release) {
          setHerokuRelease(response.heroku_release);
        }
        // Compare backend deploy time with frontend build time, show most recent
        const backendTime = response.timestamp ? new Date(response.timestamp) : null;
        const frontendTime = process.env.NEXT_PUBLIC_BUILD_TIME ? new Date(process.env.NEXT_PUBLIC_BUILD_TIME) : null;

        // Use whichever is more recent
        let mostRecentTime = backendTime;
        if (frontendTime && (!backendTime || frontendTime > backendTime)) {
          mostRecentTime = frontendTime;
        }

        if (mostRecentTime) {
          // Format in Brisbane timezone (Australia/Brisbane)
          const brisbaneTime = mostRecentTime.toLocaleString('en-AU', {
            timeZone: 'Australia/Brisbane',
            hour: 'numeric',
            minute: '2-digit',
            day: 'numeric',
            month: 'numeric',
            hour12: false
          });
          // Parse "5/12, 15:50" format to "15:50 5/12"
          const parts = brisbaneTime.split(', ');
          if (parts.length === 2) {
            setDeployedAt(`${parts[1]} ${parts[0]}`);
          } else {
            setDeployedAt(brisbaneTime);
          }
        }
      } catch (error) {
        console.debug("Failed to load backend version:", error);
      }
    };
    loadVersion();
  }, []);

  // Load badge counts (pending proposals, etc.)
  useEffect(() => {
    // Helper to safely fetch with retry on auth errors
    const safeFetch = async <T,>(
      endpoint: string,
      retries = 2,
      delay = 500
    ): Promise<T | null> => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await api.get<T>(endpoint);
        } catch (error: unknown) {
          const isAuthError = error instanceof Error &&
            (error.message.includes('401') ||
             error.message.includes('Unauthorized') ||
             error.message.includes('Session expired'));

          // Don't retry auth errors - user needs to re-login
          if (isAuthError) {
            return null;
          }

          // Retry transient errors with delay
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
          }
        }
      }
      return null;
    };

    const loadBadgeCounts = async () => {
      // Load pending email job proposals count (for Leads)
      const jobResponse = await safeFetch<{ proposals: Array<{ status: string }> }>(
        "/api/v1/email_job_proposals?status=pending"
      );
      if (jobResponse) {
        const pendingJobCount = (jobResponse.proposals || []).filter(p => p.status === "pending").length;
        setBadges(prev => ({ ...prev, pendingProposals: pendingJobCount }));
      }

      // Load pending email case proposals count (for Cases)
      const caseResponse = await safeFetch<{ proposals: Array<{ status: string }> }>(
        "/api/v1/email_case_proposals?status=pending"
      );
      if (caseResponse) {
        const pendingCaseCount = (caseResponse.proposals || []).filter(p => p.status === "pending").length;
        setBadges(prev => ({ ...prev, pendingCaseProposals: pendingCaseCount }));
      }

      // Load pending bills count (for Finance)
      const billResponse = await safeFetch<{ pending: number; errors: number; awaiting_approval: number }>(
        "/api/v1/bill_inbox/stats"
      );
      if (billResponse) {
        // Show badge for pending + errors + awaiting approval
        const pendingBillsCount = (billResponse.pending || 0) + (billResponse.errors || 0) + (billResponse.awaiting_approval || 0);
        setBadges(prev => ({ ...prev, pendingBills: pendingBillsCount }));
      }

      // Load pending plans count (for Plans under Documents)
      const plansResponse = await safeFetch<{ pending_count: number }>(
        "/api/v1/plan_folder_scans/pending_count"
      );
      if (plansResponse) {
        setBadges(prev => ({ ...prev, plans_pending: plansResponse.pending_count || 0 }));
      }
    };

    if (isAuthenticated) {
      // Prevent duplicate fetches on React StrictMode double-mount
      if (badgeFetchingRef.current) return;
      badgeFetchingRef.current = true;

      // Small delay to ensure auth state is fully propagated
      const initialDelay = setTimeout(() => {
        loadBadgeCounts();
      }, 100);

      // Refresh every 60 seconds
      const interval = setInterval(loadBadgeCounts, 60000);
      return () => {
        clearTimeout(initialDelay);
        clearInterval(interval);
        badgeFetchingRef.current = false;
      };
    }
  }, [isAuthenticated]);

  const handlePersonaChange = (newPersona: Persona) => {
    setPersona(newPersona);
    setStoredPersona(newPersona);
  };

  // Toggle item collapsed state (saves to database via API)
  const toggleItemCollapse = (itemId: number) => {
    toggleCollapseMutation.mutate(itemId);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  // Render a navigation link
  const renderNavLink = (
    item: { href: string; icon: string; name: string; badge_key?: string | null },
    isChild = false,
    mobile = false
  ) => {
    const ItemIcon = getIcon(item.icon);
    const active = isActive(item.href);
    const badgeCount = item.badge_key ? badges[item.badge_key] : 0;
    const isItemLoading = loadingHref === item.href;

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        onClick={() => !active && setLoadingHref(item.href)}
        className={cn(
          "flex items-center gap-3 px-3 py-1.5 transition-colors relative group",
          isChild && (isExpanded || mobile) && "pl-7",
          active
            ? "bg-secondary text-secondary-foreground"
            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
        )}
      >
        <div className="relative shrink-0">
          {isItemLoading ? (
            <Loader2 size={16} className="animate-spin text-primary" />
          ) : (
            <ItemIcon size={16} />
          )}
          {badgeCount > 0 && !isExpanded && !mobile && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-yellow-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </div>
        <span
          className={cn(
            "whitespace-nowrap transition-all duration-300 overflow-hidden text-sm flex items-center gap-2",
            isExpanded || mobile ? "opacity-100 w-auto" : "opacity-0 w-0",
            isItemLoading && "opacity-50"
          )}
        >
          {item.name}
          {badgeCount > 0 && (isExpanded || mobile) && (
            <Badge className="bg-yellow-500 text-white hover:bg-yellow-500 text-xs px-1.5 py-0">
              {badgeCount}
            </Badge>
          )}
        </span>
        {!isExpanded && !mobile && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border shadow-sm whitespace-nowrap flex items-center gap-2">
            {item.name}
            {badgeCount > 0 && (
              <Badge className="bg-yellow-500 text-white hover:bg-yellow-500 text-xs px-1.5 py-0">
                {badgeCount}
              </Badge>
            )}
          </div>
        )}
      </Link>
    );
  };

  // Render a navigation item that can have children
  const renderNavItem = (item: NavigationItem, mobile = false) => {
    const ItemIcon = getIcon(item.icon);
    const active = isActive(item.href);
    const badgeCount = item.badge_key ? badges[item.badge_key] : 0;
    const isItemLoading = loadingHref === item.href;
    const hasChildren = item.has_children && item.children.length > 0;
    const isCollapsed = item.is_collapsed; // From API (stored in database per user)

    return (
      <div key={item.id}>
        <div className="flex items-center">
          {/* Expand/collapse button for items with children */}
          {hasChildren && (isExpanded || mobile) && (
            <button
              onClick={() => toggleItemCollapse(item.id)}
              className="p-1 hover:bg-secondary/50 rounded shrink-0 ml-1"
            >
              <ChevronDown
                size={14}
                className={cn(
                  "transition-transform text-muted-foreground",
                  isCollapsed && "-rotate-90"
                )}
              />
            </button>
          )}
          {/* Spacer when no children or collapsed sidebar */}
          {(!hasChildren || (!isExpanded && !mobile)) && (
            <div className={cn("shrink-0", isExpanded || mobile ? "w-6" : "w-0")} />
          )}

          {/* Main nav link */}
          <Link
            href={item.href}
            prefetch={false}
            onClick={() => !active && setLoadingHref(item.href)}
            className={cn(
              "flex-1 flex items-center gap-3 px-3 py-1.5 transition-colors relative group",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            <div className="relative shrink-0">
              {isItemLoading ? (
                <Loader2 size={16} className="animate-spin text-primary" />
              ) : (
                <ItemIcon size={16} />
              )}
              {badgeCount > 0 && !isExpanded && !mobile && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-yellow-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </div>
            <span
              className={cn(
                "whitespace-nowrap transition-all duration-300 overflow-hidden text-sm flex items-center gap-2",
                isExpanded || mobile ? "opacity-100 w-auto" : "opacity-0 w-0",
                isItemLoading && "opacity-50"
              )}
            >
              {item.name}
              {badgeCount > 0 && (isExpanded || mobile) && (
                <Badge className="bg-yellow-500 text-white hover:bg-yellow-500 text-xs px-1.5 py-0">
                  {badgeCount}
                </Badge>
              )}
            </span>
            {!isExpanded && !mobile && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border shadow-sm whitespace-nowrap flex items-center gap-2">
                {item.name}
                {badgeCount > 0 && (
                  <Badge className="bg-yellow-500 text-white hover:bg-yellow-500 text-xs px-1.5 py-0">
                    {badgeCount}
                  </Badge>
                )}
              </div>
            )}
          </Link>
        </div>

        {/* Children (when expanded) */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col">
            {item.children.map((child) =>
              renderNavLink(
                {
                  href: child.href,
                  icon: child.icon,
                  name: child.name,
                  badge_key: child.badge_key,
                },
                true,
                mobile
              )
            )}
          </div>
        )}
      </div>
    );
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo - only on mobile sheet */}
      {mobile && (
        <div className="h-[70px] flex items-center border-b border-border px-4">
          <Link prefetch={false} href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              t
            </div>
            <span className="font-serif">teeem</span>
          </Link>
        </div>
      )}

      {/* Main Navigation - SSoT from NavigationItem table */}
      <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {navLoading ? (
          /* Loading state */
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : navError ? (
          /* Error state */
          <div className="px-3 py-2 text-sm text-muted-foreground">
            Failed to load navigation
          </div>
        ) : apiNavigation?.items ? (
          /* API-driven navigation with nested items */
          apiNavigation.items.map((item) => renderNavItem(item, mobile))
        ) : null}
      </nav>

      {/* Version Info */}
      {(backendVersion || process.env.NEXT_PUBLIC_BUILD_NUMBER) && (
        <div
          className={cn(
            "px-3 py-2 text-[10px] text-muted-foreground border-t border-border",
            !isExpanded && !mobile && "text-center"
          )}
        >
          {isExpanded || mobile ? (
            <div className="flex flex-col gap-0.5">
              {backendVersion && <span>Backend: {backendVersion}</span>}
              {process.env.NEXT_PUBLIC_BUILD_NUMBER && (
                <span>Frontend: v{process.env.NEXT_PUBLIC_BUILD_NUMBER}</span>
              )}
              {herokuRelease && <span>Heroku: {herokuRelease}</span>}
              {deployedAt && <span>D: {deployedAt}</span>}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {backendVersion && <span>{backendVersion}</span>}
              {process.env.NEXT_PUBLIC_BUILD_NUMBER && (
                <span>v{process.env.NEXT_PUBLIC_BUILD_NUMBER}</span>
              )}
              {herokuRelease && <span>{herokuRelease}</span>}
            </div>
          )}
        </div>
      )}

      {/* User Profile */}
      <div className="p-2 border-t border-border">
        <Popover>
          <PopoverTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-3 p-2 hover:bg-secondary/50 transition-colors cursor-pointer rounded-md",
                !isExpanded && !mobile && "justify-center"
              )}
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src="" />
                <AvatarFallback>
                  {user?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              {(isExpanded || mobile) && (
                <div className="flex flex-col overflow-hidden flex-1">
                  <span className="text-sm font-medium truncate">{user?.name || "User"}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {user?.email || ""}
                  </span>
                </div>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" className="w-56 p-2 ml-2">
            <div className="flex flex-col gap-1">
              <Link
                href="/profile"
                prefetch={false}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
              >
                <Users className="h-4 w-4" />
                Profile
              </Link>
              <Link
                href="/settings"
                prefetch={false}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors w-full text-left"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors w-full text-left text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b bg-background z-50 flex items-center px-4 justify-between">
        <Link prefetch={false} href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center">
            t
          </div>
          <span className="font-serif">teeem</span>
        </Link>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px]">
            <SidebarContent mobile />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar - positioned by parent wrapper in layout */}
      <aside
        className={cn(
          "md:flex h-full flex-shrink-0 flex-col justify-between transition-all duration-300 ease-in-out bg-background border-r border-border",
          isExpanded ? "w-[240px]" : "w-[70px]"
        )}
      >
        <SidebarContent />
        {/* Chevron Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-background border border-border rounded-full flex items-center justify-center hover:bg-secondary transition-colors shadow-sm z-10"
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </aside>
    </>
  );
}
