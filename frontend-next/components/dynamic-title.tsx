"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function DynamicTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const hostname = window.location.hostname;
    let envPrefix = "";

    if (hostname.includes("localhost")) {
      envPrefix = "Teeem Local";
    } else if (hostname.includes("teeem-sam-dev")) {
      envPrefix = "Teeem Sam";
    } else if (hostname.includes("teeemlive")) {
      envPrefix = "Teeem Live";
    } else if (hostname.includes("teeem-rob-dev")) {
      envPrefix = "Teeem Rob";
    } else {
      envPrefix = "Teeem";
    }

    // Get page name from pathname
    const pageName = pathname
      .split("/")
      .filter(Boolean)
      .pop();

    const pageTitle = pageName
      ? `${pageName.charAt(0).toUpperCase() + pageName.slice(1)} | ${envPrefix}`
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
    const timeoutId = setTimeout(setTitle, 100);
    const timeoutId2 = setTimeout(setTitle, 500);
    const timeoutId3 = setTimeout(setTitle, 1000);
    const timeoutId4 = setTimeout(setTitle, 2000);

    // Poll every 500ms to enforce the title (aggressive but reliable)
    const intervalId = setInterval(setTitle, 500);

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
