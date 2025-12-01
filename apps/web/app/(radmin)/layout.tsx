"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Table2,
  Database,
  Paintbrush,
  BookOpen,
  Settings2,
  GitBranch,
  Users,
  Shield,
  Upload,
  Bot,
  ChevronLeft,
  Terminal,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const adminNavItems = [
  {
    title: "Dashboard",
    href: "/radmin",
    icon: LayoutDashboard,
    description: "Admin overview",
  },
  {
    title: "Tables",
    href: "/radmin/tables",
    icon: Table2,
    description: "Gold Standard table viewer",
  },
  {
    title: "Schema",
    href: "/radmin/schema",
    icon: Database,
    description: "Table & column editor",
  },
  {
    title: "Designer",
    href: "/radmin/designer",
    icon: Paintbrush,
    description: "Page & menu builder",
  },
  {
    title: "Trinity",
    href: "/radmin/trinity",
    icon: BookOpen,
    description: "Documentation system",
  },
  {
    title: "System",
    href: "/radmin/system",
    icon: Settings2,
    description: "Admin, health, performance",
  },
  {
    title: "Workflows",
    href: "/radmin/workflows",
    icon: GitBranch,
    description: "Workflow automation",
  },
  {
    title: "Users",
    href: "/radmin/users",
    icon: Users,
    description: "User management",
  },
  {
    title: "Permissions",
    href: "/radmin/permissions",
    icon: Shield,
    description: "Roles & access control",
  },
  {
    title: "Imports",
    href: "/radmin/imports",
    icon: Upload,
    description: "Bulk data imports",
  },
  {
    title: "Agents",
    href: "/radmin/agents",
    icon: Bot,
    description: "AI agent monitoring",
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="flex h-14 items-center px-4 gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to App
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-orange-500 text-white flex items-center justify-center">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Admin Tools</h1>
              <p className="text-xs text-muted-foreground">Internal use only</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-64 border-r bg-card overflow-y-auto">
          <nav className="p-4 space-y-1">
            {adminNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className={cn(
                      "text-xs",
                      isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
