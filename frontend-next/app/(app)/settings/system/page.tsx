"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { HeartPulse, Activity, Wrench, ChevronRight } from "lucide-react";

export default function SystemSettingsPage() {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <Card
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => router.push("/system-health")}
      >
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg dark:bg-green-900/30">
                <HeartPulse className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-medium">System Health</h3>
                <p className="text-sm text-muted-foreground">
                  Data quality checks and system diagnostics
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => router.push("/corporate")}
      >
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg dark:bg-purple-900/30">
                <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium">Corporate Health</h3>
                <p className="text-sm text-muted-foreground">
                  Company compliance and document verification
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => router.push("/admin")}
      >
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg dark:bg-orange-900/30">
                <Wrench className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="font-medium">Admin Tools</h3>
                <p className="text-sm text-muted-foreground">
                  User management and system configuration
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
