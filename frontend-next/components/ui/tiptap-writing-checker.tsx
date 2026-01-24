"use client";

import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { api } from "@/lib/api";
import { Check, X, Sparkles, ChevronRight, BookPlus } from "lucide-react";

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
  const fixBtnRef = React.useRef<HTMLButtonElement>(null);
  const whyBtnRef = React.useRef<HTMLButtonElement>(null);

  // Use pointerdown/mousedown to bypass modal focus trap interference
  React.useEffect(() => {
    const fixBtn = fixBtnRef.current;
    const whyBtn = whyBtnRef.current;

    const handleFixPointerDown = (e: PointerEvent | MouseEvent) => {
      console.log('[WritingChecker] HoverTooltip Fix pointerdown');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onFix();
    };

    const handleWhyPointerDown = (e: PointerEvent | MouseEvent) => {
      console.log('[WritingChecker] HoverTooltip Why pointerdown');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onShowDetails();
    };

    fixBtn?.addEventListener('pointerdown', handleFixPointerDown, { capture: true });
    fixBtn?.addEventListener('mousedown', handleFixPointerDown, { capture: true });
    whyBtn?.addEventListener('pointerdown', handleWhyPointerDown, { capture: true });
    whyBtn?.addEventListener('mousedown', handleWhyPointerDown, { capture: true });

    return () => {
      fixBtn?.removeEventListener('pointerdown', handleFixPointerDown, { capture: true });
      fixBtn?.removeEventListener('mousedown', handleFixPointerDown, { capture: true });
      whyBtn?.removeEventListener('pointerdown', handleWhyPointerDown, { capture: true });
      whyBtn?.removeEventListener('mousedown', handleWhyPointerDown, { capture: true });
    };
  }, [onFix, onShowDetails]);

  return (
    <div
      className="bg-popover text-popover-foreground shadow-lg rounded-lg border overflow-hidden min-w-[200px] max-w-[320px] animate-in fade-in-0 zoom-in-95 duration-100"
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
          ref={fixBtnRef}
          type="button"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
          onPointerDown={(e) => {
            console.log('[WritingChecker] HoverTooltip Fix React onPointerDown');
            e.preventDefault();
            e.stopPropagation();
            onFix();
          }}
          onClick={(e) => {
            console.log('[WritingChecker] HoverTooltip Fix React onClick');
            e.preventDefault();
            e.stopPropagation();
            onFix();
          }}
        >
          <Check className="h-3.5 w-3.5" />
          Fix
        </button>
        <button
          ref={whyBtnRef}
          type="button"
          className="flex items-center justify-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          onPointerDown={(e) => {
            console.log('[WritingChecker] HoverTooltip Why React onPointerDown');
            e.preventDefault();
            e.stopPropagation();
            onShowDetails();
          }}
          onClick={(e) => {
            console.log('[WritingChecker] HoverTooltip Why React onClick');
            e.preventDefault();
            e.stopPropagation();
            onShowDetails();
          }}
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
  onAddToDictionary,
}: {
  issue: WritingIssue;
  onFix: () => void;
  onDismiss: () => void;
  onClose: () => void;
  onAddToDictionary?: () => void;
}) {
  const config = issueTypeConfig[issue.type];
  const applyFixRef = React.useRef<HTMLButtonElement>(null);
  const ignoreRef = React.useRef<HTMLButtonElement>(null);
  const addToDictRef = React.useRef<HTMLButtonElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  // ⚠️ DO NOT SIMPLIFY - Modal focus traps intercept click events (2026-01-24)
  // ════════════════════════════════════════════════════════════════════════
  // Why: When tooltip is rendered via createRoot portal to document.body,
  // modal focus traps (like Radix Dialog) can intercept click events before
  // they reach the button. Using pointerdown + mousedown provides reliable
  // event capture that bypasses focus trap interference.
  // ❌ WRONG: Using only click events (get intercepted by modal focus trap)
  // ✅ CORRECT: Using pointerdown/mousedown which fire before focus trap logic
  // ════════════════════════════════════════════════════════════════════════
  React.useEffect(() => {
    console.log('[WritingChecker] DetailTooltip useEffect running');
    const applyBtn = applyFixRef.current;
    const ignoreBtn = ignoreRef.current;
    const addToDictBtn = addToDictRef.current;
    console.log('[WritingChecker] Refs:', { applyBtn: !!applyBtn, ignoreBtn: !!ignoreBtn, addToDictBtn: !!addToDictBtn });

    // Use pointerdown as primary (fires before click, bypasses focus traps)
    // with mousedown as fallback for older browsers
    const handleApplyPointerDown = (e: PointerEvent | MouseEvent) => {
      console.log('[WritingChecker] Apply Fix pointerdown/mousedown');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onFix();
    };

    const handleIgnorePointerDown = (e: PointerEvent | MouseEvent) => {
      console.log('[WritingChecker] Ignore pointerdown/mousedown');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onDismiss();
    };

    const handleAddToDictPointerDown = (e: PointerEvent | MouseEvent) => {
      console.log('[WritingChecker] Add to Dictionary pointerdown/mousedown');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onAddToDictionary?.();
    };

    const handleClosePointerDown = (e: PointerEvent | MouseEvent) => {
      console.log('[WritingChecker] Close pointerdown/mousedown');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onClose();
    };

    if (applyBtn) {
      console.log('[WritingChecker] Adding pointerdown listener to Apply Fix button');
      applyBtn.addEventListener('pointerdown', handleApplyPointerDown, { capture: true });
      applyBtn.addEventListener('mousedown', handleApplyPointerDown, { capture: true });
    }
    if (ignoreBtn) {
      ignoreBtn.addEventListener('pointerdown', handleIgnorePointerDown, { capture: true });
      ignoreBtn.addEventListener('mousedown', handleIgnorePointerDown, { capture: true });
    }
    if (addToDictBtn) {
      addToDictBtn.addEventListener('pointerdown', handleAddToDictPointerDown, { capture: true });
      addToDictBtn.addEventListener('mousedown', handleAddToDictPointerDown, { capture: true });
    }
    const closeBtn = closeRef.current;
    if (closeBtn) {
      closeBtn.addEventListener('pointerdown', handleClosePointerDown, { capture: true });
      closeBtn.addEventListener('mousedown', handleClosePointerDown, { capture: true });
    }

    return () => {
      applyBtn?.removeEventListener('pointerdown', handleApplyPointerDown, { capture: true });
      applyBtn?.removeEventListener('mousedown', handleApplyPointerDown, { capture: true });
      ignoreBtn?.removeEventListener('pointerdown', handleIgnorePointerDown, { capture: true });
      ignoreBtn?.removeEventListener('mousedown', handleIgnorePointerDown, { capture: true });
      addToDictBtn?.removeEventListener('pointerdown', handleAddToDictPointerDown, { capture: true });
      addToDictBtn?.removeEventListener('mousedown', handleAddToDictPointerDown, { capture: true });
      closeBtn?.removeEventListener('pointerdown', handleClosePointerDown, { capture: true });
      closeBtn?.removeEventListener('mousedown', handleClosePointerDown, { capture: true });
    };
  }, [onFix, onDismiss, onAddToDictionary, onClose]);

  return (
    <div
      className="bg-popover text-popover-foreground shadow-xl rounded-lg border overflow-hidden w-80 animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 ${config.bg} border-b ${config.border}`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wide ${config.color}`}>
            {config.label}
          </span>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
          onPointerDown={(e) => {
            console.log('[WritingChecker] Close React onPointerDown');
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          onClick={(e) => {
            console.log('[WritingChecker] Close React onClick');
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
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

      {/* Action buttons - using both React handlers AND native listeners for maximum compatibility */}
      <div className="flex items-stretch border-t divide-x">
        <button
          ref={applyFixRef}
          type="button"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary/5 hover:bg-primary/10 text-primary transition-colors cursor-pointer"
          onPointerDown={(e) => {
            console.log('[WritingChecker] Apply Fix React onPointerDown');
            e.preventDefault();
            e.stopPropagation();
            onFix();
          }}
          onClick={(e) => {
            console.log('[WritingChecker] Apply Fix React onClick');
            e.preventDefault();
            e.stopPropagation();
            onFix();
          }}
        >
          <Check className="h-4 w-4" />
          Apply Fix
        </button>
        {issue.type === "spelling" && onAddToDictionary && (
          <button
            ref={addToDictRef}
            type="button"
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer border-l"
            title="Add to Dictionary"
            onPointerDown={(e) => {
              console.log('[WritingChecker] Add to Dict React onPointerDown');
              e.preventDefault();
              e.stopPropagation();
              onAddToDictionary();
            }}
            onClick={(e) => {
              console.log('[WritingChecker] Add to Dict React onClick');
              e.preventDefault();
              e.stopPropagation();
              onAddToDictionary();
            }}
          >
            <BookPlus className="h-4 w-4" />
            <span className="text-xs">Dictionary</span>
          </button>
        )}
        <button
          ref={ignoreRef}
          type="button"
          className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          onPointerDown={(e) => {
            console.log('[WritingChecker] Ignore React onPointerDown');
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
          onClick={(e) => {
            console.log('[WritingChecker] Ignore React onClick');
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
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
      documentPointerHandler: null as ((e: PointerEvent | MouseEvent) => void) | null,
    };
  },

  addProseMirrorPlugins() {
    console.log('[WritingChecker] Extension loading, enabled:', this.options.enabled);
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
                  hoverContainer.setAttribute('data-writing-checker-tooltip', 'true');
                  hoverContainer.style.position = "fixed";
                  hoverContainer.style.zIndex = "9999";
                  // Add padding around the tooltip so mouse doesn't leave accidentally
                  hoverContainer.style.padding = "8px";
                  hoverContainer.style.margin = "-8px";
                  // Append to dialog content if inside a dialog, otherwise document.body
                  const dialogContent = view.dom.closest('[role="dialog"]');
                  if (dialogContent) {
                    dialogContent.appendChild(hoverContainer);
                  } else {
                    document.body.appendChild(hoverContainer);
                  }

                  const coords = view.coordsAtPos(hoveredIssue.from);
                  positionTooltip(hoverContainer, coords, 280, 80);

                  extension.storage.hoverContainer = hoverContainer;
                  extension.storage.hoverRoot = createRoot(hoverContainer);

                  // Track when mouse leaves the hover container
                  hoverContainer.addEventListener("mouseleave", () => {
                    // Small delay before cleanup in case user is moving back
                    setTimeout(() => {
                      if (!hoverContainer.matches(":hover")) {
                        cleanupHover();
                      }
                    }, 150);
                  });

                  const handleFix = () => {
                    console.log('[WritingChecker] HoverTooltip handleFix called');

                    // Cleanup hover FIRST
                    cleanupHover();

                    // Use setTimeout to escape event handling context
                    setTimeout(() => {
                      try {
                        console.log('[WritingChecker] HoverTooltip applying fix');

                        // Get fresh state and create transaction
                        const tr = view.state.tr;
                        tr.delete(hoveredIssue.from, hoveredIssue.to);
                        tr.insertText(hoveredIssue.suggestion, hoveredIssue.from);

                        // Clear decorations
                        tr.setMeta(writingCheckerKey, {
                          decorations: DecorationSet.empty,
                          issues: [],
                          isChecking: false,
                        });

                        // Dispatch the transaction
                        view.dispatch(tr);
                        console.log('[WritingChecker] HoverTooltip transaction dispatched');

                        // Clear last checked text to force re-check
                        extension.storage.lastCheckedText = "";
                        view.focus();
                      } catch (error) {
                        console.error('[WritingChecker] HoverTooltip handleFix error:', error);
                      }
                    }, 10);
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
                // Delay cleanup to allow moving to hover tooltip (500ms for slow mouse movements)
                setTimeout(() => {
                  // Check multiple times if tooltip is being hovered
                  const checkHover = () => {
                    const container = extension.storage.hoverContainer;
                    if (!container) return;

                    // Check if mouse is over the container or any of its children
                    const isHovered = container.matches(":hover") ||
                      container.querySelector(":hover") !== null;

                    if (!isHovered) {
                      cleanupHover();
                    }
                  };
                  checkHover();
                }, 300);
              }

              return false;
            },
          },

          // Handle click for detail view
          handleClick(view, pos, event) {
            console.log('[WritingChecker] handleClick', { pos });
            const state = this.getState(view.state);
            console.log('[WritingChecker] state:', state ? `${state.issues.length} issues` : 'null');
            if (!state) return false;

            const clickedIssue = state.issues.find(
              (issue) => pos >= issue.from && pos <= issue.to
            );
            console.log('[WritingChecker] clickedIssue:', clickedIssue ? clickedIssue.original : 'none');

            if (clickedIssue) {
              cleanupHover();
              showDetailTooltip(view, clickedIssue);
              return true;
            }

            return false;
          },
        },

        view(editorView) {
          // ⚠️ DO NOT REMOVE - Window-level capture prevents Radix Dialog from blocking tooltip events
          // ════════════════════════════════════════════════════════════════════════
          // Why: Radix Dialog adds document-level capture listeners that intercept
          // pointer events before they reach our tooltip buttons. By using window-level
          // capture (higher than document), we intercept clicks on tooltip buttons,
          // stop the event from reaching Radix, then manually trigger the button click.
          // ════════════════════════════════════════════════════════════════════════
          const handleWindowPointerCapture = (e: PointerEvent | MouseEvent) => {
            const target = e.target as HTMLElement;
            // Check if click is within a writing-checker tooltip
            const tooltipEl = target.closest('[data-writing-checker-tooltip]');
            if (tooltipEl) {
              console.log('[WritingChecker] Window capture - tooltip click detected, target:', target.tagName, target.className);

              // Check if the click is on a button or interactive element
              const button = target.closest('button');
              if (button) {
                console.log('[WritingChecker] Window capture - clicking button:', button.textContent?.trim());
                // Stop event from reaching Radix's document-level listeners
                e.stopPropagation();
                e.preventDefault();

                // Dispatch proper mouse events that React can handle
                // React uses mousedown + mouseup + click sequence
                setTimeout(() => {
                  console.log('[WritingChecker] Dispatching synthetic events to button');
                  const rect = button.getBoundingClientRect();
                  const x = rect.left + rect.width / 2;
                  const y = rect.top + rect.height / 2;

                  // Dispatch pointerdown first (React listens for this)
                  const pointerdown = new PointerEvent('pointerdown', {
                    bubbles: true, cancelable: true, view: window,
                    clientX: x, clientY: y, button: 0, pointerType: 'mouse'
                  });
                  button.dispatchEvent(pointerdown);

                  // Then mousedown
                  const mousedown = new MouseEvent('mousedown', {
                    bubbles: true, cancelable: true, view: window,
                    clientX: x, clientY: y, button: 0
                  });
                  button.dispatchEvent(mousedown);

                  // Then mouseup
                  const mouseup = new MouseEvent('mouseup', {
                    bubbles: true, cancelable: true, view: window,
                    clientX: x, clientY: y, button: 0
                  });
                  button.dispatchEvent(mouseup);

                  // Finally click
                  const click = new MouseEvent('click', {
                    bubbles: true, cancelable: true, view: window,
                    clientX: x, clientY: y, button: 0
                  });
                  button.dispatchEvent(click);
                }, 0);
              }
            }
          };

          // Use window level to capture before document-level listeners
          window.addEventListener('pointerdown', handleWindowPointerCapture, { capture: true });
          window.addEventListener('mousedown', handleWindowPointerCapture, { capture: true });

          // Store for cleanup
          extension.storage.documentPointerHandler = handleWindowPointerCapture;

          // Show detail tooltip function (shared between hover and click)
          const showDetailTooltipFn = (
            view: typeof editorView,
            issue: WritingIssue
          ) => {
            console.log('[WritingChecker] showDetailTooltip called for:', issue.original);
            cleanupTooltip();
            extension.storage.isTooltipOpen = true;

            const tooltipContainer = document.createElement("div");
            tooltipContainer.setAttribute('data-writing-checker-tooltip', 'true');
            tooltipContainer.style.position = "fixed";
            tooltipContainer.style.zIndex = "9999";
            // Find the dialog content element (has role="dialog") and append tooltip there
            // This ensures Radix treats tooltip clicks as "inside" the dialog
            const dialogContent = view.dom.closest('[role="dialog"]');
            console.log('[WritingChecker] Dialog content found:', !!dialogContent);
            if (dialogContent) {
              dialogContent.appendChild(tooltipContainer);
              console.log('[WritingChecker] Tooltip appended to dialog content');
            } else {
              document.body.appendChild(tooltipContainer);
              console.log('[WritingChecker] Tooltip appended to body (no dialog)');
            }

            const coords = view.coordsAtPos(issue.from);
            positionTooltip(tooltipContainer, coords, 320, 200);

            extension.storage.tooltipContainer = tooltipContainer;
            extension.storage.tooltipRoot = createRoot(tooltipContainer);

            const handleFix = () => {
              console.log('[WritingChecker] handleFix called', {
                original: issue.original,
                suggestion: issue.suggestion,
                from: issue.from,
                to: issue.to,
                docLength: view.state.doc.content.size,
              });

              // Cleanup tooltip FIRST to prevent any interference
              cleanupTooltip();

              // Use setTimeout to ensure we're outside any event handling context
              setTimeout(() => {
                try {
                  console.log('[WritingChecker] Applying fix in setTimeout');
                  const textBefore = view.state.doc.textContent;
                  console.log('[WritingChecker] Full text before:', textBefore);

                  // Try to get TipTap editor instance from the view's DOM
                  const editorElement = view.dom.closest('.ProseMirror')?.parentElement;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const tiptapEditor = (editorElement as any)?.editor;

                  if (tiptapEditor && typeof tiptapEditor.chain === 'function') {
                    // Use TipTap's chain commands for proper state updates
                    console.log('[WritingChecker] Using TipTap editor commands');
                    tiptapEditor
                      .chain()
                      .focus()
                      .setTextSelection({ from: issue.from, to: issue.to })
                      .deleteSelection()
                      .insertContent(issue.suggestion)
                      .run();
                    console.log('[WritingChecker] TipTap commands executed');
                  } else {
                    // Fallback to direct ProseMirror manipulation
                    console.log('[WritingChecker] Falling back to ProseMirror');
                    const tr = view.state.tr;
                    tr.delete(issue.from, issue.to);
                    tr.insertText(issue.suggestion, issue.from);

                    // Clear decorations
                    tr.setMeta(writingCheckerKey, {
                      decorations: DecorationSet.empty,
                      issues: [],
                      isChecking: false,
                    });

                    view.dispatch(tr);
                    console.log('[WritingChecker] ProseMirror transaction dispatched');
                  }

                  // Log result
                  const textAfter = view.state.doc.textContent;
                  console.log('[WritingChecker] Full text after:', textAfter);
                  console.log('[WritingChecker] Text changed:', textBefore !== textAfter);

                  // Clear decorations via separate transaction
                  const clearTr = view.state.tr.setMeta(writingCheckerKey, {
                    decorations: DecorationSet.empty,
                    issues: [],
                    isChecking: false,
                  });
                  view.dispatch(clearTr);

                  // Clear last checked text to force re-check
                  extension.storage.lastCheckedText = "";

                  // Focus the editor
                  view.focus();
                } catch (error) {
                  console.error('[WritingChecker] handleFix error:', error);
                }
              }, 10);
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

            const handleAddToDictionary = async () => {
              console.log('[WritingChecker] Adding to dictionary:', issue.original);
              try {
                const response = await api.post<{
                  success: boolean;
                  data?: { word: string };
                  error?: string;
                }>("/api/v1/user_dictionary", { word: issue.original });

                if (response?.success) {
                  // Remove this issue and any others with the same word
                  const currentState = writingCheckerKey.getState(view.state);
                  if (currentState) {
                    const wordLower = issue.original.toLowerCase();
                    const newIssues = currentState.issues.filter(
                      (i) => i.original.toLowerCase() !== wordLower
                    );
                    const decorations = createDecorations(view.state.doc, newIssues);
                    const tr = view.state.tr.setMeta(writingCheckerKey, {
                      decorations,
                      issues: newIssues,
                    });
                    view.dispatch(tr);
                  }
                  // Force re-check on next text change
                  extension.storage.lastCheckedText = "";
                  cleanupTooltip();
                  view.focus();
                }
              } catch (error) {
                console.error('[WritingChecker] Error adding to dictionary:', error);
              }
            };

            extension.storage.tooltipRoot.render(
              <DetailTooltip
                issue={issue}
                onFix={handleFix}
                onDismiss={handleDismiss}
                onClose={handleClose}
                onAddToDictionary={issue.type === "spelling" ? handleAddToDictionary : undefined}
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
          console.log('[WritingChecker] Set __showDetailTooltip on window');

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
                  data?: WritingCheckResult;
                  error?: string;
                }>("/api/v1/writing_assistant/check", {
                  text,
                  context: extension.options.context,
                });

                console.log('[WritingChecker] API response:', response);

                // Check for API error
                if (!response?.success) {
                  console.error('[WritingChecker] API error:', response?.error || 'Unknown error');
                  const tr = editorView.state.tr.setMeta(writingCheckerKey, {
                    isChecking: false,
                  });
                  editorView.dispatch(tr);
                  return;
                }

                if (response?.data) {
                  console.log('[WritingChecker] API returned', response.data.issues.length, 'issues from API');
                  const issues = findIssuePositions(
                    editorView.state.doc,
                    response.data.issues,
                    extension.storage.dismissedIssues
                  );
                  console.log('[WritingChecker] After findIssuePositions:', issues.length, 'issues with positions');
                  issues.forEach(i => console.log('[WritingChecker] Issue:', i.original, 'at', i.from, '-', i.to));

                  const decorations = createDecorations(
                    editorView.state.doc,
                    issues
                  );
                  console.log('[WritingChecker] Created decorations, count:', decorations.find().length);

                  const tr = editorView.state.tr.setMeta(writingCheckerKey, {
                    decorations,
                    issues,
                    isChecking: false,
                    correctedText: response.data.corrected_text,
                  });
                  editorView.dispatch(tr);
                  console.log('[WritingChecker] Dispatched transaction with decorations');

                  extension.options.onIssuesChange?.(issues);
                }
              } catch (error) {
                console.error("[WritingChecker] API call failed:", error);
                const tr = editorView.state.tr.setMeta(writingCheckerKey, {
                  isChecking: false,
                });
                editorView.dispatch(tr);
              }
            }, extension.options.debounceMs);
          };

          // Trigger initial check when editor loads with content
          console.log('[WritingChecker] Triggering initial check');
          scheduleCheck();

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
              // Remove window-level capture listeners
              if (extension.storage.documentPointerHandler) {
                window.removeEventListener('pointerdown', extension.storage.documentPointerHandler, { capture: true });
                window.removeEventListener('mousedown', extension.storage.documentPointerHandler, { capture: true });
                extension.storage.documentPointerHandler = null;
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
      console.log('[WritingChecker] showDetailTooltip wrapper called');
      const fn = (window as unknown as { __showDetailTooltip?: (view: unknown, issue: WritingIssue) => void }).__showDetailTooltip;
      console.log('[WritingChecker] __showDetailTooltip exists:', !!fn);
      if (fn) {
        fn(view, issue);
      } else {
        console.error('[WritingChecker] __showDetailTooltip not set!');
      }
    }
  },
});

// Convert text content index to actual ProseMirror document position
// ProseMirror positions include node boundaries, so we need to traverse the doc
function textIndexToDocPos(doc: ProseMirrorNode, textIndex: number): number {
  let currentTextIndex = 0;
  let resultPos = -1;

  doc.descendants((node, pos) => {
    if (resultPos !== -1) return false; // Already found

    if (node.isText && node.text) {
      const nodeTextLength = node.text.length;
      if (currentTextIndex + nodeTextLength > textIndex) {
        // Found the node containing our target index
        const offsetInNode = textIndex - currentTextIndex;
        resultPos = pos + offsetInNode;
        return false;
      }
      currentTextIndex += nodeTextLength;
    }
    return true;
  });

  return resultPos;
}

// Recalculate positions for issues after document changes
// This finds the original text in the new document and updates positions
function recalculateIssuePositions(
  doc: ProseMirrorNode,
  issues: WritingIssue[]
): WritingIssue[] {
  const text = doc.textContent;
  const result: WritingIssue[] = [];

  for (const issue of issues) {
    // Find the issue's original text in the new document
    const index = text.indexOf(issue.original);
    if (index === -1) continue; // Text no longer exists

    const from = textIndexToDocPos(doc, index);
    if (from === -1) continue;
    const to = from + issue.original.length;

    result.push({
      ...issue,
      from,
      to,
    });
  }

  return result;
}

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

      // Convert text index to document position
      const from = textIndexToDocPos(doc, index);
      if (from === -1) {
        searchPos = index + 1;
        continue;
      }
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
