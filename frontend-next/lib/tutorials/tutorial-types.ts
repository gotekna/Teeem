/**
 * Tutorial System Types (TEEEM Academy)
 *
 * SSoT for tutorial chapter/step data structures and progress tracking.
 */

import type { LucideIcon } from "lucide-react";

export type JoshuaEmotion = "wave" | "point" | "celebrate" | "think";

export interface TutorialStep {
  title: string;
  description: string;
  screenshot?: string; // /tutorials/chapter-id/step-N.png
  joshuaMessage: string;
  joshuaEmotion: JoshuaEmotion;
  actionUrl?: string; // "Try it now" link
}

export interface TutorialChapter {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  roles: string[] | "all";
  estimatedMinutes: number;
  steps: TutorialStep[];
}

export interface TutorialProgress {
  dismissed: boolean;
  completed_chapters: string[];
  completed_at: string | null;
}
