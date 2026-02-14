"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants/route-paths";

/**
 * SSoT (Jan 2026): Integrations moved under top-level Connections
 *
 * This page redirects to /settings/connections/integrations
 * Detail pages like /settings/integrations/xero still exist for deep linking
 */
export default function IntegrationsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(ROUTES.SETTINGS.CONNECTIONS_INTEGRATIONS);
  }, [router]);

  return (
    <div className="flex items-center justify-center p-8 text-muted-foreground">
      Redirecting to Connections...
    </div>
  );
}
