"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabbedSettingsPage, ScrollablePage } from "@/components/ui/page-wrappers";
import { useSettingsAccess } from "@/lib/hooks/useSettingsAccess";
import {
  User,
  Bell,
  Shield,
  Sliders,
  Users,
  ShieldCheck,
  Building,
  Building2,
  Server,
  Code,
  Wrench,
  Cable,
} from "lucide-react";

// Personal tabs - visible to all authenticated users
const PERSONAL_TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "preferences", label: "Preferences", icon: Sliders },
];

// Organization tabs - visible to admin users only
// SSoT: Documents moved under Company
// SSoT: Entity Config moved under Company
// SSoT: Connections is top-level (Jan 2026) - contains Storage Provider, Integrations, Migration, Cost Comparison
const ORGANIZATION_TABS = [
  { id: "users", label: "Users", icon: Users },
  { id: "roles", label: "Access Control", icon: ShieldCheck },
  { id: "corporate", label: "Corporate", icon: Building2 },
  { id: "company", label: "Company", icon: Building },
  { id: "operations", label: "Operations", icon: Wrench },
  { id: "connections", label: "Connections", icon: Cable },
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

  // Extract current tab from path
  // /settings/profile → "profile"
  // /settings/connections/provider → "connections"
  // /settings/company/info → "company"
  // Note: pathname can be null during SSR/hydration
  const pathParts = (pathname ?? "").replace("/settings", "").split("/").filter(Boolean);
  const currentTab = pathParts[0] || "profile";

  // Hide navigation on detail pages (e.g., /settings/integrations/xero)
  // Detail pages are 2+ levels deep under sections without sub-tabs
  // Company and Connections sub-tabs still show navigation (e.g., /settings/company/info, /settings/connections/provider)
  const sectionsWithSubTabs = ["company", "connections", "operations"];
  const isDetailPage = pathParts.length >= 2 && !sectionsWithSubTabs.includes(pathParts[0]);

  // Full-page routes that skip ALL settings chrome (including ScrollablePage wrapper)
  // These pages handle their own layout completely
  const fullPageRoutes = ["operations/po-templates"];
  const pathKey = pathParts.slice(0, 2).join("/");
  const isFullPage = fullPageRoutes.includes(pathKey);

  const handleTabChange = (value: string) => {
    router.push(`/settings/${value}`);
  };

  // Full-page routes render children directly (page handles its own layout)
  if (isFullPage) {
    return <>{children}</>;
  }

  // Detail pages show only their own content without settings navigation
  if (isDetailPage) {
    return <ScrollablePage>{children}</ScrollablePage>;
  }

  return (
    <TabbedSettingsPage
      title="Settings"
      description="Manage your account and organization settings"
    >
      {/* Personal Section */}
      <TabbedSettingsPage.TabSection label="Personal">
        <Tabs value={currentTab} onValueChange={handleTabChange}>
          <TabsList data-tour="settings-nav">
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
        </Tabs>
      </TabbedSettingsPage.TabSection>

      {/* Organization Section - Admin Only */}
      {isAdmin && (
        <TabbedSettingsPage.TabSection label="Organization">
          <Tabs value={currentTab} onValueChange={handleTabChange}>
            <TabsList className="flex-wrap h-auto gap-1">
              {ORGANIZATION_TABS.map((tab) => {
                const Icon = tab.icon;
                // Add data-tour for specific tabs
                const tourId = tab.id === "users" ? "settings-users"
                  : tab.id === "company" ? "settings-company"
                  : tab.id === "connections" ? "settings-integrations"
                  : undefined;
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="gap-2" data-tour={tourId}>
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </TabbedSettingsPage.TabSection>
      )}

      {/* Content */}
      <TabbedSettingsPage.Content>
        {children}
      </TabbedSettingsPage.Content>
    </TabbedSettingsPage>
  );
}
