"use client";

// Legacy SharePoint launcher page - redirects to documents
// This page was previously hardcoded to open a specific SharePoint URL.
// Now that we use universal storage (S3/Wasabi), redirect to documents page.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SharePointPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to documents page - the universal file browser
    router.replace("/documents");
  }, [router]);

  return null;
}
