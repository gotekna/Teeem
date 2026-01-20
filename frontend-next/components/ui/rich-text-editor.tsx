"use client";

import * as React from "react";
import { useEditor, EditorContent, Editor, Extension } from "@tiptap/react";

// Re-export Editor type for external use
export type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  Undo,
  Redo,
  ImageIcon,
  SpellCheck,
  Loader2,
  ListTodo,
  ChevronDown,
  Table2,
  Minus,
  Pen,
  Highlighter,
  Eraser,
  MousePointer2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Type,
  Check,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { WritingChecker, useWritingCheckerState, WritingIssue } from "./tiptap-writing-checker";

// Custom extension for font size
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) =>
              element.style.fontSize.replace(/['"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});

// Export FontSize extension creator for use in other TipTap editors
// Note: Each editor needs its own extension instance, so we export the creator
export const createFontSizeExtension = () => Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.fontSize.replace(/['"]+/g, ""),
            renderHTML: (attributes: { fontSize?: string }) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: { chain: () => any }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => any }) => {
          return chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});

// Slash command types
export type SlashCommand = "template";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  /**
   * Called when a slash command is triggered (e.g., /template or /t)
   * The editor will delete the slash command text when this is called.
   */
  onSlashCommand?: (command: SlashCommand) => void;
  /**
   * Enable spell/grammar/tone checking with inline underlines
   */
  enableWritingChecker?: boolean;
  /**
   * Context for writing checker (helps AI understand what type of content)
   */
  writingContext?: "email_body" | "notes" | "general";
  /**
   * Called when the editor receives focus
   */
  onFocus?: () => void;
  /**
   * Called when the editor loses focus
   */
  onBlur?: () => void;
  /**
   * Hide the toolbar (useful when toolbar is rendered externally)
   */
  hideToolbar?: boolean;
  /**
   * Callback to expose the editor instance externally
   */
  onEditorReady?: (editor: Editor | null) => void;
}

// Slash command extension - detects /template or /t and triggers callback
const createSlashCommandExtension = (onSlashCommand?: (command: SlashCommand) => void) => {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("slashCommand"),
          props: {
            handleTextInput(view, from, to, text) {
              if (!onSlashCommand) return false;

              // Get the text before the cursor including the new character
              const { state } = view;
              const $from = state.doc.resolve(from);
              const textBefore = $from.parent.textContent.slice(0, $from.parentOffset) + text;

              // Check for /template or /t followed by space
              const templateMatch = textBefore.match(/\/template\s$/);
              const shortTemplateMatch = textBefore.match(/\/t\s$/);

              if (templateMatch || shortTemplateMatch) {
                // Delete the slash command text
                const matchLength = templateMatch ? 10 : 3; // "/template " or "/t "
                const deleteFrom = from - (matchLength - 1); // -1 because 'text' hasn't been inserted yet

                // Use setTimeout to let the text be inserted first, then delete
                setTimeout(() => {
                  const tr = view.state.tr.delete(deleteFrom, from + 1);
                  view.dispatch(tr);
                  onSlashCommand("template");
                }, 0);

                return false; // Let the space be inserted, then we'll delete it
              }

              return false;
            },
          },
        }),
      ];
    },
  });
};

// Module-level variable to track the last focused editor
// This is updated by editors when they gain focus, and used by the toolbar
// to ensure commands are sent to the correct editor even during React re-renders
let lastFocusedEditor: Editor | null = null;

// Subscribers that want to be notified when focused editor changes
const focusedEditorSubscribers: Set<() => void> = new Set();

// Export function for editors to register themselves when focused
export function registerFocusedEditor(editor: Editor | null) {
  lastFocusedEditor = editor;
  // Notify all subscribers that the focused editor changed
  focusedEditorSubscribers.forEach(callback => callback());
}

// Subscribe to focused editor changes (returns unsubscribe function)
function subscribeFocusedEditorChange(callback: () => void): () => void {
  focusedEditorSubscribers.add(callback);
  return () => {
    focusedEditorSubscribers.delete(callback);
  };
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-7 w-7 p-0",
        isActive && "bg-muted text-foreground"
      )}
    >
      {children}
    </Button>
  );
}

// Toolbar tab type
type ToolbarTab = "home" | "insert" | "draw";

// Ribbon group component - groups related tools with a label
function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-3 border-r border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-0.5 py-1.5">
        {children}
      </div>
      <span className="text-[10px] text-muted-foreground/60 pb-1">{label}</span>
    </div>
  );
}

// Exported for external use (e.g., notebook editor header toolbar)
export function EditorToolbar({
  editor,
  showWritingChecker,
  transparent,
  onExternalImageUpload,
  onExternalUndo,
  onExternalRedo,
  canExternalUndo,
  canExternalRedo,
  onDrawModeChange,
  drawMode,
  drawColor,
  onDrawColorChange,
  drawSize,
  onDrawSizeChange,
  rightContent,
}: {
  editor: Editor | null;
  showWritingChecker?: boolean;
  transparent?: boolean;
  /** Called when image is uploaded but no editor is focused - for inserting as positioned element */
  onExternalImageUpload?: (base64: string) => void;
  /** Called when undo is clicked and no editor is focused - for undoing positioned box changes */
  onExternalUndo?: () => void;
  /** Called when redo is clicked and no editor is focused - for redoing positioned box changes */
  onExternalRedo?: () => void;
  /** Whether external undo is available */
  canExternalUndo?: boolean;
  /** Whether external redo is available */
  canExternalRedo?: boolean;
  /** Called when draw mode changes */
  onDrawModeChange?: (mode: "select" | "pen" | "highlighter" | "eraser" | null) => void;
  /** Current draw mode */
  drawMode?: "select" | "pen" | "highlighter" | "eraser" | null;
  /** Current draw color */
  drawColor?: string;
  /** Called when draw color changes */
  onDrawColorChange?: (color: string) => void;
  /** Current draw size */
  drawSize?: number;
  /** Called when draw size changes */
  onDrawSizeChange?: (size: number) => void;
  /** Content to render on the right side of the tab bar */
  rightContent?: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = React.useState<ToolbarTab>("home");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [fontSizeInput, setFontSizeInput] = React.useState("");
  const [fontSizeOpen, setFontSizeOpen] = React.useState(false);
  const [selectedTextColor, setSelectedTextColor] = React.useState("#000000");
  const [selectedHighlightColor, setSelectedHighlightColor] = React.useState("#fef08a");
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const { issues, isChecking } = useWritingCheckerState(editor);

  // Track focused editor in React state for dependency arrays and re-renders
  const [trackedEditor, setTrackedEditor] = React.useState<Editor | null>(null);
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  // Subscribe to focused editor changes
  React.useEffect(() => {
    const handleFocusChange = () => {
      setTrackedEditor(lastFocusedEditor);
      forceUpdate();
    };
    return subscribeFocusedEditorChange(handleFocusChange);
  }, []);

  // Re-render when trackedEditor's selection changes (for Styles dropdown)
  React.useEffect(() => {
    if (!trackedEditor) return;

    const handleSelectionUpdate = () => forceUpdate();
    trackedEditor.on("selectionUpdate", handleSelectionUpdate);
    trackedEditor.on("transaction", handleSelectionUpdate);

    return () => {
      trackedEditor.off("selectionUpdate", handleSelectionUpdate);
      trackedEditor.off("transaction", handleSelectionUpdate);
    };
  }, [trackedEditor]);

  // Helper to get the target editor - uses last focused editor if available
  const getTargetEditor = () => lastFocusedEditor || editor;

  // Prevent focus from shifting when clicking toolbar
  const handleToolbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Check if editor view is available (prevents errors during mount/unmount)
  const isEditorReady = editor?.view && !editor?.isDestroyed;

  // Safe wrapper for isActive to prevent errors during mount/unmount
  const safeIsActive = (name: string) => {
    if (!isEditorReady) return false;
    try {
      return editor.isActive(name);
    } catch {
      return false;
    }
  };

  // Get current font size from selection
  const getCurrentFontSize = () => {
    const targetEditor = getTargetEditor();
    if (!targetEditor?.view || targetEditor.isDestroyed) return "";
    try {
      const attrs = targetEditor.getAttributes("textStyle");
      return attrs.fontSize ? attrs.fontSize.replace("px", "") : "11";
    } catch {
      return "";
    }
  };

  const applyFontSize = (size: string) => {
    const numericSize = size.replace(/[^0-9]/g, "");
    if (numericSize && parseInt(numericSize) > 0) {
      getTargetEditor()?.chain().focus().setFontSize(`${numericSize}px`).run();
    }
    setFontSizeInput("");
    setFontSizeOpen(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const targetEditor = getTargetEditor();
      if ((!targetEditor || !targetEditor.isFocused) && onExternalImageUpload) {
        onExternalImageUpload(base64);
      } else {
        targetEditor?.chain().focus().setImage({ src: base64 }).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSetLink = () => {
    if (linkUrl) {
      const url = linkUrl.match(/^https?:\/\//) ? linkUrl : `https://${linkUrl}`;
      getTargetEditor()?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkUrl("");
    setLinkOpen(false);
  };

  const handleInsertTable = () => {
    getTargetEditor()?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const fontSizes = ["8", "9", "10", "11", "12", "14", "16", "18", "20", "24", "28", "36", "48", "72"];
  const drawColors = ["#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

  return (
    <div
      className={cn("flex flex-col select-none", !transparent && "bg-muted/10")}
      onMouseDown={handleToolbarMouseDown}
    >
      {/* Tab bar */}
      <div className="flex items-center bg-muted/30">
        {/* Undo/Redo - always visible on left */}
        <div className="flex items-center gap-0.5 px-2">
          <ToolbarButton
            onClick={() => {
              const targetEditor = getTargetEditor();
              if (targetEditor?.isFocused && targetEditor.can().undo()) {
                targetEditor.chain().focus().undo().run();
              } else if (onExternalUndo) {
                onExternalUndo();
              }
            }}
            disabled={!(isEditorReady && editor?.can().undo()) && !canExternalUndo}
            title="Undo (Cmd+Z)"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              const targetEditor = getTargetEditor();
              if (targetEditor?.isFocused && targetEditor.can().redo()) {
                targetEditor.chain().focus().redo().run();
              } else if (onExternalRedo) {
                onExternalRedo();
              }
            }}
            disabled={!(isEditorReady && editor?.can().redo()) && !canExternalRedo}
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center ml-2">
          {(["home", "insert", "draw"] as ToolbarTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              onMouseDown={(e) => e.preventDefault()}
              className={cn(
                "px-4 py-1.5 text-xs font-medium capitalize transition-colors rounded-t-md",
                activeTab === tab
                  ? "text-foreground bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Writing checker status */}
        {showWritingChecker && (
          <div className="flex items-center gap-1 px-3">
            {isChecking ? (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Checking...</span>
              </div>
            ) : issues.length > 0 ? (
              <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <SpellCheck className="h-4 w-4" />
                <span className="text-xs font-medium">{issues.length}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <SpellCheck className="h-4 w-4" />
              </div>
            )}
          </div>
        )}

        {/* Right side content (save status, attachments, etc.) */}
        {rightContent && (
          <div className="flex items-center gap-2 px-3">
            {rightContent}
          </div>
        )}
      </div>

      {/* Ribbon content */}
      <div className="flex items-stretch bg-background border-b border-border/40 min-h-[54px]">
        {/* HOME TAB */}
        {activeTab === "home" && (
          <>
            {/* Clipboard group */}
            <RibbonGroup label="Clipboard">
              <ToolbarButton
                onClick={() => document.execCommand("paste")}
                disabled={!isEditorReady}
                title="Paste"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </ToolbarButton>
              <ToolbarButton
                onClick={() => document.execCommand("copy")}
                disabled={!isEditorReady}
                title="Copy"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </ToolbarButton>
            </RibbonGroup>

            {/* Font group */}
            <RibbonGroup label="Font">
              {/* Font size dropdown */}
              <Popover open={fontSizeOpen} onOpenChange={setFontSizeOpen}>
                <div className={cn("flex items-center h-7", !isEditorReady && "opacity-50")}>
                  <input
                    type="text"
                    value={fontSizeInput || getCurrentFontSize()}
                    onChange={(e) => setFontSizeInput(e.target.value)}
                    disabled={!isEditorReady}
                    onFocus={(e) => {
                      e.target.select();
                      setFontSizeInput(getCurrentFontSize());
                    }}
                    onBlur={() => fontSizeInput && applyFontSize(fontSizeInput)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyFontSize(fontSizeInput || getCurrentFontSize());
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-7 h-full text-center text-xs bg-transparent outline-none"
                    placeholder="--"
                  />
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={!isEditorReady}
                      className="h-full px-0.5 hover:bg-muted/50 rounded"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                </div>
                <PopoverContent className="w-16 p-1" align="start">
                  <div className="max-h-48 overflow-auto">
                    {fontSizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => applyFontSize(size)}
                        onMouseDown={(e) => e.preventDefault()}
                        className={cn(
                          "w-full text-left px-2 py-1 text-sm rounded hover:bg-muted",
                          getCurrentFontSize() === size && "bg-muted font-medium"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <ToolbarButton
                onClick={() => getTargetEditor()?.chain().focus().toggleBold().run()}
                isActive={safeIsActive("bold")}
                disabled={!isEditorReady}
                title="Bold (Cmd+B)"
              >
                <Bold className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => getTargetEditor()?.chain().focus().toggleItalic().run()}
                isActive={safeIsActive("italic")}
                disabled={!isEditorReady}
                title="Italic (Cmd+I)"
              >
                <Italic className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => getTargetEditor()?.chain().focus().toggleUnderline().run()}
                isActive={safeIsActive("underline")}
                disabled={!isEditorReady}
                title="Underline (Cmd+U)"
              >
                <UnderlineIcon className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => getTargetEditor()?.chain().focus().toggleStrike().run()}
                isActive={safeIsActive("strike")}
                disabled={!isEditorReady}
                title="Strikethrough"
              >
                <Strikethrough className="h-4 w-4" />
              </ToolbarButton>

              {/* Text color */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Text color">
                    <div className="flex flex-col items-center">
                      <Type className="h-3.5 w-3.5" />
                      <div className="w-4 h-0.5 mt-0.5 rounded-sm" style={{ backgroundColor: selectedTextColor }} />
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">Theme Colors</p>
                    <div className="grid grid-cols-10 gap-1">
                      {/* Row 1: Base colors */}
                      {["#000000", "#424242", "#666666", "#808080", "#999999", "#b3b3b3", "#cccccc", "#e0e0e0", "#f0f0f0", "#ffffff"].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            getTargetEditor()?.chain().focus().setColor(color).run();
                            setSelectedTextColor(color);
                          }}
                          className="w-5 h-5 rounded-sm border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                      {/* Row 2-6: Color spectrum with intensities */}
                      {[
                        ["#7f1d1d", "#991b1b", "#b91c1c", "#dc2626", "#ef4444", "#f87171", "#fca5a5", "#fecaca", "#fee2e2", "#fef2f2"], // Red
                        ["#7c2d12", "#9a3412", "#c2410c", "#ea580c", "#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5", "#fff7ed"], // Orange
                        ["#713f12", "#854d0e", "#a16207", "#ca8a04", "#eab308", "#facc15", "#fde047", "#fef08a", "#fef9c3", "#fefce8"], // Yellow
                        ["#14532d", "#166534", "#15803d", "#16a34a", "#22c55e", "#4ade80", "#86efac", "#bbf7d0", "#dcfce7", "#f0fdf4"], // Green
                        ["#1e3a8a", "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe", "#eff6ff"], // Blue
                        ["#4c1d95", "#5b21b6", "#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe", "#f5f3ff"], // Purple
                        ["#831843", "#9d174d", "#be185d", "#db2777", "#ec4899", "#f472b6", "#f9a8d4", "#fbcfe8", "#fce7f3", "#fdf2f8"], // Pink
                      ].map((row, rowIdx) => (
                        row.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              getTargetEditor()?.chain().focus().setColor(color).run();
                              setSelectedTextColor(color);
                            }}
                            className="w-5 h-5 rounded-sm border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))
                      ))}
                    </div>
                    {/* Remove color option */}
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        getTargetEditor()?.chain().focus().unsetColor().run();
                        setSelectedTextColor("#000000");
                      }}
                      className="w-full mt-2 px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded flex items-center gap-1"
                    >
                      <span className="w-4 h-4 rounded-sm border bg-[repeating-conic-gradient(#ccc_0_25%,#fff_0_50%)] bg-[length:6px_6px]" />
                      Remove color
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Highlight color */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Highlight color">
                    <div className="flex flex-col items-center">
                      <Palette className="h-3.5 w-3.5" />
                      <div className="w-4 h-0.5 mt-0.5 rounded-sm" style={{ backgroundColor: selectedHighlightColor }} />
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">Highlight Colors</p>
                    <div className="grid grid-cols-6 gap-1">
                      {/* Light highlights (15% opacity feel) */}
                      {["#fef2f2", "#fff7ed", "#fefce8", "#f0fdf4", "#eff6ff", "#f5f3ff"].map((color) => (
                        <button
                          key={`light-${color}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            getTargetEditor()?.chain().focus().toggleHighlight({ color }).run();
                            setSelectedHighlightColor(color);
                          }}
                          className="w-6 h-6 rounded-sm border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          title="Light"
                        />
                      ))}
                      {/* Medium-light highlights (30% opacity feel) */}
                      {["#fee2e2", "#ffedd5", "#fef9c3", "#dcfce7", "#dbeafe", "#ede9fe"].map((color) => (
                        <button
                          key={`medlight-${color}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            getTargetEditor()?.chain().focus().toggleHighlight({ color }).run();
                            setSelectedHighlightColor(color);
                          }}
                          className="w-6 h-6 rounded-sm border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          title="Medium Light"
                        />
                      ))}
                      {/* Medium highlights (50% opacity feel) */}
                      {["#fecaca", "#fed7aa", "#fef08a", "#bbf7d0", "#bfdbfe", "#ddd6fe"].map((color) => (
                        <button
                          key={`med-${color}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            getTargetEditor()?.chain().focus().toggleHighlight({ color }).run();
                            setSelectedHighlightColor(color);
                          }}
                          className="w-6 h-6 rounded-sm border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          title="Medium"
                        />
                      ))}
                      {/* Strong highlights (70% opacity feel) */}
                      {["#fca5a5", "#fdba74", "#fde047", "#86efac", "#93c5fd", "#c4b5fd"].map((color) => (
                        <button
                          key={`strong-${color}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            getTargetEditor()?.chain().focus().toggleHighlight({ color }).run();
                            setSelectedHighlightColor(color);
                          }}
                          className="w-6 h-6 rounded-sm border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          title="Strong"
                        />
                      ))}
                      {/* Vivid highlights (full saturation) */}
                      {["#f87171", "#fb923c", "#facc15", "#4ade80", "#60a5fa", "#a78bfa"].map((color) => (
                        <button
                          key={`vivid-${color}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            getTargetEditor()?.chain().focus().toggleHighlight({ color }).run();
                            setSelectedHighlightColor(color);
                          }}
                          className="w-6 h-6 rounded-sm border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          title="Vivid"
                        />
                      ))}
                    </div>
                    {/* Additional colors: pink, gray, cyan */}
                    <div className="grid grid-cols-6 gap-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                      {["#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6", "#e5e5e5", "#d4d4d4"].map((color) => (
                        <button
                          key={`extra-${color}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            getTargetEditor()?.chain().focus().toggleHighlight({ color }).run();
                            setSelectedHighlightColor(color);
                          }}
                          className="w-6 h-6 rounded-sm border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    {/* Remove highlight option */}
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        getTargetEditor()?.chain().focus().unsetHighlight().run();
                        setSelectedHighlightColor("#fef08a");
                      }}
                      className="w-full mt-1 px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded flex items-center gap-1"
                    >
                      <span className="w-4 h-4 rounded-sm border bg-[repeating-conic-gradient(#ccc_0_25%,#fff_0_50%)] bg-[length:6px_6px]" />
                      Remove highlight
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </RibbonGroup>

            {/* Paragraph group */}
            <RibbonGroup label="Paragraph">
              <ToolbarButton
                onClick={() => getTargetEditor()?.chain().focus().toggleBulletList().run()}
                isActive={safeIsActive("bulletList")}
                disabled={!isEditorReady}
                title="Bullet list"
              >
                <List className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => getTargetEditor()?.chain().focus().toggleOrderedList().run()}
                isActive={safeIsActive("orderedList")}
                disabled={!isEditorReady}
                title="Numbered list"
              >
                <ListOrdered className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => getTargetEditor()?.chain().focus().toggleTaskList().run()}
                isActive={safeIsActive("taskList")}
                disabled={!isEditorReady}
                title="Checklist"
              >
                <ListTodo className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                onClick={() => getTargetEditor()?.chain().focus().setTextAlign("left").run()}
                isActive={getTargetEditor()?.isActive({ textAlign: "left" })}
                disabled={!isEditorReady}
                title="Align left"
              >
                <AlignLeft className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => getTargetEditor()?.chain().focus().setTextAlign("center").run()}
                isActive={getTargetEditor()?.isActive({ textAlign: "center" })}
                disabled={!isEditorReady}
                title="Center"
              >
                <AlignCenter className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => getTargetEditor()?.chain().focus().setTextAlign("right").run()}
                isActive={getTargetEditor()?.isActive({ textAlign: "right" })}
                disabled={!isEditorReady}
                title="Align right"
              >
                <AlignRight className="h-4 w-4" />
              </ToolbarButton>
            </RibbonGroup>

            {/* Styles group */}
            <RibbonGroup label="Styles">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 min-w-[90px]">
                    {(() => {
                      const targetEditor = getTargetEditor();
                      if (targetEditor?.isActive("heading", { level: 1 })) return "Heading 1";
                      if (targetEditor?.isActive("heading", { level: 2 })) return "Heading 2";
                      if (targetEditor?.isActive("heading", { level: 3 })) return "Heading 3";
                      if (targetEditor?.isActive("blockquote")) return "Quote";
                      return "Normal";
                    })()}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <DropdownMenuItem
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const targetEditor = getTargetEditor();
                      if (targetEditor && !targetEditor.isDestroyed) {
                        targetEditor.chain().focus().setParagraph().run();
                      }
                    }}
                  >
                    Normal
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="font-bold text-2xl"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const targetEditor = getTargetEditor();
                      if (targetEditor && !targetEditor.isDestroyed) {
                        targetEditor.chain().focus().toggleHeading({ level: 1 }).run();
                      }
                    }}
                  >
                    Heading 1
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="font-semibold text-xl"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const targetEditor = getTargetEditor();
                      if (targetEditor && !targetEditor.isDestroyed) {
                        targetEditor.chain().focus().toggleHeading({ level: 2 }).run();
                      }
                    }}
                  >
                    Heading 2
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="font-medium text-lg"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const targetEditor = getTargetEditor();
                      if (targetEditor && !targetEditor.isDestroyed) {
                        targetEditor.chain().focus().toggleHeading({ level: 3 }).run();
                      }
                    }}
                  >
                    Heading 3
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="italic border-l-2 border-muted-foreground pl-2"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const targetEditor = getTargetEditor();
                      if (targetEditor && !targetEditor.isDestroyed && targetEditor.can().toggleBlockquote()) {
                        targetEditor.chain().focus().toggleBlockquote().run();
                      }
                    }}
                  >
                    Quote
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </RibbonGroup>
          </>
        )}

        {/* INSERT TAB */}
        {activeTab === "insert" && (
          <>
            {/* Tables group */}
            <RibbonGroup label="Tables">
              <ToolbarButton
                onClick={handleInsertTable}
                disabled={!isEditorReady}
                title="Insert table"
              >
                <Table2 className="h-4 w-4" />
              </ToolbarButton>
            </RibbonGroup>

            {/* Media group */}
            <RibbonGroup label="Media">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <ToolbarButton
                onClick={() => imageInputRef.current?.click()}
                disabled={!isEditorReady && !onExternalImageUpload}
                title="Insert image"
              >
                <ImageIcon className="h-4 w-4" />
              </ToolbarButton>
            </RibbonGroup>

            {/* Links group */}
            <RibbonGroup label="Links">
              <Popover open={linkOpen} onOpenChange={setLinkOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Add link"
                    disabled={!isEditorReady}
                    onMouseDown={(e) => e.preventDefault()}
                    className={cn("h-7 w-7 p-0", safeIsActive("link") && "bg-muted")}
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSetLink())}
                      className="h-8 text-sm"
                    />
                    <Button size="sm" onClick={handleSetLink} className="h-8">Add</Button>
                  </div>
                </PopoverContent>
              </Popover>
              {safeIsActive("link") && (
                <ToolbarButton onClick={() => getTargetEditor()?.chain().focus().unsetLink().run()} title="Remove link">
                  <Unlink className="h-4 w-4" />
                </ToolbarButton>
              )}
            </RibbonGroup>

            {/* Other inserts */}
            <RibbonGroup label="Other">
              <ToolbarButton
                onClick={() => getTargetEditor()?.chain().focus().setHorizontalRule().run()}
                disabled={!isEditorReady}
                title="Horizontal line"
              >
                <Minus className="h-4 w-4" />
              </ToolbarButton>
            </RibbonGroup>
          </>
        )}

        {/* DRAW TAB */}
        {activeTab === "draw" && (
          <>
            {/* Tools group */}
            <RibbonGroup label="Tools">
              <ToolbarButton
                onClick={() => onDrawModeChange?.(drawMode === "select" ? null : "select")}
                isActive={drawMode === "select"}
                title="Select"
              >
                <MousePointer2 className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => onDrawModeChange?.(drawMode === "pen" ? null : "pen")}
                isActive={drawMode === "pen"}
                title="Pen"
              >
                <Pen className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => onDrawModeChange?.(drawMode === "highlighter" ? null : "highlighter")}
                isActive={drawMode === "highlighter"}
                title="Highlighter"
              >
                <Highlighter className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => onDrawModeChange?.(drawMode === "eraser" ? null : "eraser")}
                isActive={drawMode === "eraser"}
                title="Eraser"
              >
                <Eraser className="h-4 w-4" />
              </ToolbarButton>
            </RibbonGroup>

            {/* Pens group - preset pen styles */}
            <RibbonGroup label="Pens">
              {[
                { color: "#000000", size: 2 },
                { color: "#ef4444", size: 2 },
                { color: "#3b82f6", size: 2 },
                { color: "#22c55e", size: 4 },
                { color: "#eab308", size: 8, opacity: 0.4 },
              ].map((pen, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onDrawColorChange?.(pen.color);
                    onDrawSizeChange?.(pen.size);
                    onDrawModeChange?.("pen");
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className={cn(
                    "w-7 h-7 rounded-sm border flex items-center justify-center hover:bg-muted/50",
                    drawMode === "pen" && drawColor === pen.color && "ring-2 ring-primary"
                  )}
                  title={`Pen ${i + 1}`}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: Math.min(pen.size * 2, 12),
                      height: Math.min(pen.size * 2, 12),
                      backgroundColor: pen.color,
                      opacity: pen.opacity || 1,
                    }}
                  />
                </button>
              ))}
            </RibbonGroup>

            {/* Color & Size */}
            <RibbonGroup label="Color">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-7 w-7 rounded-sm border flex items-center justify-center hover:bg-muted/50"
                    title="Draw color"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div
                      className="w-4 h-4 rounded-sm border"
                      style={{ backgroundColor: drawColor || "#000000" }}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="grid grid-cols-8 gap-1">
                    {drawColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => onDrawColorChange?.(color)}
                        onMouseDown={(e) => e.preventDefault()}
                        className={cn(
                          "w-5 h-5 rounded-sm border hover:scale-110 transition-transform",
                          drawColor === color && "ring-2 ring-primary"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-7 px-2 rounded-sm border flex items-center gap-1 hover:bg-muted/50 text-xs"
                    title="Stroke size"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {drawSize || 2}px
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="flex flex-col gap-1">
                    {[1, 2, 4, 6, 8, 12].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => onDrawSizeChange?.(size)}
                        onMouseDown={(e) => e.preventDefault()}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded hover:bg-muted text-sm",
                          drawSize === size && "bg-muted"
                        )}
                      >
                        <div className="w-4 flex justify-center">
                          <div className="rounded-full bg-foreground" style={{ width: size, height: size }} />
                        </div>
                        {size}px
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </RibbonGroup>
          </>
        )}
      </div>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Type your message...",
  className,
  minHeight = 200,
  onSlashCommand,
  enableWritingChecker = false,
  writingContext = "email_body",
  onFocus,
  onBlur,
  hideToolbar = false,
  onEditorReady,
}: RichTextEditorProps) {
  // Memoize all extensions to prevent tiptap duplicate extension warnings
  const extensions = React.useMemo(
() => {
      const baseExtensions = [
        StarterKit.configure({
          // Enable headings for Styles dropdown
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Placeholder.configure({
          placeholder: onSlashCommand
            ? `${placeholder} (Type /template or /t for templates)`
            : placeholder,
          emptyEditorClass: "is-editor-empty",
          emptyNodeClass: "is-node-empty",
          showOnlyWhenEditable: true,
          includeChildren: false,
        }),
        Underline.configure({}),
        TextStyle.configure({}),
        FontSize,
        Color.configure({}),
        Highlight.configure({
          multicolor: true,
        }),
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "text-blue-600 dark:text-blue-400 underline hover:text-blue-800",
          },
        }),
        Image.configure({
          inline: true,
          allowBase64: true,
          HTMLAttributes: {
            class: "max-w-full max-h-[300px] w-auto h-auto rounded object-contain cursor-pointer",
            style: "display: inline-block;",
          },
        }),
        TaskList.configure({
          HTMLAttributes: {
            class: "task-list",
          },
        }),
        TaskItem.configure({
          HTMLAttributes: {
            class: "task-item",
          },
          nested: true,
        }),
        // Table support for email signatures
        Table.configure({
          resizable: false,
          HTMLAttributes: {
            class: "email-signature-table",
          },
        }),
        TableRow.configure({}),
        TableCell.configure({}),
        TableHeader.configure({}),
        createSlashCommandExtension(onSlashCommand),
      ];

      // Add WritingChecker extension if enabled
      if (enableWritingChecker) {
        baseExtensions.push(
          WritingChecker.configure({
            enabled: true,
            debounceMs: 1000,
            context: writingContext,
          })
        );
      }

      return baseExtensions;
    },
    // Only recreate extensions when these dependencies change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeholder, onSlashCommand, enableWritingChecker, writingContext]
  );

  const editor = useEditor({
    extensions,
    content: value,
    immediatelyRender: false, // Prevent SSR hydration mismatch
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "focus:outline-none px-3 py-2",
          "min-h-[inherit]"
        ),
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onFocus: ({ editor }) => {
      registerFocusedEditor(editor);
      onFocus?.();
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  // Update editor content when value changes externally
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Notify parent of editor instance
  React.useEffect(() => {
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  return (
    <div
      className={cn(
        "border rounded-md overflow-hidden bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
    >
      {!hideToolbar && <EditorToolbar editor={editor} showWritingChecker={enableWritingChecker} />}
      <div style={{ minHeight }} className="overflow-y-auto">
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror>p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.ProseMirror>p.is-editor-empty:first-child]:before:text-muted-foreground [&_.ProseMirror>p.is-editor-empty:first-child]:before:float-left [&_.ProseMirror>p.is-editor-empty:first-child]:before:h-0 [&_.ProseMirror>p.is-editor-empty:first-child]:before:pointer-events-none [&_ol]:list-decimal [&_ol]:pl-6 [&_ol_ol]:list-[lower-alpha] [&_ol_ol_ol]:list-[lower-roman] [&_ul]:list-disc [&_ul]:pl-6 [&_ul_ul]:list-[circle] [&_ul_ul_ul]:list-[square] [&_li]:my-1 [&_ul.task-list]:list-none [&_ul.task-list]:pl-0 [&_.task-item]:flex [&_.task-item]:items-center [&_.task-item]:gap-2 [&_.task-item>label]:flex [&_.task-item>label]:items-center [&_.task-item>label]:shrink-0 [&_.task-item>div]:flex-1 [&_.task-item>div]:min-w-0"
        />
      </div>
    </div>
  );
}

// Helper to convert HTML to plain text (for APIs that need plain text)
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

// Helper to convert plain text to simple HTML (for initial content)
export function plainTextToHtml(text: string): string {
  if (!text) return "";
  // Preserve line breaks as <br> and wrap in paragraph
  return text
    .split("\n\n")
    .map(para => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export default RichTextEditor;

// Compact version for inline editing in table cells
export function InlineRichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = "Enter text...",
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}) {
  const inlineExtensions = React.useMemo(
    () => [
      StarterKit.configure({
        // Disable features not needed for inline editing
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    extensions: inlineExtensions,
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none px-2 py-1 min-h-[60px]",
          "[&_ul]:list-disc [&_ul]:ml-3 [&_ol]:list-decimal [&_ol]:ml-3",
          "dark:prose-invert text-sm"
        ),
      },
    },
  });

  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded bg-background">
      {/* Mini toolbar */}
      <div className="border-b bg-muted/30 p-0.5 flex gap-0.5">
        <Button
          type="button"
          variant={editor.isActive("bold") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="h-6 w-6 p-0"
        >
          <Bold className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="h-6 w-6 p-0"
        >
          <Italic className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="h-6 w-6 p-0"
        >
          <List className="h-3 w-3" />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
