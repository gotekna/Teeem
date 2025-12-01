"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useSidebar, COLLAPSED_WIDTH, EXPANDED_WIDTH } from "@/contexts/SidebarContext";
import {
  Home,
  Briefcase,
  Calendar,
  Shield,
  DollarSign,
  Users,
  FileText,
  GraduationCap,
  Settings,
  Sun,
  Moon,
  Menu,
  LogOut,
  FolderOpen,
  Target,
  Package,
  Building2,
  LayoutTemplate,
  ListTodo,
  MessageSquare,
  FileQuestion,
  Layers,
  CalendarClock,
  ExternalLink,
  HardHat,
  LayoutGrid,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Network,
  Wrench,
} from "lucide-react";
import {
  Persona,
  PERSONA_CONFIG,
  PERSONA_ORDER,
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
import { urls, TABLE_IDS } from "@/lib/url-utils";

interface NavigationItem {
  name: string;
  href: string;
  icon: typeof Home;
  badgeKey?: string;
  tableId?: number;
}

const navigationItems: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Leads", href: "/leads", icon: Target, badgeKey: "pendingProposals" },
  { name: "Jobs", href: urls.jobs(), icon: Briefcase, tableId: TABLE_IDS.JOBS },
  { name: "Tasks", href: "/tasks", icon: ListTodo },
  { name: "Schedule", href: "/schedule-master", icon: CalendarClock },
  { name: "Meetings", href: "/meetings", icon: Calendar },
  { name: "WHS", href: "/whs", icon: Shield },
  { name: "Xero", href: "/xero", icon: Layers },
  { name: "Purchase Orders", href: "/purchase-orders", icon: FileText },
  { name: "Quote Requests", href: "/quote-requests", icon: FileQuestion },
  { name: "Contacts", href: urls.contacts(), icon: Users, tableId: TABLE_IDS.CONTACTS },
  { name: "Price Book", href: urls.pricebook(), icon: Package, tableId: TABLE_IDS.PRICEBOOK },
  { name: "Documents", href: "/documents", icon: FolderOpen },
  { name: "Corporate", href: urls.companies(), icon: Building2, tableId: TABLE_IDS.COMPANIES },
  { name: "Portal", href: "/portal", icon: ExternalLink },
  { name: "Admin", href: "/admin", icon: Wrench },
];

const personaIcons: Record<Persona, typeof HardHat> = {
  site: HardHat,
  office: Building2,
  manager: LayoutGrid,
};

export function Sidebar() {
  const { isExpanded, setIsExpanded } = useSidebar();
  const [persona, setPersona] = useState<Persona>('manager');
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();

  // Load persona from localStorage on mount
  useEffect(() => {
    setPersona(getStoredPersona());
  }, []);

  // Load badge counts (pending proposals, etc.)
  useEffect(() => {
    const loadBadgeCounts = async () => {
      try {
        // Load pending email proposals count
        const response = await api.get<{ proposals: Array<{ status: string }> }>(
          "/api/v1/email_job_proposals?status=pending"
        );
        const pendingCount = (response.proposals || []).filter(p => p.status === "pending").length;
        setBadges(prev => ({ ...prev, pendingProposals: pendingCount }));
      } catch (error) {
        // Silently fail - badge just won't show
        console.debug("Failed to load badge counts:", error);
      }
    };

    if (isAuthenticated) {
      loadBadgeCounts();
      // Refresh every 60 seconds
      const interval = setInterval(loadBadgeCounts, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handlePersonaChange = (newPersona: Persona) => {
    setPersona(newPersona);
    setStoredPersona(newPersona);
    setPersonaMenuOpen(false);
  };

  // Filter navigation items based on persona
  const filteredItems = useMemo(() => {
    const config = PERSONA_CONFIG[persona];
    if (config.items === 'all') return navigationItems;
    return navigationItems.filter(item => config.items.includes(item.href));
  }, [persona]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo - only on mobile sheet */}
      {mobile && (
        <div className="h-[70px] flex items-center border-b border-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              t
            </div>
            <span className="font-serif">teeem</span>
          </Link>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 transition-colors relative group",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <div className="relative shrink-0">
                <Icon size={16} />
                {badgeCount > 0 && !isExpanded && !mobile && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-yellow-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-300 overflow-hidden text-sm flex items-center gap-2",
                  isExpanded || mobile ? "opacity-100 w-auto" : "opacity-0 w-0"
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
        })}
      </nav>

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
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
              >
                <Users className="h-4 w-4" />
                Profile
              </Link>
              <Link
                href="/settings"
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
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
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
