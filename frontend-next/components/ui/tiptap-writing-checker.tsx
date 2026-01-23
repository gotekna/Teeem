"use client";

import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { api } from "@/lib/api";
import { Check, X, Sparkles, ChevronRight } from "lucide-react";

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
  correctedText: string | null;
}

// Configuration for issue type styling
const issueTypeConfig = {
  spelling: {
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/50",
    border: "border-red-200 dark:border-red-800",
    label: "Spelling",
    icon: "ABC",
  },
  grammar: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    border: "border-amber-200 dark:border-amber-800",
    label: "Grammar",
    icon: "Aa",
  },
  tone: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/50",
    border: "border-blue-200 dark:border-blue-800",
    label: "Tone",
    icon: "✨",
  },
};

// Compact hover tooltip - shows just the suggestion for quick fix
function HoverTooltip({
  issue,
  onFix,
  onShowDetails,
}: {
  issue: WritingIssue;
  onFix: () => void;
  onShowDetails: () => void;
}) {
  const config = issueTypeConfig[issue.type];

  return (
    <div
      className="bg-popover text-popover-foreground shadow-lg rounded-lg border overflow-hidden min-w-[200px] max-w-[320px] animate-in fade-in-0 zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Quick suggestion bar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${config.color}`}>
          {config.label}
        </span>
        <span className="text-xs text-muted-foreground">→</span>
        <span className="text-sm font-medium text-green-600 dark:text-green-400 flex-1 truncate">
          {issue.suggestion}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-stretch divide-x">
        <button
          onClick={onFix}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
          Fix
        </button>
        <button
          onClick={onShowDetails}
          className="flex items-center justify-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="text-xs">Why?</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// Full detail tooltip - shows explanation
function DetailTooltip({
  issue,
  onFix,
  onDismiss,
  onClose,
}: {
  issue: WritingIssue;
  onFix: () => void;
  onDismiss: () => void;
  onClose: () => void;
}) {
  const config = issueTypeConfig[issue.type];

  return (
    <div
      className="bg-popover text-popover-foreground shadow-xl rounded-lg border overflow-hidden w-80 animate-in fade-in-0 zoom-in-95 duration-150"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 ${config.bg} border-b ${config.border}`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wide ${config.color}`}>
            {config.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Before/After comparison */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-10 shrink-0 pt-0.5">
              Was
            </span>
            <span className="text-sm line-through text-red-500/70 dark:text-red-400/70 break-words">
              {issue.original}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-10 shrink-0 pt-0.5">
              Use
            </span>
            <span className="text-sm font-medium text-green-600 dark:text-green-400 break-words">
              {issue.suggestion}
            </span>
          </div>
        </div>

        {/* Explanation */}
        {issue.explanation && (
          <p className="text-xs text-muted-foreground leading-relaxed pl-12">
            {issue.explanation}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-stretch border-t divide-x">
        <button
          onClick={onFix}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary/5 hover:bg-primary/10 text-primary transition-colors"
        >
          <Check className="h-4 w-4" />
          Apply Fix
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
      debounceMs: 500, // Faster response (was 1000)
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
      hoverRoot: null as Root | null,
      hoverContainer: null as HTMLDivElement | null,
      dismissedIssues: new Set<string>(),
      currentHoveredIssue: null as WritingIssue | null,
      isTooltipOpen: false,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    // Helper to clean up hover tooltip
    const cleanupHover = () => {
      if (extension.storage.hoverRoot) {
        extension.storage.hoverRoot.unmount();
        extension.storage.hoverContainer?.remove();
        extension.storage.hoverRoot = null;
        extension.storage.hoverContainer = null;
      }
      extension.storage.currentHoveredIssue = null;
    };

    // Helper to clean up detail tooltip
    const cleanupTooltip = () => {
      if (extension.storage.tooltipRoot) {
        extension.storage.tooltipRoot.unmount();
        extension.storage.tooltipContainer?.remove();
        extension.storage.tooltipRoot = null;
        extension.storage.tooltipContainer = null;
      }
      extension.storage.isTooltipOpen = false;
    };

    // Helper to position tooltip smartly
    const positionTooltip = (
      container: HTMLDivElement,
      coords: { top: number; bottom: number; left: number; right: number },
      width: number,
      height: number
    ) => {
      const padding = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Horizontal: prefer left-aligned, but shift if needed
      let left = coords.left;
      if (left + width + padding > viewportWidth) {
        left = Math.max(padding, viewportWidth - width - padding);
      }

      // Vertical: prefer below, flip above if needed
      let top: number;
      if (coords.bottom + height + padding > viewportHeight) {
        top = coords.top - height - padding;
      } else {
        top = coords.bottom + padding;
      }
      top = Math.max(padding, top);

      container.style.left = `${left}px`;
      container.style.top = `${top}px`;
    };

    return [
      new Plugin<WritingCheckerState>({
        key: writingCheckerKey,

        state: {
          init(): WritingCheckerState {
            return {
              decorations: DecorationSet.empty,
              issues: [],
              isChecking: false,
              correctedText: null,
            };
          },

          apply(tr, state, oldState, newState): WritingCheckerState {
            let decorations = state.decorations.map(tr.mapping, tr.doc);

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
                  correctedText: meta.correctedText ?? state.correctedText,
                };
              }
              if (meta.isChecking !== undefined) {
                return { ...state, isChecking: meta.isChecking, decorations };
              }
              if (meta.correctedText !== undefined) {
                return { ...state, correctedText: meta.correctedText, decorations };
              }
            }

            return { ...state, decorations };
          },
        },

        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty;
          },

          // Handle hover for instant preview
          handleDOMEvents: {
            mouseover(view, event) {
              // Skip if detail tooltip is open
              if (extension.storage.isTooltipOpen) return false;

              const target = event.target as HTMLElement;

              // Check if hovering over an issue decoration
              if (
                target.classList.contains("writing-issue-spelling") ||
                target.classList.contains("writing-issue-grammar") ||
                target.classList.contains("writing-issue-tone")
              ) {
                const pos = view.posAtDOM(target, 0);
                const state = writingCheckerKey.getState(view.state);
                if (!state) return false;

                const hoveredIssue = state.issues.find(
                  (issue) => pos >= issue.from && pos <= issue.to
                );

                // Skip if same issue
                if (hoveredIssue === extension.storage.currentHoveredIssue) {
                  return false;
                }

                // Clean up previous hover
                cleanupHover();

                if (hoveredIssue) {
                  extension.storage.currentHoveredIssue = hoveredIssue;

                  // Create hover container
                  const hoverContainer = document.createElement("div");
                  hoverContainer.style.position = "fixed";
                  hoverContainer.style.zIndex = "9999";
                  document.body.appendChild(hoverContainer);

                  const coords = view.coordsAtPos(hoveredIssue.from);
                  positionTooltip(hoverContainer, coords, 280, 80);

                  extension.storage.hoverContainer = hoverContainer;
                  extension.storage.hoverRoot = createRoot(hoverContainer);

                  const handleFix = () => {
                    // Fix THIS specific issue only
                    const tr = view.state.tr.replaceWith(
                      hoveredIssue.from,
                      hoveredIssue.to,
                      view.state.schema.text(hoveredIssue.suggestion)
                    );

                    // Remove this issue from the list
                    const currentState = writingCheckerKey.getState(view.state);
                    if (currentState) {
                      const newIssues = currentState.issues.filter((i) => i !== hoveredIssue);
                      const decorations = createDecorations(tr.doc, newIssues);
                      tr.setMeta(writingCheckerKey, {
                        decorations,
                        issues: newIssues,
                      });
                    }

                    view.dispatch(tr);
                    cleanupHover();
                    view.focus();
                  };

                  const handleShowDetails = () => {
                    cleanupHover();
                    // Trigger the click handler to show full tooltip
                    showDetailTooltip(view, hoveredIssue);
                  };

                  extension.storage.hoverRoot.render(
                    <HoverTooltip
                      issue={hoveredIssue}
                      onFix={handleFix}
                      onShowDetails={handleShowDetails}
                    />
                  );
                }
              }

              return false;
            },

            mouseout(view, event) {
              const target = event.target as HTMLElement;
              const relatedTarget = event.relatedTarget as HTMLElement | null;

              // Don't cleanup if moving to the hover tooltip itself
              if (
                extension.storage.hoverContainer &&
                relatedTarget &&
                extension.storage.hoverContainer.contains(relatedTarget)
              ) {
                return false;
              }

              // Check if leaving an issue decoration
              if (
                target.classList.contains("writing-issue-spelling") ||
                target.classList.contains("writing-issue-grammar") ||
                target.classList.contains("writing-issue-tone")
              ) {
                // Delay cleanup to allow moving to hover tooltip
                setTimeout(() => {
                  if (!extension.storage.hoverContainer?.matches(":hover")) {
                    cleanupHover();
                  }
                }, 100);
              }

              return false;
            },
          },

          // Handle click for detail view
          handleClick(view, pos, event) {
            const state = this.getState(view.state);
            if (!state) return false;

            const clickedIssue = state.issues.find(
              (issue) => pos >= issue.from && pos <= issue.to
            );

            if (clickedIssue) {
              cleanupHover();
              showDetailTooltip(view, clickedIssue);
              return true;
            }

            return false;
          },
        },

        view(editorView) {
          // Show detail tooltip function (shared between hover and click)
          const showDetailTooltipFn = (
            view: typeof editorView,
            issue: WritingIssue
          ) => {
            cleanupTooltip();
            extension.storage.isTooltipOpen = true;

            const tooltipContainer = document.createElement("div");
            tooltipContainer.style.position = "fixed";
            tooltipContainer.style.zIndex = "9999";
            document.body.appendChild(tooltipContainer);

            const coords = view.coordsAtPos(issue.from);
            positionTooltip(tooltipContainer, coords, 320, 200);

            extension.storage.tooltipContainer = tooltipContainer;
            extension.storage.tooltipRoot = createRoot(tooltipContainer);

            const handleFix = () => {
              // Fix THIS specific issue only
              const tr = view.state.tr.replaceWith(
                issue.from,
                issue.to,
                view.state.schema.text(issue.suggestion)
              );

              // Remove this issue from the list
              const currentState = writingCheckerKey.getState(view.state);
              if (currentState) {
                const newIssues = currentState.issues.filter((i) => i !== issue);
                const decorations = createDecorations(tr.doc, newIssues);
                tr.setMeta(writingCheckerKey, {
                  decorations,
                  issues: newIssues,
                });
              }

              view.dispatch(tr);
              cleanupTooltip();
              view.focus();
            };

            const handleDismiss = () => {
              extension.storage.dismissedIssues.add(`${issue.original}:${issue.from}`);

              const currentState = writingCheckerKey.getState(view.state);
              if (currentState) {
                const newIssues = currentState.issues.filter((i) => i !== issue);
                const decorations = createDecorations(view.state.doc, newIssues);
                const tr = view.state.tr.setMeta(writingCheckerKey, {
                  decorations,
                  issues: newIssues,
                });
                view.dispatch(tr);
              }

              cleanupTooltip();
              view.focus();
            };

            const handleClose = () => {
              cleanupTooltip();
              view.focus();
            };

            extension.storage.tooltipRoot.render(
              <DetailTooltip
                issue={issue}
                onFix={handleFix}
                onDismiss={handleDismiss}
                onClose={handleClose}
              />
            );

            // Close on click outside
            const closeHandler = (e: MouseEvent) => {
              if (!tooltipContainer.contains(e.target as Node)) {
                cleanupTooltip();
                document.removeEventListener("mousedown", closeHandler);
              }
            };
            setTimeout(() => {
              document.addEventListener("mousedown", closeHandler);
            }, 0);

            // Close on Escape
            const escapeHandler = (e: KeyboardEvent) => {
              if (e.key === "Escape") {
                cleanupTooltip();
                document.removeEventListener("keydown", escapeHandler);
                view.focus();
              }
            };
            document.addEventListener("keydown", escapeHandler);
          };

          // Make available globally for hover handler
          (window as unknown as { __showDetailTooltip: typeof showDetailTooltipFn }).__showDetailTooltip = showDetailTooltipFn;

          const scheduleCheck = () => {
            if (!extension.options.enabled) return;

            if (extension.storage.checkTimeout) {
              clearTimeout(extension.storage.checkTimeout);
            }

            extension.storage.checkTimeout = setTimeout(async () => {
              const text = editorView.state.doc.textContent;

              if (
                text === extension.storage.lastCheckedText ||
                text.length < 5
              ) {
                return;
              }

              extension.storage.lastCheckedText = text;

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
                  const issues = findIssuePositions(
                    editorView.state.doc,
                    response.data.issues,
                    extension.storage.dismissedIssues
                  );

                  const decorations = createDecorations(
                    editorView.state.doc,
                    issues
                  );

                  const tr = editorView.state.tr.setMeta(writingCheckerKey, {
                    decorations,
                    issues,
                    isChecking: false,
                    correctedText: response.data.corrected_text,
                  });
                  editorView.dispatch(tr);

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
              if (!view.state.doc.eq(prevState.doc)) {
                scheduleCheck();
              }
            },
            destroy() {
              if (extension.storage.checkTimeout) {
                clearTimeout(extension.storage.checkTimeout);
              }
              cleanupHover();
              cleanupTooltip();
            },
          };
        },
      }),
    ];

    // Helper function to show detail tooltip (accessed from hover handler)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function showDetailTooltip(view: any, issue: WritingIssue) {
      const fn = (window as unknown as { __showDetailTooltip?: (view: unknown, issue: WritingIssue) => void }).__showDetailTooltip;
      if (fn) {
        fn(view, issue);
      }
    }
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
    let searchPos = 0;
    while (true) {
      const index = text.indexOf(issue.original, searchPos);
      if (index === -1) break;

      const from = index + 1;
      const to = from + issue.original.length;

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
        ? "writing-issue-spelling"
        : issue.type === "grammar"
          ? "writing-issue-grammar"
          : "writing-issue-tone";

    decorations.push(
      Decoration.inline(issue.from, issue.to, {
        class: className,
        "data-issue-type": issue.type,
        "data-suggestion": issue.suggestion,
      })
    );
  }

  return DecorationSet.create(doc, decorations);
}

// CSS styles for the decorations
export const writingCheckerStyles = `
  /* Spelling errors - red wavy underline */
  .writing-issue-spelling {
    text-decoration: underline wavy #ef4444;
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
    text-decoration-skip-ink: none;
    cursor: pointer;
    border-radius: 2px;
    transition: background-color 0.15s ease;
  }
  .writing-issue-spelling:hover {
    background-color: rgba(239, 68, 68, 0.1);
  }

  /* Grammar errors - amber/yellow wavy underline */
  .writing-issue-grammar {
    text-decoration: underline wavy #f59e0b;
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
    text-decoration-skip-ink: none;
    cursor: pointer;
    border-radius: 2px;
    transition: background-color 0.15s ease;
  }
  .writing-issue-grammar:hover {
    background-color: rgba(245, 158, 11, 0.1);
  }

  /* Tone suggestions - blue wavy underline */
  .writing-issue-tone {
    text-decoration: underline wavy #3b82f6;
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
    text-decoration-skip-ink: none;
    cursor: pointer;
    border-radius: 2px;
    transition: background-color 0.15s ease;
  }
  .writing-issue-tone:hover {
    background-color: rgba(59, 130, 246, 0.1);
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

// Helper to fix all issues at once
export function fixAllIssues(editor: unknown): void {
  if (!editor) return;

  const typedEditor = editor as {
    state: unknown;
    view: { state: unknown; dispatch: (tr: unknown) => void };
    commands: { setContent: (content: string) => void };
  };

  const pluginState = writingCheckerKey.getState(
    typedEditor.state as Parameters<typeof writingCheckerKey.getState>[0]
  );

  if (pluginState?.correctedText) {
    typedEditor.commands.setContent(pluginState.correctedText);
  }
}
