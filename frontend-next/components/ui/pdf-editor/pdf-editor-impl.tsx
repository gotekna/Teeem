"use client";

import * as React from "react";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { usePDFDocument } from "./use-pdf-document";
import { PageThumbnail } from "./page-thumbnail";
import { EditorToolbar } from "./toolbar";
import { AnnotationCanvas } from "./annotation-canvas";
import type { AnnotationTool, PDFEditorProps } from "./types";
import { cn } from "@/lib/utils";
import { FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

export function PDFEditorImpl({
  url,
  fileName = "document.pdf",
  onSave,
  onClose,
  className,
}: PDFEditorProps) {
  const { toast } = useToast();
  // PDF document state
  const {
    pages,
    isLoading,
    error,
    reorderPages,
    deletePage,
    mergePDF,
    exportPDF,
    updatePageAnnotations,
  } = usePDFDocument(url);

  // Editor state
  const [selectedPageId, setSelectedPageId] = React.useState<string | null>(null);
  const [currentTool, setCurrentTool] = React.useState<AnnotationTool>("select");
  const [zoom, setZoom] = React.useState(100);
  const [strokeColor, setStrokeColor] = React.useState("#FF0000");
  const [strokeWidth, setStrokeWidth] = React.useState(2);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  // File input ref for merge
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Auto-select first page
  React.useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages, selectedPageId]);

  // Get selected page
  const selectedPage = pages.find((p) => p.id === selectedPageId);

  // Handle drag end for reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderPages(oldIndex, newIndex);
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      // If deleting selected page, select another
      if (deleteConfirm === selectedPageId) {
        const currentIndex = pages.findIndex((p) => p.id === deleteConfirm);
        const nextPage = pages[currentIndex + 1] || pages[currentIndex - 1];
        setSelectedPageId(nextPage?.id || null);
      }
      deletePage(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  // Handle merge
  const handleMerge = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await mergePDF(file);
    } catch (err) {
      console.error("Failed to merge PDF:", err);
      toast({ title: "Error", description: "Failed to merge PDF. Please try again.", variant: "destructive" });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle save
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const pdfBytes = await exportPDF();

      if (onSave) {
        await onSave(pdfBytes, fileName);
      } else {
        // Download locally if no save handler
        const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to save PDF:", err);
      toast({ title: "Error", description: "Failed to save PDF. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle history change from annotation canvas
  const handleHistoryChange = (undo: boolean, redo: boolean) => {
    setCanUndo(undo);
    setCanRedo(redo);
  };

  // Handle annotations change
  const handleAnnotationsChange = (annotations: any[]) => {
    if (selectedPageId) {
      updatePageAnnotations(selectedPageId, annotations);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full", className)}>
        <Spinner size={48} className="mb-4" />
        <p className="text-muted-foreground">Loading PDF editor...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground p-8", className)}>
        <AlertCircle className="h-16 w-16 mb-4 text-destructive" />
        <p className="text-lg font-medium mb-2">Failed to load PDF</p>
        <p className="text-sm text-center mb-4">{error}</p>
        <Button onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Hidden file input for merge */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Toolbar */}
      <EditorToolbar
        currentTool={currentTool}
        onToolChange={setCurrentTool}
        onUndo={() => {}} // TODO: Connect to annotation canvas
        onRedo={() => {}}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={zoom}
        onZoomChange={setZoom}
        strokeColor={strokeColor}
        onStrokeColorChange={setStrokeColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        onSave={handleSave}
        onMerge={handleMerge}
        isSaving={isSaving}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Page thumbnails sidebar */}
        <div className="w-32 border-r bg-muted/30 flex flex-col">
          <div className="px-2 py-1 border-b">
            <p className="text-xs font-medium text-muted-foreground">
              Pages ({pages.length})
            </p>
          </div>
          <ScrollArea className="flex-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={pages.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="p-2 space-y-1">
                  {pages.map((page, index) => (
                    <PageThumbnail
                      key={page.id}
                      page={page}
                      index={index}
                      isSelected={page.id === selectedPageId}
                      onSelect={() => setSelectedPageId(page.id)}
                      onDelete={() => setDeleteConfirm(page.id)}
                      totalPages={pages.length}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </ScrollArea>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-muted/50 flex items-center justify-center p-4">
          {selectedPage ? (
            <AnnotationCanvas
              pageImage={selectedPage.thumbnail}
              width={selectedPage.width} // Use actual rendered dimensions (now at 1.5x * dpr)
              height={selectedPage.height}
              zoom={zoom}
              currentTool={currentTool}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              annotations={selectedPage.annotations}
              onAnnotationsChange={handleAnnotationsChange}
              onHistoryChange={handleHistoryChange}
              className="shadow-lg"
            />
          ) : (
            <div className="text-center text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4" />
              <p>Select a page to edit</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this page? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
