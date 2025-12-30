"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

/**
 * Redirect /admin/system to /admin/system/company (default tab)
 *
 * The actual content is now handled by:
 * - layout.tsx - shared navigation
 * - [...slug]/page.tsx - path-based tab routing
 */
export default function SystemAdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/system/company");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={32} className="text-muted-foreground" />
    </div>
  );
}
