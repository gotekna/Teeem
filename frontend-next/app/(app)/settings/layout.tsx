"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettingsAccess } from "@/lib/hooks/useSettingsAccess";
import { useLayoutMode } from "@/contexts/LayoutModeContext";
import {
  User,
  Bell,
  Shield,
  Sliders,
  Users,
  ShieldCheck,
  Building,
  Building2,
  FileText,
  Server,
  Code,
  Wrench,
} from "lucide-react";

// Personal tabs - visible to all authenticated users
const PERSONAL_TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "preferences", label: "Preferences", icon: Sliders },
];

// Organization tabs - visible to admin users only
// SSoT: Integrations is now under Company > Connections > Integrations
// SSoT: Documents moved under Company
// SSoT: Entity Config moved under Company
const ORGANIZATION_TABS = [
  { id: "users", label: "Users", icon: Users },
  { id: "roles", label: "Access Control", icon: ShieldCheck },
  { id: "corporate", label: "Corporate", icon: Building2 },
  { id: "company", label: "Company", icon: Building },
  { id: "operations", label: "Operations", icon: Wrench },
  { id: "system", label: "System", icon: Server },
  { id: "developer", label: "Developer", icon: Code },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = useSettingsAccess();
  const { mode } = useLayoutMode();

  // Extract current tab from path
  // /settings/profile → "profile"
  // /settings/integrations/xero → "integrations"
  // /settings/company/info → "company"
  const pathParts = pathname.replace("/settings", "").split("/").filter(Boolean);
  const currentTab = pathParts[0] || "profile";

  // Determine which section the current tab belongs to
  const isPersonalTab = PERSONAL_TABS.some((t) => t.id === currentTab);
  const isOrgTab = ORGANIZATION_TABS.some((t) => t.id === currentTab);

  const handleTabChange = (value: string) => {
    router.push(`/settings/${value}`);
  };

  // All tabs for value matching
  const allTabs = [...PERSONAL_TABS, ...(isAdmin ? ORGANIZATION_TABS : [])];

  // SSoT: Respect layout mode from child pages (e.g., TablePage, ScheduleMasterTab)
  // When mode is "full-height" or "fullscreen", use flex layout with proper heights
  const isFullHeight = mode === "full-height" || mode === "fullscreen" || mode === "edge-to-edge";

  return (
    <div className={isFullHeight ? "flex flex-col h-full" : "space-y-6"}>
      {/* Header */}
      <div className={isFullHeight ? "shrink-0" : ""}>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account and organization settings
        </p>
      </div>

      {/* Tab Navigation with Sections */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className={isFullHeight ? "shrink-0" : ""}>
        <div className="space-y-4">
          {/* Personal Section */}
          <div>
            <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2 tracking-wider">
              Personal
            </h3>
            <TabsList>
              {PERSONAL_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Organization Section - Admin Only */}
          {isAdmin && (
            <div>
              <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2 tracking-wider">
                Organization
              </h3>
              <TabsList className="flex-wrap h-auto gap-1">
                {ORGANIZATION_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
          )}
        </div>
      </Tabs>

      {/* Content - flex-1 when full-height to fill remaining space */}
      <div className={isFullHeight ? "flex-1 min-h-0" : ""}>{children}</div>
    </div>
  );
}
