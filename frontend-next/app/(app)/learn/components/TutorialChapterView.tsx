"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CheckCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TutorialChapter } from "@/lib/tutorials/tutorial-types";
import { TutorialJoshua } from "./TutorialJoshua";

interface TutorialChapterViewProps {
  chapter: TutorialChapter;
  isCompleted: boolean;
  onComplete: () => void;
  isCompleting: boolean;
}

export function TutorialChapterView({
  chapter,
  isCompleted,
  onComplete,
  isCompleting,
}: TutorialChapterViewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();
  const step = chapter.steps[currentStep];
  const isLastStep = currentStep === chapter.steps.length - 1;

  return (
    <div className="flex flex-col h-full">
      {/* Chapter header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{chapter.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{chapter.description}</p>
        </div>
        {isCompleted && (
          <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            Completed
          </div>
        )}
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-2 mb-6">
        {chapter.steps.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentStep(idx)}
            className={cn(
              "h-2 rounded-full transition-all",
              idx === currentStep
                ? "w-8 bg-primary"
                : idx < currentStep
                ? "w-2 bg-primary/40"
                : "w-2 bg-muted-foreground/20"
            )}
          />
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          Step {currentStep + 1} of {chapter.steps.length}
        </span>
      </div>

      {/* Step content */}
      <Card className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Step title and description */}
          <div>
            <h3 className="text-lg font-medium text-foreground mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
          </div>

          {/* Screenshot placeholder */}
          {step.screenshot && (
            <div className="rounded-lg border border-border overflow-hidden">
              <img
                src={step.screenshot}
                alt={step.title}
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Joshua speech bubble */}
          <TutorialJoshua message={step.joshuaMessage} emotion={step.joshuaEmotion} />

          {/* Try it now button */}
          {step.actionUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(step.actionUrl!)}
              className="gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Try It Now
            </Button>
          )}
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentStep((s) => s - 1)}
          disabled={currentStep === 0}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        {isLastStep ? (
          <Button
            size="sm"
            onClick={onComplete}
            disabled={isCompleted || isCompleting}
            className="gap-1.5"
          >
            {isCompleted ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Already Completed
              </>
            ) : isCompleting ? (
              "Saving..."
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Mark Complete
              </>
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => setCurrentStep((s) => s + 1)}
            className="gap-1.5"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
