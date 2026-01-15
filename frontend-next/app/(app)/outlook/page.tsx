"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

export default function OutlookPage() {
  const router = useRouter();

  useEffect(() => {
    // Get screen dimensions
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;

    // Set window size (80% of screen)
    const windowWidth = Math.floor(screenWidth * 0.8);
    const windowHeight = Math.floor(screenHeight * 0.8);

    // Center the window
    const left = Math.floor((screenWidth - windowWidth) / 2);
    const top = Math.floor((screenHeight - windowHeight) / 2);

    // Window features for a more app-like experience
    const windowFeatures = `
      width=${windowWidth},
      height=${windowHeight},
      left=${left},
      top=${top},
      menubar=no,
      toolbar=no,
      location=no,
      status=yes,
      scrollbars=yes,
      resizable=yes
    `.replace(/\s+/g, "");

    // Open Outlook in a popup window
    const outlookWindow = window.open(
      "https://outlook.office365.com/mail/",
      "OutlookWebApp",
      windowFeatures
    );

    // Focus the new window if it opened successfully
    if (outlookWindow) {
      outlookWindow.focus();
    }

    // SSoT: Use fallback navigation - router.back() fails when user arrives from external link
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="text-center">
        <Spinner size={32} className="mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Opening Outlook...</p>
      </div>
    </div>
  );
}
