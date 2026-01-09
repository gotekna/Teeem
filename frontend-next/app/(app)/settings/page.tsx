"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

/**
 * Redirect /settings to /settings/profile (default tab)
 *
 * The actual content is now handled by:
 * - layout.tsx - shared tab navigation
 * - profile/page.tsx, notifications/page.tsx, etc. - tab content
 */
export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/profile");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={32} className="text-muted-foreground" />
    </div>
  );
}
