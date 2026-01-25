"use client";

// Legacy SharePoint launcher page - redirects to File Warehouse
// This page was previously hardcoded to open a specific SharePoint URL.
// Now that we use universal storage (S3/Wasabi), redirect to warehouse page.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SharePointPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to File Warehouse - the universal file browser
    router.replace("/warehouse");
  }, [router]);

  return null;
}
