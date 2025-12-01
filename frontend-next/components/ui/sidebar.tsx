"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
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
  Network,
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

const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Leads", href: "/leads", icon: Target },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Schedule", href: "/schedule-master", icon: CalendarClock },
  { name: "Meetings", href: "/meetings", icon: Calendar },
  { name: "WHS", href: "/whs", icon: Shield },
  { name: "Xero", href: "/xero", icon: Layers },
  { name: "Purchase Orders", href: "/purchase-orders", icon: FileText },
  { name: "Quote Requests", href: "/quote-requests", icon: FileQuestion },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Price Book", href: "/pricebook", icon: Package },
  { name: "Documents", href: "/documents", icon: FolderOpen },
  { name: "Corporate", href: "/corporate", icon: Building2 },
  { name: "Portal", href: "/portal", icon: ExternalLink },
];

const personaIcons: Record<Persona, typeof HardHat> = {
  site: HardHat,
  office: Building2,
  manager: LayoutGrid,
};

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [persona, setPersona] = useState<Persona>('manager');
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();

  // Load persona from localStorage on mount
  useEffect(() => {
    setPersona(getStoredPersona());
  }, []);

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
      {/* Logo */}
      <div
        className={cn(
          "h-[70px] flex items-center justify-center border-b border-border transition-all duration-300",
          isExpanded || mobile ? "px-6 justify-start" : "px-0"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center">
            t
          </div>
          {(isExpanded || mobile) && <span className="font-serif">teeem</span>}
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

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
              <Icon size={20} className="shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-300 overflow-hidden text-sm",
                  isExpanded || mobile ? "opacity-100 w-auto" : "opacity-0 w-0"
                )}
              >
                {item.name}
              </span>
              {!isExpanded && !mobile && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border shadow-sm whitespace-nowrap">
                  {item.name}
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

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-screen flex-shrink-0 flex-col justify-between fixed top-0 left-0 z-50 transition-all duration-300 ease-in-out bg-background border-r border-border",
          isExpanded ? "w-[240px]" : "w-[70px]"
        )}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
