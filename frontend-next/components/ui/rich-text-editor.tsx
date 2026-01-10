"use client";

import * as React from "react";
import { useEditor, EditorContent, Editor, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
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
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Plugin, PluginKey } from "@tiptap/pm/state";

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

function Toolbar({ editor }: { editor: Editor | null }) {
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkOpen, setLinkOpen] = React.useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith("image/")) {
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    // Convert to base64 and insert
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      editor.chain().focus().setImage({ src: base64 }).run();
    };
    reader.readAsDataURL(file);

    // Clear input so same file can be selected again
    e.target.value = "";
  };

  const handleSetLink = () => {
    if (linkUrl) {
      // Add https:// if no protocol specified
      const url = linkUrl.match(/^https?:\/\//) ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkUrl("");
    setLinkOpen(false);
  };

  const handleRemoveLink = () => {
    editor.chain().focus().unsetLink().run();
  };

  return (
    <div className="flex items-center gap-0.5 p-1 border-b bg-muted/30 rounded-t-md flex-wrap">
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (Cmd+B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Cmd+I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline (Cmd+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Link */}
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Add link"
            className={cn(
              "h-7 w-7 p-0",
              editor.isActive("link") && "bg-muted text-foreground"
            )}
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSetLink();
                }
              }}
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={handleSetLink} className="h-8">
              Add
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {editor.isActive("link") && (
        <ToolbarButton onClick={handleRemoveLink} title="Remove link">
          <Unlink className="h-4 w-4" />
        </ToolbarButton>
      )}

      <div className="w-px h-5 bg-border mx-1" />

      {/* Image */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      <ToolbarButton
        onClick={() => imageInputRef.current?.click()}
        title="Insert image"
      >
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Cmd+Z)"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Cmd+Shift+Z)"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
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
}: RichTextEditorProps) {
  // Memoize all extensions to prevent tiptap duplicate extension warnings
  const extensions = React.useMemo(
    () => [
      StarterKit.configure({
        // Disable heading since we don't need it for emails
        heading: false,
      }),
      Placeholder.configure({
        placeholder: onSlashCommand
          ? `${placeholder} (Type /template or /t for templates)`
          : placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline hover:text-blue-800",
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: "max-w-full h-auto rounded",
        },
      }),
      // Table support for email signatures
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: "email-signature-table",
        },
      }),
      TableRow,
      TableCell,
      TableHeader,
      createSlashCommandExtension(onSlashCommand),
    ],
    // Only recreate extensions when these dependencies change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeholder, onSlashCommand]
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
  });

  // Update editor content when value changes externally
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  return (
    <div
      className={cn(
        "border rounded-md overflow-hidden bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
    >
      <Toolbar editor={editor} />
      <div style={{ minHeight }} className="overflow-y-auto">
        <EditorContent
          editor={editor}
          className="[&_.is-editor-empty]:before:content-[attr(data-placeholder)] [&_.is-editor-empty]:before:text-muted-foreground [&_.is-editor-empty]:before:float-left [&_.is-editor-empty]:before:h-0 [&_.is-editor-empty]:before:pointer-events-none [&_ol]:list-decimal [&_ol]:pl-6 [&_ol_ol]:list-[lower-alpha] [&_ol_ol_ol]:list-[lower-roman] [&_ul]:list-disc [&_ul]:pl-6 [&_ul_ul]:list-[circle] [&_ul_ul_ul]:list-[square] [&_li]:my-1"
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
