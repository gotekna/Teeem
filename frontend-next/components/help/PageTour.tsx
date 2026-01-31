"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { CallBackProps, STATUS, EVENTS } from "react-joyride";
import {
  getTourForRoute,
  isTourCompleted,
  markTourCompleted,
  resetTour,
  type PageTour,
} from "@/lib/tours/tour-definitions";

// Dynamic import to avoid SSR issues with react-joyride
const Joyride = dynamic(() => import("react-joyride"), { ssr: false });

interface PageTourProps {
  // Force show tour even if completed
  forceShow?: boolean;
  // Callback when tour ends
  onTourEnd?: () => void;
}

// Custom styles for the tour
const tourStyles = {
  options: {
    arrowColor: "#fff",
    backgroundColor: "#fff",
    overlayColor: "rgba(0, 0, 0, 0.5)",
    primaryColor: "#6366f1", // Indigo-500
    spotlightShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
    textColor: "#1f2937",
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: 8,
    padding: 16,
  },
  tooltipContainer: {
    textAlign: "left" as const,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 8,
  },
  tooltipContent: {
    fontSize: 14,
    lineHeight: 1.5,
  },
  buttonNext: {
    backgroundColor: "#6366f1",
    borderRadius: 6,
    color: "#fff",
    fontSize: 14,
    padding: "8px 16px",
  },
  buttonBack: {
    color: "#6366f1",
    fontSize: 14,
    marginRight: 8,
  },
  buttonSkip: {
    color: "#6b7280",
    fontSize: 13,
  },
  buttonClose: {
    display: "none",
  },
  spotlight: {
    borderRadius: 8,
  },
};

export function PageTour({ forceShow = false, onTourEnd }: PageTourProps) {
  const pathname = usePathname();
  const [run, setRun] = React.useState(false);
  const [tour, setTour] = React.useState<PageTour | null>(null);
  const [stepIndex, setStepIndex] = React.useState(0);

  // Get tour for current route
  React.useEffect(() => {
    const currentTour = getTourForRoute(pathname);
    setTour(currentTour);
    setStepIndex(0);
    setRun(false); // Don't auto-start - only run when user clicks "Take a Tour"
  }, [pathname]);

  // Handle tour callbacks
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index, action } = data;
    const finishedStatuses: string[] = ["finished", "skipped"];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      if (tour) {
        markTourCompleted(tour.id);
      }
      onTourEnd?.();
    }

    // Handle target not found - skip to next step
    if (type === "error:target_not_found" && tour) {
      const nextIndex = index + 1;
      if (nextIndex < tour.steps.length) {
        setStepIndex(nextIndex);
      } else {
        // No more steps, end tour
        setRun(false);
        markTourCompleted(tour.id);
        onTourEnd?.();
      }
      return;
    }

    // Update step index for controlled tour
    if (type === "step:after") {
      setStepIndex(index + 1);
    }
  };

  // Start tour manually (called from help button)
  const startTour = React.useCallback(() => {
    if (tour) {
      resetTour(tour.id);
      setStepIndex(0);
      setRun(true);
    }
  }, [tour]);

  // Expose startTour via ref for external control
  React.useEffect(() => {
    // Store startTour function globally for access from help button
    (window as unknown as { __startPageTour?: () => void }).__startPageTour = startTour;
    return () => {
      delete (window as unknown as { __startPageTour?: () => void }).__startPageTour;
    };
  }, [startTour]);

  if (!tour) return null;

  return (
    <Joyride
      steps={tour.steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      hideCloseButton
      disableOverlayClose
      disableScrolling={false}
      scrollToFirstStep
      spotlightClicks
      callback={handleJoyrideCallback}
      styles={tourStyles}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip Tour",
      }}
      floaterProps={{
        disableAnimation: true,
      }}
    />
  );
}

// Hook to start tour programmatically
export function usePageTour() {
  const startTour = React.useCallback(() => {
    const fn = (window as unknown as { __startPageTour?: () => void }).__startPageTour;
    if (fn) {
      fn();
    }
  }, []);

  return { startTour };
}
