"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Calendar,
  CalendarDays,
  ShieldCheck,
  Banknote,
  DollarSign,
  ClipboardCheck,
  Star,
  Wrench,
  BookOpen,
  Sparkles,
  FileText,
  Tag,
  Palette,
  Mail,
  Clock,
  Menu,
  Brain,
  Activity,
  Settings2,
  Receipt,
  Box,
} from "lucide-react";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

const MAIN_TABS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "brand-guidelines", label: "Brand Guidelines", icon: Palette },
  { id: "contact-types", label: "Contacts", icon: Tag },
  { id: "components", label: "Components", icon: Star },
  { id: "developer-tools", label: "Developer Tools", icon: Wrench },
  { id: "navigation", label: "Navigation", icon: Menu },
  { id: "entity-config", label: "Entity Configuration", icon: Settings2 },
  { id: "schedule-master", label: "Schedule Master", icon: CalendarDays },
  { id: "meeting-types", label: "Meeting Types", icon: Calendar },
  { id: "whs", label: "WHS", icon: ShieldCheck },
  { id: "financial", label: "Financial", icon: Banknote },
  { id: "cost", label: "Cost", icon: Receipt },
  { id: "pricebook", label: "Price Book", icon: DollarSign },
  { id: "supervisor-checklist", label: "Supervisor Checklist", icon: ClipboardCheck },
  { id: "user-manual", label: "User Manual", icon: BookOpen },
  { id: "inspiring-quotes", label: "Inspiring Quotes", icon: Sparkles },
  { id: "scheduled-jobs", label: "Scheduled Jobs", icon: Clock },
  { id: "email-accounts", label: "Email Accounts", icon: Mail },
  { id: "pdf-fields", label: "PDF Fields", icon: FileText },
  { id: "ai-processing", label: "AI Processing", icon: Brain },
  { id: "xero-health", label: "Xero Health", icon: Activity },
  { id: "unreal-engine", label: "Unreal Engine", icon: Box },
];

// Tabs that hide the header for more space
const COMPACT_TABS = ["schedule-master"];

// Full-page tabs that hide all navigation
const FULL_PAGE_TABS = ["pdf-fields"];

export default function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useSetLayoutMode("full-height");

  const pathname = usePathname();
  const router = useRouter();

  // Extract the current tab from the path
  // /admin/system/company/info → "company"
  // /admin/system/schedule-master/data-view/live → "schedule-master"
  const pathParts = pathname.replace("/admin/system", "").split("/").filter(Boolean);
  const currentTab = pathParts[0] || "company";

  const isCompactTab = COMPACT_TABS.includes(currentTab);
  const isFullPage = FULL_PAGE_TABS.includes(currentTab);

  const handleTabChange = (value: string) => {
    router.push(`/admin/system/${value}`);
  };

  // Full-page mode for certain tabs (like PDF Fields)
  if (isFullPage) {
    return (
      <div className="flex flex-col h-full -m-4 -mb-16">
        {/* Minimal header with back button */}
        <div className="shrink-0 px-2 py-0.5 border-b bg-background flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/system/company")}
            className="h-5 text-[10px] px-1"
          >
            ← Back
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {MAIN_TABS.find((t) => t.id === currentTab)?.label || currentTab}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - hidden for compact tabs like Schedule Master */}
      {!isCompactTab && (
        <div className="shrink-0 mb-4">
          <h1 className="text-2xl font-bold tracking-tight font-serif">
            System Administration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure system settings, integrations, and developer tools
          </p>
        </div>
      )}

      {/* Main Tab Navigation - hidden for compact tabs */}
      {!isCompactTab && (
        <Tabs value={currentTab} onValueChange={handleTabChange} className="shrink-0 mb-4">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1 justify-start">
            {MAIN_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  ref={(el) => {
                    // Auto-scroll active tab into view on mount
                    if (isActive && el) {
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "center",
                      });
                    }
                  }}
                  className="text-xs sm:text-sm whitespace-nowrap flex items-center gap-1.5 data-[state=active]:bg-background"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

      {/* Content */}
      <div className={`${isCompactTab ? "mt-0" : ""} flex-1 min-h-0 overflow-auto`}>
        {children}
      </div>
    </div>
  );
}
