"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabbedSettingsPage } from "@/components/ui/page-wrappers";
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

  // Extract current tab from path
  // /settings/profile → "profile"
  // /settings/integrations/xero → "integrations"
  // /settings/company/info → "company"
  const pathParts = pathname.replace("/settings", "").split("/").filter(Boolean);
  const currentTab = pathParts[0] || "profile";

  const handleTabChange = (value: string) => {
    router.push(`/settings/${value}`);
  };

  return (
    <TabbedSettingsPage
      title="Settings"
      description="Manage your account and organization settings"
    >
      {/* Personal Section */}
      <TabbedSettingsPage.TabSection label="Personal">
        <Tabs value={currentTab} onValueChange={handleTabChange}>
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
        </Tabs>
      </TabbedSettingsPage.TabSection>

      {/* Organization Section - Admin Only */}
      {isAdmin && (
        <TabbedSettingsPage.TabSection label="Organization">
          <Tabs value={currentTab} onValueChange={handleTabChange}>
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
