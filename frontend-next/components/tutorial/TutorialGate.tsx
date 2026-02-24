"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { TutorialWelcomeDialog } from "./TutorialWelcomeDialog";
import { useTutorialProgress } from "@/lib/tutorials/useTutorialProgress";

/**
 * TutorialGate - Layout-level component that shows the welcome dialog
 * for first-time users who haven't seen the tutorial yet.
 *
 * Pattern: Same as ChangePasswordDialog - sits in the app layout
 * and shows based on user state, non-invasive.
 */
export function TutorialGate() {
  const { user } = useAuth();
  const { progress, dismiss } = useTutorialProgress();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Fast local check to avoid flash on repeat visits
    const localDismissed = getStorageItem(STORAGE_KEYS.TUTORIAL_DISMISSED, false);
    if (localDismissed) return;

    // Server-side check: if tutorial_progress exists and is dismissed, skip
    const serverProgress = user.tutorial_progress;
    if (serverProgress?.dismissed) {
      setStorageItem(STORAGE_KEYS.TUTORIAL_DISMISSED, true);
      return;
    }

    // Also check the hook data (covers case where /me loaded but tutorial_progress was null)
    if (progress.dismissed) {
      setStorageItem(STORAGE_KEYS.TUTORIAL_DISMISSED, true);
      return;
    }

    // If there's any completed chapters, don't show welcome (they've seen it)
    if (
      serverProgress?.completed_chapters?.length ||
      progress.completed_chapters.length > 0
    ) {
      setStorageItem(STORAGE_KEYS.TUTORIAL_DISMISSED, true);
      return;
    }

    // New user - show welcome dialog
    setShowWelcome(true);
  }, [user, progress.dismissed, progress.completed_chapters]);

  const handleDismiss = () => {
    setShowWelcome(false);
    setStorageItem(STORAGE_KEYS.TUTORIAL_DISMISSED, true);
    dismiss();
  };

  return <TutorialWelcomeDialog open={showWelcome} onDismiss={handleDismiss} />;
}
