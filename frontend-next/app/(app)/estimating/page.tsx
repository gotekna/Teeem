"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Estimating - Redirects to /estimates
 *
 * The correct route is /estimates (Foundation slug: "estimates").
 */
export default function EstimatingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/estimates");
  }, [router]);

  return null;
}
