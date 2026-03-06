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
  DoorOpen,
  FileSignature,
  AlertTriangle,
  Heart,
  Landmark,
  HandHelping,
} from "lucide-react";

const SDA_TABS = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/properties/sda" },
  { value: "properties", label: "Properties", icon: Building2, href: "/properties/sda/properties" },
  { value: "enrolments", label: "Enrolments", icon: FileCheck2, href: "/properties/sda/enrolments" },
  { value: "claims", label: "Claims", icon: Receipt, href: "/properties/sda/claims" },
  { value: "compliance", label: "Compliance", icon: ShieldCheck, href: "/properties/sda/compliance" },
  { value: "vacancies", label: "Vacancies", icon: DoorOpen, href: "/properties/sda/vacancies" },
  { value: "agreements", label: "Agreements", icon: FileSignature, href: "/properties/sda/agreements" },
  { value: "incidents", label: "Incidents", icon: AlertTriangle, href: "/properties/sda/incidents" },
  { value: "participants", label: "Participants", icon: Heart, href: "/properties/sda/participants" },
  { value: "finance", label: "Finance", icon: Landmark, href: "/properties/sda/finance" },
  { value: "sil", label: "SIL", icon: HandHelping, href: "/properties/sda/sil" },
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

      {/* Tab navigation — scrollable for 12 tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const tab = SDA_TABS.find((t) => t.value === v);
          if (tab) router.push(tab.href);
        }}
      >
        <div className="overflow-x-auto">
          <TabsList className="w-max">
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
        </div>
      </Tabs>

      {/* Page content */}
      {children}
    </div>
  );
}
