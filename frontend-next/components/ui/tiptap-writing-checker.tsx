"use client";

import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { api } from "@/lib/api";

// Types for writing issues
export interface WritingIssue {
  type: "spelling" | "grammar" | "tone";
  severity: "error" | "warning";
  original: string;
  suggestion: string;
  explanation: string;
  from: number;
  to: number;
}

interface WritingCheckResult {
  issues: Array<{
    type: "spelling" | "grammar" | "tone";
    severity: "error" | "warning";
    original: string;
    suggestion: string;
    explanation: string;
  }>;
  corrected_text: string;
  quality: "excellent" | "good" | "needs_work";
}

// Plugin key for accessing plugin state
const writingCheckerKey = new PluginKey<WritingCheckerState>("writingChecker");

interface WritingCheckerState {
  decorations: DecorationSet;
  issues: WritingIssue[];
  isChecking: boolean;
}

// Tooltip component for showing issue details
function IssueTooltip({
  issue,
  onFix,
  onDismiss,
}: {
  issue: WritingIssue;
  onFix: () => void;
  onDismiss: () => void;
}) {
  const typeConfig = {
    spelling: { color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", label: "Spelling" },
    grammar: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", label: "Grammar" },
    tone: { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", label: "Tone" },
  };

  const config = typeConfig[issue.type];

  return (
    <div
      className="bg-popover text-popover-foreground shadow-xl rounded-lg border p-3 w-72 z-[9999]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with type badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
          {config.label}
        </span>
      </div>

      {/* Before/After comparison */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground w-12 shrink-0 pt-0.5">Before:</span>
          <span className="text-sm line-through text-muted-foreground">{issue.original}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground w-12 shrink-0 pt-0.5">After:</span>
          <span className="text-sm font-medium text-green-600 dark:text-green-400">{issue.suggestion}</span>
        </div>
      </div>

      {issue.explanation && (
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          {issue.explanation}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onFix}
          className="flex-1 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium transition-colors"
        >
          Apply Fix
        </button>
        <button
          onClick={onDismiss}
          className="text-sm px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}

// Create the WritingChecker extension
export const WritingChecker = Extension.create({
  name: "writingChecker",

  addOptions() {
    return {
      enabled: true,
      debounceMs: 1000,
      context: "email_body",
      onIssuesChange: undefined as ((issues: WritingIssue[]) => void) | undefined,
    };
  },

  addStorage() {
    return {
      checkTimeout: null as NodeJS.Timeout | null,
      lastCheckedText: "",
      tooltipRoot: null as Root | null,
      tooltipContainer: null as HTMLDivElement | null,
      dismissedIssues: new Set<string>(),
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin<WritingCheckerState>({
        key: writingCheckerKey,

        state: {
          init(): WritingCheckerState {
            return {
              decorations: DecorationSet.empty,
              issues: [],
              isChecking: false,
            };
          },

          apply(tr, state, oldState, newState): WritingCheckerState {
            // Map decorations through the transaction
            let decorations = state.decorations.map(tr.mapping, tr.doc);

            // Check for metadata updates
            const meta = tr.getMeta(writingCheckerKey);
            if (meta) {
              if (meta.decorations !== undefined) {
                decorations = meta.decorations;
              }
              if (meta.issues !== undefined) {
                return {
                  ...state,
                  issues: meta.issues,
                  decorations,
                  isChecking: meta.isChecking ?? state.isChecking,
                };
              }
              if (meta.isChecking !== undefined) {
                return { ...state, isChecking: meta.isChecking, decorations };
              }
            }

            return { ...state, decorations };
          },
        },

        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty;
          },

          handleClick(view, pos, event) {
            const state = this.getState(view.state);
            if (!state) return false;

            // Find if we clicked on an issue decoration
            const clickedIssue = state.issues.find(
              (issue) => pos >= issue.from && pos <= issue.to
            );

            if (clickedIssue) {
              // Remove existing tooltip
              if (extension.storage.tooltipContainer) {
                extension.storage.tooltipRoot?.unmount();
                extension.storage.tooltipContainer.remove();
                extension.storage.tooltipContainer = null;
                extension.storage.tooltipRoot = null;
              }

              // Create tooltip container
              const tooltipContainer = document.createElement("div");
              tooltipContainer.style.position = "absolute";
              tooltipContainer.style.zIndex = "9999";
              document.body.appendChild(tooltipContainer);

              // Position near the click
              const coords = view.coordsAtPos(clickedIssue.from);
              tooltipContainer.style.left = `${coords.left}px`;
              tooltipContainer.style.top = `${coords.bottom + 5}px`;

              extension.storage.tooltipContainer = tooltipContainer;
              extension.storage.tooltipRoot = createRoot(tooltipContainer);

              const handleFix = () => {
                // Replace the text with the suggestion
                const tr = view.state.tr.replaceWith(
                  clickedIssue.from,
                  clickedIssue.to,
                  view.state.schema.text(clickedIssue.suggestion)
                );
                view.dispatch(tr);

                // Clean up tooltip
                extension.storage.tooltipRoot?.unmount();
                extension.storage.tooltipContainer?.remove();
                extension.storage.tooltipContainer = null;
                extension.storage.tooltipRoot = null;
              };

              const handleDismiss = () => {
                // Add to dismissed issues
                extension.storage.dismissedIssues.add(
                  `${clickedIssue.original}:${clickedIssue.from}`
                );

                // Remove this decoration
                const newIssues = state.issues.filter((i) => i !== clickedIssue);
                const decorations = createDecorations(view.state.doc, newIssues);
                const metaTr = view.state.tr.setMeta(writingCheckerKey, {
                  decorations,
                  issues: newIssues,
                });
                view.dispatch(metaTr);

                // Clean up tooltip
                extension.storage.tooltipRoot?.unmount();
                extension.storage.tooltipContainer?.remove();
                extension.storage.tooltipContainer = null;
                extension.storage.tooltipRoot = null;
              };

              extension.storage.tooltipRoot.render(
                <IssueTooltip
                  issue={clickedIssue}
                  onFix={handleFix}
                  onDismiss={handleDismiss}
                />
              );

              // Close tooltip on click outside
              const closeTooltip = (e: MouseEvent) => {
                if (!tooltipContainer.contains(e.target as Node)) {
                  extension.storage.tooltipRoot?.unmount();
                  tooltipContainer.remove();
                  extension.storage.tooltipContainer = null;
                  extension.storage.tooltipRoot = null;
                  document.removeEventListener("click", closeTooltip);
                }
              };
              setTimeout(() => {
                document.addEventListener("click", closeTooltip);
              }, 0);

              return true;
            }

            return false;
          },
        },

        view(editorView) {
          const scheduleCheck = () => {
            if (!extension.options.enabled) return;

            // Clear existing timeout
            if (extension.storage.checkTimeout) {
              clearTimeout(extension.storage.checkTimeout);
            }

            // Schedule new check
            extension.storage.checkTimeout = setTimeout(async () => {
              const text = editorView.state.doc.textContent;

              // Skip if text hasn't changed or is too short
              if (
                text === extension.storage.lastCheckedText ||
                text.length < 5
              ) {
                return;
              }

              extension.storage.lastCheckedText = text;

              // Set checking state
              const checkingTr = editorView.state.tr.setMeta(writingCheckerKey, {
                isChecking: true,
              });
              editorView.dispatch(checkingTr);

              try {
                const response = await api.post<{
                  success: boolean;
                  data: WritingCheckResult;
                }>("/api/v1/writing_assistant/check", {
                  text,
                  context: extension.options.context,
                });

                if (response?.data) {
                  // Find positions for each issue in the document
                  const issues = findIssuePositions(
                    editorView.state.doc,
                    response.data.issues,
                    extension.storage.dismissedIssues
                  );

                  // Create decorations
                  const decorations = createDecorations(
                    editorView.state.doc,
                    issues
                  );

                  // Update state
                  const tr = editorView.state.tr.setMeta(writingCheckerKey, {
                    decorations,
                    issues,
                    isChecking: false,
                  });
                  editorView.dispatch(tr);

                  // Notify callback
                  extension.options.onIssuesChange?.(issues);
                }
              } catch (error) {
                console.error("Writing check failed:", error);
                const tr = editorView.state.tr.setMeta(writingCheckerKey, {
                  isChecking: false,
                });
                editorView.dispatch(tr);
              }
            }, extension.options.debounceMs);
          };

          return {
            update(view, prevState) {
              // Check if content changed
              if (!view.state.doc.eq(prevState.doc)) {
                scheduleCheck();
              }
            },
            destroy() {
              if (extension.storage.checkTimeout) {
                clearTimeout(extension.storage.checkTimeout);
              }
              if (extension.storage.tooltipContainer) {
                extension.storage.tooltipRoot?.unmount();
                extension.storage.tooltipContainer.remove();
              }
            },
          };
        },
      }),
    ];
  },
});

// Find positions of issues in the document
function findIssuePositions(
  doc: ProseMirrorNode,
  issues: WritingCheckResult["issues"],
  dismissedIssues: Set<string>
): WritingIssue[] {
  const result: WritingIssue[] = [];
  const text = doc.textContent;

  for (const issue of issues) {
    // Find all occurrences of the original text
    let searchPos = 0;
    while (true) {
      const index = text.indexOf(issue.original, searchPos);
      if (index === -1) break;

      // Convert text position to document position (add 1 for doc start)
      const from = index + 1;
      const to = from + issue.original.length;

      // Check if this issue was dismissed
      const dismissKey = `${issue.original}:${from}`;
      if (!dismissedIssues.has(dismissKey)) {
        result.push({
          ...issue,
          from,
          to,
        });
      }

      searchPos = index + 1;
    }
  }

  return result;
}

// Create decorations for issues
function createDecorations(
  doc: ProseMirrorNode,
  issues: WritingIssue[]
): DecorationSet {
  const decorations: Decoration[] = [];

  for (const issue of issues) {
    const className =
      issue.type === "spelling"
        ? "writing-error-spelling"
        : issue.type === "grammar"
          ? "writing-error-grammar"
          : "writing-error-tone";

    decorations.push(
      Decoration.inline(issue.from, issue.to, {
        class: className,
        "data-issue-type": issue.type,
      })
    );
  }

  return DecorationSet.create(doc, decorations);
}

// CSS styles for the decorations (to be added to globals.css)
export const writingCheckerStyles = `
  .writing-error-spelling {
    text-decoration: underline wavy red;
    text-decoration-skip-ink: none;
    cursor: pointer;
  }

  .writing-error-grammar {
    text-decoration: underline wavy #eab308;
    text-decoration-skip-ink: none;
    cursor: pointer;
  }

  .writing-error-tone {
    text-decoration: underline wavy #3b82f6;
    text-decoration-skip-ink: none;
    cursor: pointer;
  }
`;

// Hook to get writing checker state from editor
export function useWritingCheckerState(editor: unknown): {
  issues: WritingIssue[];
  isChecking: boolean;
} {
  const [state, setState] = React.useState<{
    issues: WritingIssue[];
    isChecking: boolean;
  }>({
    issues: [],
    isChecking: false,
  });

  React.useEffect(() => {
    if (!editor) return;

    const typedEditor = editor as {
      state: { plugins: Plugin[] };
      on: (event: string, handler: () => void) => void;
      off: (event: string, handler: () => void) => void;
    };

    const updateState = () => {
      const pluginState = writingCheckerKey.getState(
        typedEditor.state as unknown as Parameters<typeof writingCheckerKey.getState>[0]
      );
      if (pluginState) {
        setState({
          issues: pluginState.issues,
          isChecking: pluginState.isChecking,
        });
      }
    };

    typedEditor.on("transaction", updateState);
    updateState();

    return () => {
      typedEditor.off("transaction", updateState);
    };
  }, [editor]);

  return state;
}
