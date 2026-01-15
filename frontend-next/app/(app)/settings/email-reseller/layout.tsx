"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackButton } from "@/components/ui/back-button";
import {
  LayoutDashboard,
  Users,
  ArrowRightLeft,
  TrendingUp,
  Settings,
} from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/settings/email-reseller" },
  { id: "subscriptions", label: "Subscriptions", icon: Users, path: "/settings/email-reseller/subscriptions" },
  { id: "migrations", label: "Migrations", icon: ArrowRightLeft, path: "/settings/email-reseller/migrations" },
  { id: "reports", label: "Reports", icon: TrendingUp, path: "/settings/email-reseller/reports" },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings/email-reseller/settings" },
];

export default function EmailResellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine current tab from pathname
  const getCurrentTab = () => {
    if (pathname.includes("/subscriptions")) return "subscriptions";
    if (pathname.includes("/migrations")) return "migrations";
    if (pathname.includes("/reports")) return "reports";
    if (pathname.includes("/settings")) return "settings";
    return "dashboard";
  };

  const currentTab = getCurrentTab();

  const handleTabChange = (value: string) => {
    const tab = TABS.find((t) => t.id === value);
    if (tab) {
      router.push(tab.path);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/settings/integrations" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">
            PolarisMail Reseller
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage email subscriptions, migrations, and billing
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
