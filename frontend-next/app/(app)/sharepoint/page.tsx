"use client";

// RENAMED: OneDrivePage → SharePointPage
// Backwards compatibility alias at app/(app)/onedrive/page.tsx

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

export default function SharePointPage() {
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

    // Open SharePoint in a popup window
    const sharePointWindow = window.open(
      "https://gotekna-my.sharepoint.com/my?login_hint=robert%40tekna%2Ecom%2Eau&source=waffle",
      "SharePointApp",
      windowFeatures
    );

    // Focus the new window if it opened successfully
    if (sharePointWindow) {
      sharePointWindow.focus();
    }

    // Navigate back to the previous page
    router.back();
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="text-center">
        <Spinner size={32} className="mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Opening SharePoint...</p>
      </div>
    </div>
  );
}
