"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { resolveDisplayName } from "@/lib/breadcrumb-utils";
import { TITLE_UPDATE } from "@/lib/constants/timeout-constants";

export function DynamicTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const hostname = window.location.hostname;
    let envPrefix = "";

    if (hostname.includes("localhost")) {
      envPrefix = "Teeem Local";
    } else if (hostname.includes("teeem-sam-dev") || hostname.includes("teeemsam")) {
      envPrefix = "Teeem Sam";
    } else if (hostname.includes("teeemlive")) {
      envPrefix = "Teeem Live";
    } else if (hostname.includes("teeem-rob-dev")) {
      envPrefix = "Teeem Rob";
    } else {
      envPrefix = "Teeem";
    }

    // Use breadcrumb display name resolver (SSoT for route names)
    const displayName = resolveDisplayName(pathname);
    const pageTitle = displayName && displayName !== "Home"
      ? `${displayName} | ${envPrefix}`
      : envPrefix;

    // Function to set the title
    const setTitle = () => {
      if (document.title !== pageTitle) {
        document.title = pageTitle;
      }
    };

    // Set title immediately
    setTitle();

    // Set title again after short delays
    const timeoutId = setTimeout(setTitle, TITLE_UPDATE.FAST);
    const timeoutId2 = setTimeout(setTitle, TITLE_UPDATE.MEDIUM);
    const timeoutId3 = setTimeout(setTitle, TITLE_UPDATE.SLOW);
    const timeoutId4 = setTimeout(setTitle, TITLE_UPDATE.SLOWEST);

    // Poll to enforce the title (aggressive but reliable)
    const intervalId = setInterval(setTitle, TITLE_UPDATE.INTERVAL);

    // Also use MutationObserver for immediate catches
    const observer = new MutationObserver(setTitle);

    const titleElement = document.querySelector('title');
    if (titleElement) {
      observer.observe(titleElement, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      clearTimeout(timeoutId4);
      clearInterval(intervalId);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
