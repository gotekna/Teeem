
"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
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
  Trash2,
  RefreshCw,
  ClipboardCopy,
  Check,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { clearAllCachedRecords } from "@/lib/records-cache";
import {
  Persona,
  getStoredPersona,
  setStoredPersona,
} from "@/lib/personas";
import { useTheme } from "next-themes";
import { Button } from "./button";
import { ComboboxDropdown, type ComboboxItem } from "./combobox-dropdown";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import { Badge } from "./badge";
import { api, getCurrentEnvironment } from "@/lib/api";
import { COMPANY_TIMEZONE } from "@/lib/timezone-utils";
import { useTenantOptional } from "@/contexts/TenantContext";
import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigation, useToggleNavCollapse, type NavigationItem, type NavigationChildItem } from "@/hooks/useNavigation";
import { getIcon } from "@/lib/icon-map";
import { SIDEBAR_NAVIGATION_EVENT } from "@/contexts/BreadcrumbContext";
import consoleCapture from "@/utils/consoleCapture";
import { copyToClipboard } from "@/utils/formatters";

// Tenant info for sidebar display
interface TenantInfo {
  currentTenant: { id: number; name: string; slug: string; environment: string } | null;
  tenants: { id: number; name: string; slug: string; environment: string }[];
  isTeeemStaff: boolean;
  canSwitchTenants: boolean;
  switchTenant: (id: number) => Promise<boolean>;
  isLoading: boolean;
}

// Props interface for SidebarContent - extracted to maintain stable component identity
interface SidebarContentProps {
  mobile?: boolean;
  isExpanded: boolean;
  navRef: React.RefObject<HTMLElement | null>;
  navLoading: boolean;
  navError: boolean;
  apiNavigation: { items: NavigationItem[] } | undefined;
  renderNavItem: (item: NavigationItem, mobile: boolean) => React.ReactNode;
  backendVersion: string | null;
  herokuRelease: string | null;
  deployedAt: string | null;
  apiEnvironment: string | null;
  user: { name?: string; email?: string } | null;
  mounted: boolean;
  resolvedTheme: string | undefined;
  setTheme: (theme: string) => void;
  handleLogout: () => void;
  tenantInfo: TenantInfo | null;
}

// SidebarContent extracted OUTSIDE Sidebar to maintain stable React component identity
// This prevents unmount/remount of the nav element on every render
function SidebarContent({
  mobile = false,
  isExpanded,
  navRef,
  navLoading,
  navError,
  apiNavigation,
  renderNavItem,
  backendVersion,
  herokuRelease,
  deployedAt,
  apiEnvironment,
  user,
  mounted,
  resolvedTheme,
  setTheme,
  handleLogout,
  tenantInfo,
}: SidebarContentProps) {
  const queryClient = useQueryClient();
  const [clearing, setClearing] = useState(false);
  const [copiedConsole, setCopiedConsole] = useState(false);
  const [logCount, setLogCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [isDevOrStaging, setIsDevOrStaging] = useState(false);

  // Track console logs for the copy button (dev/staging only)
  useEffect(() => {
    const isDev = process.env.NODE_ENV === "development";
    const isStaging = typeof window !== "undefined" &&
      (window.location.hostname.includes("vercel.app") ||
       window.location.hostname.includes("staging") ||
       window.location.hostname === "localhost");

    const shouldShow = isDev || isStaging;
    setIsDevOrStaging(shouldShow);

    if (!shouldShow) return;

    consoleCapture.initialize();
    const unsubscribe = consoleCapture.subscribe((logs) => {
      setLogCount(logs.length);
      setErrorCount(logs.filter((log) => log.type === "error" || log.type === "warn").length);
    });

    // Initial count
    const logs = consoleCapture.getLogs();
    setLogCount(logs.length);
    setErrorCount(logs.filter((log) => log.type === "error" || log.type === "warn").length);

    return () => unsubscribe();
  }, []);

  const [copiedProblems, setCopiedProblems] = useState(false);

  // Copy ALL console logs
  const handleCopyConsole = async () => {
    try {
      const logs = consoleCapture.getLogs();
      let formatted = `=== All Console Logs ===\nTotal: ${logs.length}\nURL: ${window.location.href}\nCaptured: ${new Date().toLocaleString()}\n\n`;
      logs.forEach((log) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        formatted += `[${time}] [${log.type.toUpperCase()}] ${log.message}\n`;
      });
      await copyToClipboard(formatted);
      setCopiedConsole(true);
      setTimeout(() => setCopiedConsole(false), 2000);
    } catch (err) {
      console.error("Failed to copy console:", err);
    }
  };

  // Copy only errors + warnings (Problems)
  const handleCopyProblems = async () => {
    try {
      const logs = consoleCapture.getLogs();
      const problems = logs.filter((log) => log.type === "error" || log.type === "warn");
      let formatted = `=== Problems (Errors & Warnings) ===\nTotal: ${problems.length}\nURL: ${window.location.href}\nCaptured: ${new Date().toLocaleString()}\n\n`;
      problems.forEach((log) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        formatted += `[${time}] [${log.type.toUpperCase()}] ${log.message}\n`;
      });
      await copyToClipboard(formatted);
      setCopiedProblems(true);
      setTimeout(() => setCopiedProblems(false), 2000);
    } catch (err) {
      console.error("Failed to copy problems:", err);
    }
  };

  // Clear ALL app caches - use this after hotfixes
  const handleClearCache = async () => {
    setClearing(true);
    try {
      // 1. Clear React Query cache
      queryClient.clear();
      console.log("[ClearCache] React Query cache cleared");

      // 2. Clear records cache (L1 + L2)
      clearAllCachedRecords();
      console.log("[ClearCache] Records cache cleared");

      // 3. Clear app localStorage (but not auth)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.includes("token") && !key.includes("auth") && !key.includes("session")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // 4. Clear sessionStorage (but not auth)
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && !key.includes("token") && !key.includes("auth") && !key.includes("session")) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach((key) => sessionStorage.removeItem(key));

      console.log("[ClearCache] All caches cleared, reloading...");

      // Brief feedback then reload
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (err) {
      console.error("[ClearCache] Error:", err);
      setClearing(false);
    }
  };

  // Environment badge variant
  const getEnvironmentBadgeVariant = (env: string) => {
    switch (env) {
      case 'production':
        return 'default';
      case 'beta':
        return 'secondary';
      case 'staging':
        return 'outline';
      default:
        return 'outline';
    }
  };
  return (
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
      <nav ref={navRef} className="flex-1 py-4 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {navLoading ? (
          /* Loading state */
          <div className="flex items-center justify-center py-8">
            <Spinner size={20} className="text-muted-foreground" />
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

      {/* Footer: Company + Version + Debug Tools */}
      <div className="border-t border-border">
        {/* Company/Tenant + Environment */}
        {tenantInfo?.currentTenant && (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 group relative",
              !isExpanded && !mobile && "justify-center"
            )}
          >
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            {(isExpanded || mobile) ? (
              tenantInfo.isTeeemStaff && tenantInfo.canSwitchTenants ? (
                <ComboboxDropdown
                  items={tenantInfo.tenants.map((t) => ({
                    id: t.id.toString(),
                    label: t.name,
                  }))}
                  selectedItem={{
                    id: tenantInfo.currentTenant.id.toString(),
                    label: tenantInfo.currentTenant.name,
                  }}
                  onSelect={(item) => {
                    tenantInfo.switchTenant(parseInt(item.id, 10));
                  }}
                  disabled={tenantInfo.isLoading}
                  placeholder="Select tenant..."
                  searchPlaceholder="Search tenants..."
                  className="h-7 text-xs flex-1 min-w-0"
                  popoverProps={{ className: "w-[200px]" }}
                />
              ) : (
                <span className="text-xs font-medium truncate flex-1 min-w-0">
                  {tenantInfo.currentTenant.name}
                  {apiEnvironment && apiEnvironment !== "production" && (
                    <span className={cn(
                      "ml-1 text-[10px] font-bold uppercase",
                      apiEnvironment === "staging" ? "text-orange-500" : "text-yellow-600"
                    )}>
                      - {apiEnvironment}
                    </span>
                  )}
                </span>
              )
            ) : (
              <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border shadow-sm whitespace-nowrap">
                {tenantInfo.currentTenant.name}
                {apiEnvironment && apiEnvironment !== "production" && (
                  <span className={cn(
                    "ml-1 font-bold uppercase",
                    apiEnvironment === "staging" ? "text-orange-500" : "text-yellow-600"
                  )}>
                    - {apiEnvironment}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Version + Deploy Time */}
        {backendVersion && (isExpanded || mobile) && (
          <div className="px-3 py-1 text-[10px] text-muted-foreground">
            {backendVersion}{deployedAt && ` · ${deployedAt}`}
          </div>
        )}

        {/* Debug Tools - dev/staging only - 3 compact buttons */}
        {(isExpanded || mobile) && isDevOrStaging && (
          <div className="px-2 py-1 grid grid-cols-3 gap-0.5">
            <button
              onClick={handleCopyConsole}
              className={cn(
                "flex items-center justify-center gap-0.5 py-0.5 rounded text-[9px] font-medium transition-all border",
                copiedConsole
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              )}
              title="Copy all console logs"
            >
              {copiedConsole ? <Check className="h-2.5 w-2.5" /> : <ClipboardCopy className="h-2.5 w-2.5" />}
              <span>{logCount}</span>
            </button>
            <button
              onClick={handleCopyProblems}
              className={cn(
                "flex items-center justify-center gap-0.5 py-0.5 rounded text-[9px] font-medium transition-all border",
                copiedProblems
                  ? "bg-green-600 text-white border-green-600"
                  : errorCount > 0
                    ? "bg-red-100 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              )}
              title="Copy errors & warnings"
            >
              {copiedProblems ? <Check className="h-2.5 w-2.5" /> : <span>!</span>}
              <span>{errorCount}</span>
            </button>
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className={cn(
                "flex items-center justify-center gap-0.5 py-0.5 rounded text-[9px] font-medium transition-all border",
                clearing
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-red-100 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50"
              )}
              title="Clear cache + hard refresh"
            >
              <Trash2 className="h-2.5 w-2.5" />
              <RefreshCw className="h-2 w-2" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isExpanded, setIsExpanded } = useSidebar();
  const [persona, setPersona] = useState<Persona>('manager');
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [emailAccountBadges, setEmailAccountBadges] = useState<Record<string, number>>({});
  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const [herokuRelease, setHerokuRelease] = useState<string | null>(null);
  const [apiEnvironment, setApiEnvironment] = useState<string | null>(null);

  // Fetch navigation from API (SSoT - order from NavigationItem, collapse from user prefs)
  const { data: apiNavigation, isLoading: navLoading, isError: navError } = useNavigation();
  const toggleCollapseMutation = useToggleNavCollapse();
  const [deployedAt, setDeployedAt] = useState<string | null>(null);
  const [loadingHref, setLoadingHref] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();

  // Tenant context for company/environment display
  const tenantContext = useTenantOptional();

  // Track mounted state for theme hydration (next-themes fix)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load API environment - prefer TenantContext (for tenant switching), fallback to localStorage
  useEffect(() => {
    // First check TenantContext (for TEEEM staff switching tenants)
    const tenantEnv = tenantContext?.currentTenant?.environment;
    if (tenantEnv && tenantEnv !== 'production') {
      setApiEnvironment(tenantEnv.charAt(0).toUpperCase() + tenantEnv.slice(1));
      return;
    }
    // Fallback to localStorage (set during login)
    const env = getCurrentEnvironment();
    if (env && env !== 'production') {
      setApiEnvironment(env.charAt(0).toUpperCase() + env.slice(1));
    } else {
      setApiEnvironment(null);
    }
  }, [tenantContext?.currentTenant?.environment]);

  // Prevent duplicate fetches (React StrictMode double-mount)
  const badgeFetchingRef = useRef(false);

  // Ref for the nav element - stable now that SidebarContent is outside the component
  const navRef = useRef<HTMLElement | null>(null);
  const savedScrollRef = useRef<number>(0);

  // Restore scroll position after pathname changes (navigation completes)
  // Use multiple attempts because something may reset scroll after first restore
  useLayoutEffect(() => {
    if (navRef.current && savedScrollRef.current > 0) {
      const scrollTo = savedScrollRef.current;
      navRef.current.scrollTop = scrollTo;

      // Restore again after React finishes rendering
      requestAnimationFrame(() => {
        if (navRef.current) navRef.current.scrollTop = scrollTo;
        requestAnimationFrame(() => {
          if (navRef.current) navRef.current.scrollTop = scrollTo;
        });
      });
    }
  }, [pathname]);

  // Clear loading state when navigation completes
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
          // SSoT: Uses COMPANY_TIMEZONE from timezone-utils.ts
          const brisbaneTime = mostRecentTime.toLocaleString('en-AU', {
            timeZone: COMPANY_TIMEZONE,
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

      // Load unread email counts
      const emailResponse = await safeFetch<{ total: number; by_account: Array<{ email: string; count: number }> }>(
        "/api/v1/synced_emails/unread_counts"
      );
      if (emailResponse) {
        setBadges(prev => ({ ...prev, unreadEmails: emailResponse.total || 0 }));
        // Store per-account counts for email account badges
        const accountBadges: Record<string, number> = {};
        (emailResponse.by_account || []).forEach(({ email, count }) => {
          if (email) {
            accountBadges[email.toLowerCase()] = count;
          }
        });
        setEmailAccountBadges(accountBadges);
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

  // Handle navigation click
  const handleNavClick = (href: string, isActiveItem: boolean) => {
    // Save scroll position BEFORE navigation triggers re-render
    if (navRef.current) {
      savedScrollRef.current = navRef.current.scrollTop;
    }

    // Always reset breadcrumb trail when clicking sidebar - starting new navigation flow
    window.dispatchEvent(new CustomEvent(SIDEBAR_NAVIGATION_EVENT));

    if (!isActiveItem) {
      setLoadingHref(href);
    }
  };

  // Render a navigation link
  const renderNavLink = (
    item: { href: string; icon: string; name: string; badge_key?: string | null },
    isChild = false,
    mobile = false,
    isGrandchild = false, // 2nd level nesting
    hasChevron = false // Has chevron next to it (reduces padding)
  ) => {
    const ItemIcon = getIcon(item.icon);
    const active = isActive(item.href);
    // Check for email account badge (href like /email/x@y.com or /email?account=X)
    const isEmailAccount = item.href.startsWith('/email/') || item.href.startsWith('/email?account=');
    const emailAccountCount = isEmailAccount ? (emailAccountBadges[item.name.toLowerCase()] ?? 0) : null;
    const badgeCount = emailAccountCount !== null ? emailAccountCount : (item.badge_key ? badges[item.badge_key] : 0);
    const showBadge = emailAccountCount !== null || badgeCount > 0; // Always show for email accounts
    const isItemLoading = loadingHref === item.href;

    // Handle double-click to open email account in standalone mode (new tab)
    const handleDoubleClick = (e: React.MouseEvent) => {
      if (isEmailAccount) {
        e.preventDefault();
        // Use path segment for standalone: /email/x@y.com/standalone
        const standaloneUrl = `${item.href}/standalone`;
        window.open(standaloneUrl, '_blank');
      }
    };

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        onClick={() => handleNavClick(item.href, active)}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "flex items-center gap-3 px-3 py-1.5 transition-colors relative group",
          isChild && (isExpanded || mobile) && !isGrandchild && !hasChevron && "pl-10",
          isChild && (isExpanded || mobile) && !isGrandchild && hasChevron && "pl-1", // Less padding when chevron present
          isGrandchild && (isExpanded || mobile) && "pl-14", // Indent beyond parent
          active
            ? "bg-secondary text-secondary-foreground"
            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
        )}
      >
        <div className="relative shrink-0">
          {isItemLoading ? (
            <Spinner size={16} className="text-primary" />
          ) : (
            <ItemIcon size={16} />
          )}
          {showBadge && !isExpanded && !mobile && (
            <span className={cn(
              "absolute -top-1.5 -right-1.5 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center",
              badgeCount > 0 ? "bg-yellow-500" : "bg-muted-foreground/50"
            )}>
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </div>
        <span
          className={cn(
            "whitespace-nowrap transition-all duration-300 overflow-hidden text-sm flex items-center gap-2",
            isExpanded || mobile ? "opacity-100 w-auto" : "opacity-0 w-0",
            isItemLoading && "opacity-50",
            hasChevron && "font-semibold" // Bold for items with children
          )}
        >
          {item.name}
          {showBadge && (isExpanded || mobile) && (
            <Badge className={cn(
              "text-xs px-1.5 py-0",
              badgeCount > 0
                ? "bg-yellow-500 text-white hover:bg-yellow-500"
                : "bg-muted text-muted-foreground hover:bg-muted"
            )}>
              {badgeCount}
            </Badge>
          )}
        </span>
        {!isExpanded && !mobile && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border shadow-sm whitespace-nowrap flex items-center gap-2">
            {item.name}
            {showBadge && (
              <Badge className={cn(
                "text-xs px-1.5 py-0",
                badgeCount > 0
                  ? "bg-yellow-500 text-white hover:bg-yellow-500"
                  : "bg-muted text-muted-foreground hover:bg-muted"
              )}>
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
            onClick={() => handleNavClick(item.href, active)}
            className={cn(
              "flex-1 flex items-center gap-3 px-3 py-1.5 transition-colors relative group",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            <div className="relative shrink-0">
              {isItemLoading ? (
                <Spinner size={16} className="text-primary" />
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
                isItemLoading && "opacity-50",
                hasChildren && "font-semibold"
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

        {/* Children (when expanded) - supports 2 levels of nesting */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col">
            {item.children.map((child) => {
              const hasGrandchildren = child.has_children && child.children && child.children.length > 0;
              const isChildCollapsed = child.is_collapsed ?? false;

              if (hasGrandchildren) {
                // Child has grandchildren - render recursively
                return (
                  <div key={child.id}>
                    <div className="flex items-center">
                      {/* Expand/collapse for children with grandchildren */}
                      {(isExpanded || mobile) && (
                        <button
                          onClick={() => toggleItemCollapse(child.id)}
                          className="p-1 hover:bg-secondary/50 rounded shrink-0 ml-7"
                        >
                          <ChevronDown
                            size={12}
                            className={cn(
                              "transition-transform text-muted-foreground",
                              isChildCollapsed && "-rotate-90"
                            )}
                          />
                        </button>
                      )}
                      {(!isExpanded && !mobile) && <div className="w-0" />}
                      {renderNavLink(
                        {
                          href: child.href,
                          icon: child.icon,
                          name: child.name,
                          badge_key: child.badge_key,
                        },
                        true,
                        mobile,
                        false, // Not double-nested yet
                        true // Has chevron next to it
                      )}
                    </div>
                    {/* Grandchildren */}
                    {!isChildCollapsed && child.children && (
                      <div className="flex flex-col">
                        {child.children.map((grandchild) =>
                          renderNavLink(
                            {
                              href: grandchild.href,
                              icon: grandchild.icon,
                              name: grandchild.name,
                              badge_key: grandchild.badge_key,
                            },
                            true,
                            mobile,
                            true // Double-nested (grandchild)
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // Child without grandchildren - simple render
              return renderNavLink(
                {
                  href: child.href,
                  icon: child.icon,
                  name: child.name,
                  badge_key: child.badge_key,
                },
                true,
                mobile
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Common props for SidebarContent
  // Build tenant info for sidebar display
  const tenantInfo: TenantInfo | null = tenantContext ? {
    currentTenant: tenantContext.currentTenant,
    tenants: tenantContext.tenants,
    isTeeemStaff: tenantContext.isTeeemStaff,
    canSwitchTenants: tenantContext.canSwitchTenants,
    switchTenant: tenantContext.switchTenant,
    isLoading: tenantContext.isLoading,
  } : null;

  const sidebarContentProps = {
    isExpanded,
    navRef,
    navLoading,
    navError,
    apiNavigation,
    renderNavItem,
    backendVersion,
    herokuRelease,
    deployedAt,
    apiEnvironment,
    user,
    mounted,
    resolvedTheme,
    setTheme,
    handleLogout,
    tenantInfo,
  };

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
            <SidebarContent {...sidebarContentProps} mobile />
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
        <SidebarContent {...sidebarContentProps} />
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
