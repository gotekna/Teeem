"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { ContextualHelpModal } from "./ContextualHelpModal";
import { getHelpForPage } from "@/lib/helpMapping";
import { cn } from "@/lib/utils";

interface FloatingHelpButtonProps {
  inline?: boolean;
}

export function FloatingHelpButton({ inline = false }: FloatingHelpButtonProps) {
  const pathname = usePathname();
  const [showHelpModal, setShowHelpModal] = React.useState(false);

  // Get contextual help for current page
  const helpInfo = getHelpForPage(pathname);

  return (
    <>
      {/* Help Button - inline or floating */}
      <button
        onClick={() => setShowHelpModal(true)}
        className={cn(
          inline
            ? "p-1.5 text-muted-foreground hover:text-muted-foreground dark:hover:text-white rounded-md"
            : "fixed bottom-6 right-6 z-40 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        )}
        aria-label="Get help"
        title="Get help for this page"
      >
        <HelpCircle className={cn(inline ? "h-4 w-4" : "h-6 w-6")} />
      </button>

      {/* Contextual Help Modal */}
      <ContextualHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        chapter={helpInfo?.chapter ?? null}
        section={helpInfo?.section}
      />
    </>
  );
}
