"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  BarChart3,
  FolderOpen,
  Wrench,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./button";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Meetings", href: "/meetings", icon: Calendar },
  { name: "WHS", href: "/whs", icon: Shield },
  { name: "Estimates", href: "/estimates", icon: DollarSign },
  { name: "Purchase Orders", href: "/purchase-orders", icon: FileText },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Documents", href: "/documents", icon: FolderOpen },
  { name: "Training", href: "/training", icon: GraduationCap },
];

const bottomNavigationItems = [
  { name: "Schedule Demo", href: "/gantt", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Admin", href: "/admin", icon: Wrench },
];

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();

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
        {navigationItems.map((item) => {
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

        {/* Separator */}
        <div className="my-2 border-t border-border" />

        {/* Bottom Navigation Items */}
        {bottomNavigationItems.map((item) => {
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

      {/* Theme Toggle */}
      <div className="p-2 border-t border-border">
        <div
          className={cn(
            "flex items-center gap-3 p-2 hover:bg-secondary/50 transition-colors cursor-pointer",
            !isExpanded && !mobile && "justify-center"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", isExpanded || mobile ? "" : "mx-auto")}
            onClick={(e) => {
              e.stopPropagation();
              setTheme(theme === "dark" ? "light" : "dark");
            }}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          {(isExpanded || mobile) && (
            <span className="text-sm text-muted-foreground whitespace-nowrap overflow-hidden">
              Toggle Theme
            </span>
          )}
        </div>
      </div>

      {/* User Profile */}
      <div className="p-2 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-3 p-2 hover:bg-secondary/50 transition-colors cursor-pointer",
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
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium truncate">{user?.name || "User"}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {user?.email || ""}
                  </span>
                </div>
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
