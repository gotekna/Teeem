"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

/**
 * SSoT Redirect: Document path settings have been consolidated
 *
 * The SSoT for SharePoint/document path configuration is:
 * /admin/system/entity-config/sharepoint_config
 *
 * This page previously edited legacy columns (*_documents_base_path)
 * which have been deprecated in favor of sharepoint_* columns.
 */
export default function DocumentSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // SSoT: Redirect to the single source of truth for SharePoint config
    router.replace("/admin/system/entity-config/sharepoint_config");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <Spinner size={32} className="text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Redirecting to SharePoint Configuration...
      </p>
    </div>
  );
}
