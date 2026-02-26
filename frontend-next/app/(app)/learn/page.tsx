"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, GraduationCap, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTutorialProgress } from "@/lib/tutorials/useTutorialProgress";
import { getChaptersForRoles } from "@/lib/tutorials/tutorial-content";
import { TutorialHub } from "./components/TutorialHub";
import { TutorialChapterView } from "./components/TutorialChapterView";
import { TutorialJoshua } from "./components/TutorialJoshua";

export default function LearnPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { progress, completeChapter, reset, isCompleting } = useTutorialProgress();
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const roleNames = user?.role_names ?? [];
  const chapters = useMemo(() => getChaptersForRoles(roleNames), [roleNames]);
  const selectedChapter = chapters.find((c) => c.id === selectedChapterId) ?? null;
  const completedCount = chapters.filter((c) => progress.completed_chapters.includes(c.id)).length;
  const progressPercent = chapters.length > 0 ? (completedCount / chapters.length) * 100 : 0;
  const allComplete = completedCount === chapters.length && chapters.length > 0;

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">TEEEM Academy</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {completedCount}/{chapters.length} chapters
            </span>
            <Progress value={progressPercent} className="w-32 h-2" />
          </div>
          {completedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => reset()} className="gap-1.5 text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar - chapter list */}
        <div className="w-72 border-r border-border p-4 overflow-y-auto flex-shrink-0">
          <TutorialHub
            chapters={chapters}
            completedChapters={progress.completed_chapters}
            selectedChapterId={selectedChapterId}
            onSelectChapter={setSelectedChapterId}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedChapter ? (
            <TutorialChapterView
              key={selectedChapter.id}
              chapter={selectedChapter}
              isCompleted={progress.completed_chapters.includes(selectedChapter.id)}
              onComplete={() => completeChapter(selectedChapter.id)}
              isCompleting={isCompleting}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              {allComplete ? (
                <div className="space-y-4">
                  <TutorialJoshua
                    message="You've completed all the chapters! You're a TEEEM legend. If you ever need a refresher, come back anytime!"
                    emotion="celebrate"
                  />
                  <p className="text-sm text-muted-foreground mt-6">
                    All {chapters.length} chapters completed. You can revisit any chapter from the list.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <TutorialJoshua
                    message="G'day! Pick a chapter from the left to get started. I'll walk you through everything you need to know!"
                    emotion="wave"
                  />
                  <p className="text-sm text-muted-foreground mt-6">
                    Select a chapter to begin learning
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
