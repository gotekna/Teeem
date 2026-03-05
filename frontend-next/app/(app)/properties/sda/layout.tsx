"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Building2,
  FileCheck2,
  Receipt,
  ShieldCheck,
  Settings2,
} from "lucide-react";

const SDA_TABS = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/properties/sda" },
  { value: "properties", label: "Properties", icon: Building2, href: "/properties/sda/properties" },
  { value: "enrolments", label: "Enrolments", icon: FileCheck2, href: "/properties/sda/enrolments" },
  { value: "claims", label: "Claims", icon: Receipt, href: "/properties/sda/claims" },
  { value: "compliance", label: "Compliance", icon: ShieldCheck, href: "/properties/sda/compliance" },
  { value: "setup", label: "Setup", icon: Settings2, href: "/properties/sda/setup" },
];

export default function SdaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab =
    SDA_TABS.find((t) => t.href !== "/properties/sda" && pathname.startsWith(t.href))
      ?.value ?? "dashboard";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">SDA Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Specialist Disability Accommodation portfolio management
        </p>
      </div>

      {/* Tab navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const tab = SDA_TABS.find((t) => t.value === v);
          if (tab) router.push(tab.href);
        }}
      >
        <TabsList>
          {SDA_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Page content */}
      {children}
    </div>
  );
}
