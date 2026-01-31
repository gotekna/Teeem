"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, BookOpen, Lightbulb, CheckSquare, ExternalLink } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ContextualHelpModal } from "./ContextualHelpModal";
import { getHelpForPage, getPageHelp, type PageHelp } from "@/lib/helpMapping";
import { cn } from "@/lib/utils";

interface FloatingHelpButtonProps {
  inline?: boolean;
}

export function FloatingHelpButton({ inline = false }: FloatingHelpButtonProps) {
  const pathname = usePathname();
  const [showHelpModal, setShowHelpModal] = React.useState(false);

  // Get contextual help for current page
  const helpInfo = getHelpForPage(pathname);
  const pageHelp = getPageHelp(pathname);

  return (
    <>
      {/* Help Button with Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              inline
                ? "p-1.5 text-muted-foreground hover:text-muted-foreground dark:hover:text-white rounded-md"
                : "fixed bottom-6 right-6 z-40 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-background"
            )}
            aria-label="Get help"
            title="Get help for this page"
          >
            <HelpCircle className={cn(inline ? "h-4 w-4" : "h-6 w-6")} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          {pageHelp ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-semibold text-foreground">{pageHelp.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {pageHelp.description}
                </p>
              </div>

              {/* Quick Tips */}
              {pageHelp.tips.length > 0 && (
                <div className="p-3 border-b border-border">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Quick Tips
                  </div>
                  <ul className="space-y-1">
                    {pageHelp.tips.map((tip, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-amber-500">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Common Tasks */}
              {pageHelp.tasks.length > 0 && (
                <div className="p-3 border-b border-border">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 mb-2">
                    <CheckSquare className="h-3.5 w-3.5" />
                    What you can do here
                  </div>
                  <ul className="space-y-1">
                    {pageHelp.tasks.map((task, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-green-500">•</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer - Full Documentation Link */}
              <div className="p-3 bg-muted/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                  onClick={() => setShowHelpModal(true)}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Open Full Documentation
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
              </div>
            </>
          ) : (
            // Fallback when no page-specific help
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-semibold">Help</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                No specific help available for this page yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowHelpModal(true)}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Open Documentation
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Contextual Help Modal - Full Documentation */}
      <ContextualHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        chapter={helpInfo?.chapter ?? null}
        section={helpInfo?.section}
      />
    </>
  );
}
