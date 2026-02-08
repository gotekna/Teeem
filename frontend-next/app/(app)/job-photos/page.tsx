"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Job Photos - Redirects to /jobs/photos
 *
 * The actual Job Photos page lives at /jobs/photos.
 */
export default function JobPhotosRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/jobs/photos");
  }, [router]);

  return null;
}
