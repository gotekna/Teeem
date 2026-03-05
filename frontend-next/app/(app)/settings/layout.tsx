"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollablePage } from "@/components/ui/page-wrappers";
import { useSettingsAccess } from "@/lib/hooks/useSettingsAccess";
import { ExpandableSection, ExpandButton, useExpandedState } from "@/components/ui/expandable-section";
import { useLayoutMode } from "@/contexts/LayoutModeContext";
import { cn } from "@/lib/utils";
import {
  User,
  Bell,
  Shield,
  Sliders,
  Bot,
  Users,
  ShieldCheck,
  Building,
  Building2,
  Server,
  Code,
  Wrench,
  Cable,
  Rocket,
  Table2,
} from "lucide-react";

// Personal tabs - visible to all authenticated users
const PERSONAL_TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "assistant", label: "Assistant", icon: Bot },
];

// Organization tabs - visible to admin users only
const ORGANIZATION_TABS = [
  { id: "users", label: "Users", icon: Users },
  { id: "roles", label: "Access Control", icon: ShieldCheck },
  { id: "corporate", label: "Corporate", icon: Building2 },
  { id: "company", label: "Company", icon: Building },
  { id: "operations", label: "Operations", icon: Wrench },
  { id: "tables", label: "Tables", icon: Table2 },
  { id: "connections", label: "Connections", icon: Cable },
  { id: "system", label: "System", icon: Server },
  { id: "developer", label: "Developer", icon: Code },
  { id: "onboarding", label: "Onboarding", icon: Rocket },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, canAccessOrgSettings } = useSettingsAccess();
  const [personalExpanded, togglePersonal] = useExpandedState("settings-personal");
  const [orgExpanded, toggleOrg] = useExpandedState("settings-org");
  const { mode } = useLayoutMode();

  const isFullHeight =
    mode === "full-height" || mode === "fullscreen" || mode === "edge-to-edge";

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
  // View paths (/settings/users/view/setup-2) are NOT detail pages - they're saved table views
  const sectionsWithSubTabs = ["company", "connections", "operations", "tables", "roles", "corporate", "developer", "system"];
  const isViewPath = pathParts[1] === "view";
  const hasEntityId = pathParts.length >= 3 && pathParts.some(part => /^\d+$/.test(part));
  const isDetailPage = (pathParts.length >= 2 && !sectionsWithSubTabs.includes(pathParts[0]) && !isViewPath) || hasEntityId;

  const handleTabChange = (value: string) => {
    router.push(`/settings/${value}`);
  };

  // Detail pages show only their own content without settings navigation
  if (isDetailPage) {
    return <ScrollablePage>{children}</ScrollablePage>;
  }

  const contentArea = (
    <div className={cn(isFullHeight ? "flex-1 min-h-0 overflow-auto" : "", "mt-6")}>
      {children}
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-6", isFullHeight && "h-full")}>
      {/* Header - always visible, never inside an ExpandableSection */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight font-serif">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account and organization settings
        </p>
      </div>

      {/* Personal ExpandableSection wraps personal tabs + org section + content */}
      <ExpandableSection expanded={personalExpanded} onToggle={togglePersonal} className="p-4 pt-2 gap-4">
        {/* Personal tabs */}
        <div className="shrink-0">
          <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2 tracking-wider">
            Personal
          </h3>
          <Tabs value={currentTab} onValueChange={handleTabChange}>
            <div className="flex items-start gap-2">
              <TabsList data-tour="settings-nav" className="flex-1 min-w-0">
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
              {!personalExpanded && (
                <ExpandButton expanded={false} onToggle={togglePersonal} />
              )}
            </div>
          </Tabs>
        </div>

        {/* Organization section (admin only) + Content */}
        {canAccessOrgSettings ? (
          <ExpandableSection expanded={orgExpanded} onToggle={toggleOrg} className="p-4 pt-2 gap-4">
            <div className="shrink-0">
              <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2 tracking-wider">
                Organization
              </h3>
              <Tabs value={currentTab} onValueChange={handleTabChange}>
                <div className="flex items-start gap-2">
                  <TabsList className="flex-wrap h-auto gap-1 flex-1 min-w-0">
                    {ORGANIZATION_TABS.map((tab) => {
                      const Icon = tab.icon;
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
                  {!orgExpanded && (
                    <ExpandButton expanded={false} onToggle={toggleOrg} />
                  )}
                </div>
              </Tabs>
            </div>
            {contentArea}
          </ExpandableSection>
        ) : (
          contentArea
        )}
      </ExpandableSection>
    </div>
  );
}
