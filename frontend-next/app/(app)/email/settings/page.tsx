"use client";

import * as React from "react";
import { useCallback, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlacklistManager } from "@/components/emails/BlacklistManager";
import { Ban, Settings, Shield } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

export default function EmailSettingsPage() {
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  const activeTab = useMemo(() => {
    const parts = (pathname ?? "").replace("/email/settings", "").split("/").filter(Boolean);
    return parts[0] || "blacklist";
  }, [pathname]);

  // Redirect to default tab if no tab in URL
  useEffect(() => {
    if (!pathname.includes("/email/settings/")) {
      router.replace("/email/settings/blacklist", { scroll: false });
    }
  }, [pathname, router]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/email/settings/${tabId}`, { scroll: false });
  }, [router]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/email" />
        <div className="border-l h-6" />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Email Settings
          </h1>
          <p className="text-muted-foreground">
            Configure email filtering and rules
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="blacklist" className="gap-2">
            <Ban className="h-4 w-4" />
            Blacklist
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2" disabled>
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blacklist" className="mt-6">
          <BlacklistManager />
        </TabsContent>

        <TabsContent value="security">
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Security settings coming soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
