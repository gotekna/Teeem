"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RichTextEditor, htmlToPlainText, plainTextToHtml } from "@/components/ui/rich-text-editor";
import { Check, X } from "lucide-react";

/**
 * RichTextEditorModal - THE ONE standard rich text editing modal
 *
 * SSoT for text editing across the application:
 * - Questions, Headers, Answers, Action Items in TaskHub
 * - Notes, Descriptions anywhere in the app
 * - Any multi-line text that benefits from formatting
 *
 * Features:
 * - Word-like ribbon toolbar (Bold, Italic, Underline, Lists, Styles, etc.)
 * - Dark mode support
 * - Consistent UX across the entire application
 */

interface RichTextEditorModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when the modal should close */
  onOpenChange: (open: boolean) => void;
  /** The initial value (can be plain text or HTML) */
  value: string;
  /** Called when user saves with the new value (HTML format) */
  onSave: (value: string) => void;
  /** Optional title for the modal */
  title?: string;
  /** Optional placeholder text */
  placeholder?: string;
  /** Whether the value is plain text (will be converted to/from HTML) */
  plainText?: boolean;
  /** Minimum height of the editor in pixels */
  minHeight?: number;
  /** Enable AI writing checker / spell check (default: true) */
  enableWritingChecker?: boolean;
  /** Context for the writing checker to understand the content type */
  writingContext?: "email_body" | "notes" | "general";
}

export function RichTextEditorModal({
  open,
  onOpenChange,
  value,
  onSave,
  title = "Edit",
  placeholder = "Type here...",
  plainText = false,
  minHeight = 300,
  enableWritingChecker = true,
  writingContext = "general",
}: RichTextEditorModalProps) {
  // Convert plain text to HTML if needed
  const initialValue = React.useMemo(() => {
    if (!value) return "";
    if (plainText) {
      return plainTextToHtml(value);
    }
    return value;
  }, [value, plainText]);

  const [content, setContent] = React.useState(initialValue);

  // Reset content when modal opens with new value
  React.useEffect(() => {
    if (open) {
      setContent(initialValue);
    }
  }, [open, initialValue]);

  const handleSave = () => {
    let result = content;

    // Convert back to plain text if needed
    if (plainText) {
      result = htmlToPlainText(content);
    }

    onSave(result);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // Handle Escape key and Cmd+Enter to save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder={placeholder}
            minHeight={minHeight}
            className="border-0 rounded-none"
            enableWritingChecker={enableWritingChecker}
            writingContext={writingContext}
          />
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <div className="flex items-center gap-2 w-full justify-between">
            <span className="text-xs text-muted-foreground">
              Press Cmd+Enter to save, Escape to cancel
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Check className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RichTextEditorModal;
