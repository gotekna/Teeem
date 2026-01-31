"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, ExternalLink } from "lucide-react";
import { getChapterName } from "@/lib/helpMapping";

interface ContextualHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapter: number | null;
  section?: string;
}

export function ContextualHelpModal({
  isOpen,
  onClose,
  chapter,
}: ContextualHelpModalProps) {
  const router = useRouter();

  const handleOpenDocs = () => {
    onClose();
    // Navigate to /docs with chapter parameter if available
    if (chapter !== null) {
      router.push(`/docs?chapter=${chapter}`);
    } else {
      router.push("/docs");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <DialogTitle className="text-xl font-semibold">
              {chapter !== null
                ? `Chapter ${chapter}: ${getChapterName(chapter)}`
                : "Help Documentation"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="py-4">
          <p className="text-muted-foreground">
            View the full documentation for detailed guides, tutorials, and reference material.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleOpenDocs} className="bg-indigo-600 hover:bg-indigo-700">
            <BookOpen className="h-4 w-4 mr-2" />
            Open Documentation
            <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
