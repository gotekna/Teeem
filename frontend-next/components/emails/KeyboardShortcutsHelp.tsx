"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["j", "↓"], description: "Next email" },
      { keys: ["k", "↑"], description: "Previous email" },
      { keys: ["o", "Enter"], description: "Open email" },
      { keys: ["Esc"], description: "Deselect / Close" },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { keys: ["x"], description: "Toggle selection" },
      { keys: ["⌘A", "Ctrl+A"], description: "Select all" },
      { keys: ["Esc"], description: "Clear selection" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["e"], description: "Archive" },
      { keys: ["s"], description: "Star / Unstar" },
      { keys: ["p"], description: "Pin / Unpin" },
      { keys: ["v"], description: "Toggle VIP sender" },
      { keys: ["u"], description: "Toggle read/unread" },
      { keys: ["m"], description: "Move to folder" },
      { keys: ["d", "#"], description: "Delete" },
    ],
  },
  {
    title: "Compose",
    shortcuts: [
      { keys: ["c"], description: "Compose new email" },
      { keys: ["r"], description: "Reply" },
      { keys: ["f"], description: "Forward" },
    ],
  },
  {
    title: "Split Inbox",
    shortcuts: [
      { keys: ["1"], description: "VIP" },
      { keys: ["2"], description: "Team" },
      { keys: ["3"], description: "Newsletters" },
      { keys: ["4"], description: "Other" },
    ],
  },
  {
    title: "Other",
    shortcuts: [{ keys: ["?"], description: "Show this help" }],
  },
];

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center",
        "min-w-[24px] h-6 px-1.5",
        "text-xs font-mono font-medium",
        "bg-muted border border-border rounded",
        "shadow-sm"
      )}
    >
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
}: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Keyboard Shortcuts</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          {keyIdx > 0 && (
                            <span className="text-xs text-muted-foreground">
                              or
                            </span>
                          )}
                          <KeyBadge>{key}</KeyBadge>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Press <KeyBadge>Esc</KeyBadge> to close
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsHelp;
