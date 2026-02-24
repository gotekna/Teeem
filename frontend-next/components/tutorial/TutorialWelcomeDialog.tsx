"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";

interface TutorialWelcomeDialogProps {
  open: boolean;
  onDismiss: () => void;
}

export function TutorialWelcomeDialog({ open, onDismiss }: TutorialWelcomeDialogProps) {
  const router = useRouter();

  const handleShowMeAround = () => {
    onDismiss();
    router.push("/learn");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onDismiss(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-primary" />
            Welcome to TEEEM Academy
          </DialogTitle>
          <DialogDescription className="pt-1">
            Your personal guide to getting the most out of TEEEM.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Joshua mini SVG with speech bubble */}
          <div className="flex items-end gap-4 mb-6">
            <div className="flex-shrink-0">
              <svg viewBox="0 0 100 100" width="64" height="64">
                <defs>
                  <linearGradient id="wh-hat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fcd34d" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                  <radialGradient id="wh-skin" cx="0.4" cy="0.3">
                    <stop offset="0%" stopColor="#fde8d0" />
                    <stop offset="100%" stopColor="#f0c9a0" />
                  </radialGradient>
                </defs>
                <ellipse cx="50" cy="55" rx="22" ry="23" fill="url(#wh-skin)" />
                <ellipse cx="50" cy="68" rx="15" ry="5" fill="#d4a574" opacity="0.12" />
                {/* Eyes */}
                <ellipse cx="41" cy="52" rx="4.5" ry="5" fill="white" />
                <circle cx="42" cy="52.5" r="3" fill="#5D4037" />
                <circle cx="42" cy="52.5" r="1.8" fill="#2C1810" />
                <circle cx="43.2" cy="51" r="1.2" fill="white" />
                <ellipse cx="59" cy="52" rx="4.5" ry="5" fill="white" />
                <circle cx="58" cy="52.5" r="3" fill="#5D4037" />
                <circle cx="58" cy="52.5" r="1.8" fill="#2C1810" />
                <circle cx="59.2" cy="51" r="1.2" fill="white" />
                {/* Mouth */}
                <path d="M43 64 Q50 72 57 64" stroke="#c0392b" strokeWidth="2" fill="none" strokeLinecap="round" />
                {/* Cheeks */}
                <circle cx="34" cy="60" r="4" fill="#fca5a5" opacity="0.2" />
                <circle cx="66" cy="60" r="4" fill="#fca5a5" opacity="0.2" />
                {/* Hard hat */}
                <path d="M26 40 Q26 18 50 15 Q74 18 74 40 Z" fill="url(#wh-hat)" />
                <rect x="19" y="38" width="62" height="5" rx="2.5" fill="#b45309" />
                <circle cx="50" cy="26" r="4" fill="#fef9c3" opacity="0.8" />
                <circle cx="50" cy="26" r="2" fill="white" opacity="0.9" />
              </svg>
              <div className="flex justify-center -mt-0.5">
                <div className="bg-amber-500 text-white text-[7px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full">
                  Joshua
                </div>
              </div>
            </div>

            <div className="relative bg-muted/50 dark:bg-muted/30 rounded-2xl px-4 py-3 mb-4">
              <p className="text-sm leading-relaxed">
                G&apos;day mate! I&apos;m Joshua, your construction AI mate. Want me to show you around TEEEM? I&apos;ll walk you through the basics for your role.
              </p>
              <div className="absolute -left-[6px] bottom-3 w-3 h-3 bg-muted/50 dark:bg-muted/30 transform rotate-45" />
            </div>
          </div>

          <div className="text-sm text-muted-foreground mb-4">
            Interactive tutorials cover navigation, email, documents, and role-specific features.
            Takes about 15-20 minutes total.
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onDismiss}
          >
            Skip for Now
          </Button>
          <Button
            className="flex-1"
            onClick={handleShowMeAround}
          >
            Show Me Around
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
