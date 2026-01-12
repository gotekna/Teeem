"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Save,
  Download,
  Upload,
  FileText,
  ChevronLeft,
  MoreVertical,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table2,
  Link as LinkIcon,
  ImageIcon,
  Briefcase,
  X,
  Search,
  Type,
  Minus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useLayoutMode } from "@/contexts/LayoutModeContext";
import { importDocx, exportDocx } from "@/lib/teeem-word";
import { useToast } from "@/components/ui/use-toast";

// Types
interface DocumentData {
  content: string;
  version: number;
  pageSettings: {
    size: string;
    orientation: string;
    margins: { top: number; bottom: number; left: number; right: number };
  };
}

interface TeeemDocument {
  id: number;
  name: string;
  description?: string;
  data: DocumentData;
  jobId?: number;
  jobName?: string;
  updatedAt: string;
  createdAt: string;
}

interface Job {
  id: number;
  name: string;
}

// Toolbar button component
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
        "h-8 w-8 p-0",
        isActive && "bg-muted text-foreground"
      )}
    >
      {children}
    </Button>
  );
}

// Toolbar separator
function ToolbarSeparator() {
  return <div className="h-6 w-px bg-border mx-1" />;
}

export default function TeeemWordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("id");
  const { setMode } = useLayoutMode();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Enable fullscreen mode (hide sidebar/breadcrumbs)
  React.useEffect(() => {
    setMode("fullscreen");
    return () => setMode("padded");
  }, [setMode]);

  // State
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [document, setDocument] = React.useState<TeeemDocument | null>(null);
  const [name, setName] = React.useState("Untitled Document");
  const [hasChanges, setHasChanges] = React.useState(false);

  // Job association state
  const [selectedJobId, setSelectedJobId] = React.useState<number | null>(null);
  const [selectedJobName, setSelectedJobName] = React.useState<string | null>(null);
  const [jobSearchOpen, setJobSearchOpen] = React.useState(false);
  const [jobSearchTerm, setJobSearchTerm] = React.useState("");
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(false);

  // TipTap editor
  const editor = useEditor({
    immediatelyRender: false, // Required for Next.js SSR - prevents hydration mismatch
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Placeholder.configure({
        placeholder: "Start typing your document...",
      }),
      Link.configure({
        openOnClick: false,
      }),
      Underline,
      Image,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: "<p></p>",
    onUpdate: ({ editor }) => {
      setHasChanges(true);
    },
  });

  // Search jobs for the job picker
  const searchJobs = React.useCallback(async (term: string) => {
    setLoadingJobs(true);
    try {
      const url = term.trim()
        ? `/api/v1/jobs/for_select?q=${encodeURIComponent(term)}`
        : `/api/v1/jobs/for_select`;
      const response = await api.get<{ success: boolean; jobs: Job[] }>(url);
      if (response?.success && response.jobs) {
        setJobs(response.jobs.slice(0, 20));
      }
    } catch (error) {
      console.error("Failed to search jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Load jobs when popover opens
  React.useEffect(() => {
    if (!jobSearchOpen) return;
    if (jobSearchTerm === "") {
      searchJobs("");
      return;
    }
    const timeout = setTimeout(() => {
      searchJobs(jobSearchTerm);
    }, 300);
    return () => clearTimeout(timeout);
  }, [jobSearchTerm, jobSearchOpen, searchJobs]);

  // Load document or create new
  React.useEffect(() => {
    const loadOrCreate = async () => {
      setLoading(true);
      try {
        if (documentId) {
          const response = await api.get<{ success: boolean; data: TeeemDocument }>(
            `/api/v1/teeem_documents/${documentId}`
          );
          if (response?.success && response.data) {
            setDocument(response.data);
            setName(response.data.name);
            setSelectedJobId(response.data.jobId || null);
            setSelectedJobName(response.data.jobName || null);
            if (editor && response.data.data?.content) {
              editor.commands.setContent(response.data.data.content);
            }
          }
        } else {
          const response = await api.post<{ success: boolean; data: TeeemDocument }>(
            "/api/v1/teeem_documents",
            { teeem_document: { name: "Untitled Document" } }
          );
          if (response?.success && response.data) {
            setDocument(response.data);
            setName(response.data.name);
            router.replace(`/admin/system/teeem-word?id=${response.data.id}`);
          }
        }
      } catch (error) {
        console.error("Failed to load/create document:", error);
      } finally {
        setLoading(false);
      }
    };

    loadOrCreate();
  }, [documentId, router, editor]);

  // Set editor content when document loads and editor is ready
  React.useEffect(() => {
    if (editor && document?.data?.content) {
      editor.commands.setContent(document.data.content);
    }
  }, [editor, document]);

  // Auto-save on changes (debounced)
  React.useEffect(() => {
    if (!hasChanges || !document || !editor) return;

    const timeout = setTimeout(async () => {
      setSaving(true);
      try {
        const content = editor.getHTML();
        await api.patch(`/api/v1/teeem_documents/${document.id}`, {
          teeem_document: {
            name,
            job_id: selectedJobId,
            data: {
              content,
              version: 1,
              pageSettings: document.data?.pageSettings || {
                size: "A4",
                orientation: "portrait",
                margins: { top: 1, bottom: 1, left: 1, right: 1 },
              },
            },
          },
        });
        setHasChanges(false);
      } catch (error) {
        console.error("Failed to save:", error);
      } finally {
        setSaving(false);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [hasChanges, document, name, selectedJobId, editor]);

  // Save immediately
  const handleSave = async () => {
    if (!document || !editor) return;
    setSaving(true);
    try {
      const content = editor.getHTML();
      await api.patch(`/api/v1/teeem_documents/${document.id}`, {
        teeem_document: {
          name,
          job_id: selectedJobId,
          data: {
            content,
            version: 1,
            pageSettings: document.data?.pageSettings || {
              size: "A4",
              orientation: "portrait",
              margins: { top: 1, bottom: 1, left: 1, right: 1 },
            },
          },
        },
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  // Import DOCX file
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast({
        title: "Invalid file type",
        description: "Please select a .docx file",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const result = await importDocx(file);
      editor.commands.setContent(result.html);
      setHasChanges(true);

      // Update document name to file name (without extension)
      const fileName = file.name.replace(/\.docx$/i, "");
      setName(fileName);

      toast({
        title: "Document imported",
        description: result.messages.length > 0
          ? `Imported with ${result.messages.length} warning(s)`
          : "Document imported successfully",
      });

      // Log any warnings
      if (result.messages.length > 0) {
        console.log("Import warnings:", result.messages);
      }
    } catch (error) {
      console.error("Failed to import:", error);
      toast({
        title: "Import failed",
        description: "Failed to import the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Export to DOCX
  const handleExportDocx = async () => {
    if (!editor || !document) return;

    setExporting(true);
    try {
      const content = editor.getHTML();
      const filename = name.replace(/[^a-z0-9]/gi, "_");
      await exportDocx(content, filename);

      toast({
        title: "Document exported",
        description: "Your document has been downloaded",
      });
    } catch (error) {
      console.error("Failed to export:", error);
      toast({
        title: "Export failed",
        description: "Failed to export the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // Export to HTML (fallback)
  const handleExportHtml = () => {
    if (!editor || !document) return;
    const content = editor.getHTML();
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9]/gi, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Add link
  const handleAddLink = () => {
    if (!editor) return;
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  // Add image
  const handleAddImage = () => {
    if (!editor) return;
    const url = window.prompt("Enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  // Add table
  const handleAddTable = () => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/system/teeem-word/list")}
            title="Back to documents"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="h-8 w-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>

          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasChanges(true);
            }}
            className="w-64 h-8 text-sm font-medium bg-transparent border-0 hover:bg-muted/50 focus:bg-background"
            placeholder="Document name"
          />

          {/* Saving indicator */}
          {saving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Spinner size={12} />
              Saving...
            </span>
          )}
          {!saving && hasChanges && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
          {!saving && !hasChanges && document && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Job association */}
          <Popover open={jobSearchOpen} onOpenChange={setJobSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <Briefcase className="h-3.5 w-3.5" />
                {selectedJobName || "Attach to Job"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={jobSearchTerm}
                    onChange={(e) => setJobSearchTerm(e.target.value)}
                    placeholder="Search jobs..."
                    className="h-8 pl-7 text-sm"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {loadingJobs ? (
                    <div className="flex items-center justify-center py-4">
                      <Spinner size={16} />
                    </div>
                  ) : jobs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No jobs found
                    </p>
                  ) : (
                    <div className="space-y-0.5">
                      {selectedJobId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-8 text-xs text-destructive"
                          onClick={() => {
                            setSelectedJobId(null);
                            setSelectedJobName(null);
                            setHasChanges(true);
                            setJobSearchOpen(false);
                          }}
                        >
                          <X className="h-3 w-3 mr-2" />
                          Remove job
                        </Button>
                      )}
                      {jobs.map((job) => (
                        <Button
                          key={job.id}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full justify-start h-8 text-xs",
                            selectedJobId === job.id && "bg-muted"
                          )}
                          onClick={() => {
                            setSelectedJobId(job.id);
                            setSelectedJobName(job.name);
                            setHasChanges(true);
                            setJobSearchOpen(false);
                          }}
                        >
                          {job.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" className="h-8" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-2" />
            Save
          </Button>

          {/* Import button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Spinner size={14} className="mr-2" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-2" />
            )}
            Import
          </Button>

          {/* Hidden file input for import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleImport}
            className="hidden"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportDocx} disabled={exporting}>
                {exporting ? (
                  <Spinner size={14} className="mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export as Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportHtml}>
                <Download className="h-4 w-4 mr-2" />
                Export as HTML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-card/50">
        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor?.can().undo()}
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor?.can().redo()}
          title="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Headings */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
              <Type className="h-4 w-4" />
              <span className="text-xs">Style</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => editor?.chain().focus().setParagraph().run()}>
              Normal text
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
              Heading 1
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
              Heading 2
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
              Heading 3
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarSeparator />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBold().run()}
          isActive={editor?.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          isActive={editor?.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          isActive={editor?.isActive("underline")}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          isActive={editor?.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
          isActive={editor?.isActive({ textAlign: "left" })}
          title="Align left"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
          isActive={editor?.isActive({ textAlign: "center" })}
          title="Align center"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
          isActive={editor?.isActive({ textAlign: "right" })}
          title="Align right"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          isActive={editor?.isActive("bulletList")}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          isActive={editor?.isActive("orderedList")}
          title="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Insert */}
        <ToolbarButton onClick={handleAddLink} title="Insert link">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleAddImage} title="Insert image">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleAddTable} title="Insert table">
          <Table2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          title="Insert horizontal line"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900/50">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="bg-white dark:bg-gray-950 shadow-lg min-h-[800px] p-12 rounded">
            <EditorContent
              editor={editor}
              className="prose prose-sm dark:prose-invert max-w-none min-h-[700px] focus:outline-none
                prose-headings:font-semibold
                prose-h1:text-3xl prose-h1:mb-4
                prose-h2:text-2xl prose-h2:mb-3
                prose-h3:text-xl prose-h3:mb-2
                prose-p:mb-3
                prose-ul:mb-3 prose-ol:mb-3
                prose-table:border-collapse
                prose-td:border prose-td:border-gray-300 prose-td:p-2
                prose-th:border prose-th:border-gray-300 prose-th:p-2 prose-th:bg-gray-100 dark:prose-th:bg-gray-800
              "
            />
          </div>
        </div>
      </div>
    </div>
  );
}
