"use client";

import * as React from "react";
import { useState, useMemo, useImperativeHandle, forwardRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Notebook,
  FileText,
  Pin,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderPlus,
  Search,
  X,
  GripVertical,
  MoveRight,
  CheckSquare,
} from "lucide-react";
import debounce from "lodash/debounce";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createDndSensors } from "@/components/ui/dnd/dnd-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useNotebooks,
  useNotebook,
  notebookActions,
  sectionActions,
  type Notebook as NotebookType,
  type NotebookSection,
  type NotebookPageSummary,
} from "./hooks/useNotebooks";
import { pageActions, useSearchPages, type NotebookPage } from "./hooks/useNotebookPage";

interface NotebooksSidebarProps {
  selectedNotebookId: number | null;
  selectedPageId: number | null;
  onSelectNotebook: (id: number) => void;
  onSelectPage: (pageId: number, notebookId: number) => void;
  onCreateNotebook?: () => void;
  className?: string;
}

export interface NotebooksSidebarRef {
  createNewPage: () => Promise<void>;
}

export const NotebooksSidebar = forwardRef<NotebooksSidebarRef, NotebooksSidebarProps>(function NotebooksSidebar({
  selectedNotebookId,
  selectedPageId,
  onSelectNotebook,
  onSelectPage,
  onCreateNotebook,
  className,
}: NotebooksSidebarProps, ref) {
  const queryClient = useQueryClient();
  const { notebooks, isLoading, error, mutate: mutateNotebooks } = useNotebooks({ global: true });
  const { notebook: selectedNotebook } = useNotebook(selectedNotebookId);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<number>>(new Set());
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  // Debounce search query
  const debouncedSetQuery = useMemo(
    () => debounce((q: string) => setDebouncedQuery(q), 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSetQuery(value);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setDebouncedQuery("");
  };

  const { pages: searchResults, isLoading: isSearching } = useSearchPages(debouncedQuery);
  const isSearchMode = debouncedQuery.trim().length >= 2;

  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleCreateSection = async (notebookId: number) => {
    try {
      await sectionActions.create(notebookId, { name: "New Section" });
      await queryClient.invalidateQueries({ queryKey: ["notebook", notebookId] });
    } catch (err) {
      console.error("Failed to create section:", err);
    }
  };

  const handleRenameSection = async (notebookId: number, sectionId: number) => {
    if (!newSectionName.trim()) {
      setEditingSection(null);
      return;
    }
    try {
      await sectionActions.update(notebookId, sectionId, { name: newSectionName });
      await queryClient.invalidateQueries({ queryKey: ["notebook", notebookId] });
    } catch (err) {
      console.error("Failed to rename section:", err);
    }
    setEditingSection(null);
    setNewSectionName("");
  };

  const handleDeleteSection = async (notebookId: number, sectionId: number) => {
    if (!confirm("Are you sure you want to delete this section and all its pages?")) return;
    try {
      await sectionActions.delete(notebookId, sectionId);
      await queryClient.invalidateQueries({ queryKey: ["notebook", notebookId] });
    } catch (err) {
      console.error("Failed to delete section:", err);
    }
  };

  const handleDeleteNotebook = async (notebookId: number) => {
    if (!confirm("Are you sure you want to delete this notebook and all its contents?")) return;
    try {
      await notebookActions.delete(notebookId);
      mutateNotebooks();
      // If we deleted the selected notebook, clear selection
      if (selectedNotebookId === notebookId) {
        onSelectNotebook(notebooks[0]?.id ?? 0);
      }
    } catch (err) {
      console.error("Failed to delete notebook:", err);
    }
  };

  const handleCreatePage = async (notebookId: number, sectionId: number) => {
    console.log("📝 Creating page:", { notebookId, sectionId });
    try {
      const page = await pageActions.create(notebookId, sectionId, { title: "Untitled" });
      console.log("✓ Page created successfully:", page);
      // Ensure the section is expanded so the new page is visible
      setExpandedSections((prev) => new Set(prev).add(sectionId));
      // Invalidate React Query cache to force refresh the sidebar
      await queryClient.invalidateQueries({ queryKey: ["notebook", notebookId] });
      console.log("✓ Sidebar refreshed");
      // Log the updated notebook data
      console.log("📊 Notebook data after refresh:", selectedNotebook);
      const section = selectedNotebook?.sections?.find(s => s.id === sectionId);
      console.log("📊 Section pages after refresh:", section?.pages);
      onSelectPage(page.id, notebookId);
    } catch (err) {
      console.error("✗ Failed to create page:", err);
      alert(`Failed to create page: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeletePage = async (pageId: number) => {
    if (!confirm("Are you sure you want to delete this page?")) return;
    try {
      await pageActions.delete(pageId);
      await queryClient.invalidateQueries({ queryKey: ["notebook", selectedNotebookId] });
    } catch (err) {
      console.error("Failed to delete page:", err);
    }
  };

  const handleTogglePin = async (pageId: number) => {
    try {
      await pageActions.togglePin(pageId);
      await queryClient.invalidateQueries({ queryKey: ["notebook", selectedNotebookId] });
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  // Multi-select handlers
  const togglePageSelection = (pageId: number) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedPageIds(new Set());
    setIsSelectMode(false);
  };

  const selectAllPages = () => {
    if (!selectedNotebook?.sections) return;
    const allPageIds = new Set<number>();
    selectedNotebook.sections.forEach((section) => {
      section.pages?.forEach((page) => {
        allPageIds.add(page.id);
      });
    });
    setSelectedPageIds(allPageIds);
  };

  const handleBulkDelete = async () => {
    if (selectedPageIds.size === 0) return;
    const count = selectedPageIds.size;
    if (!confirm(`Are you sure you want to delete ${count} page${count > 1 ? "s" : ""}?`)) return;

    try {
      // Delete all selected pages
      await Promise.all(Array.from(selectedPageIds).map((id) => pageActions.delete(id)));
      await queryClient.invalidateQueries({ queryKey: ["notebook", selectedNotebookId] });
      clearSelection();
    } catch (err) {
      console.error("Failed to delete pages:", err);
    }
  };

  const handleBulkMove = async (targetSectionId: number, targetNotebookId?: number) => {
    if (selectedPageIds.size === 0) return;

    try {
      // Move all selected pages to the target section
      await Promise.all(
        Array.from(selectedPageIds).map((id) => pageActions.move(id, { section_id: targetSectionId }))
      );
      // Invalidate both source and target notebook caches
      await queryClient.invalidateQueries({ queryKey: ["notebook", selectedNotebookId] });
      if (targetNotebookId && targetNotebookId !== selectedNotebookId) {
        await queryClient.invalidateQueries({ queryKey: ["notebook", targetNotebookId] });
      }
      setShowMoveDialog(false);
      clearSelection();
    } catch (err) {
      console.error("Failed to move pages:", err);
    }
  };

  const handleReorderSection = async (notebookId: number, sectionId: number, newPosition: number) => {
    try {
      await sectionActions.reorder(notebookId, sectionId, newPosition);
      await queryClient.invalidateQueries({ queryKey: ["notebook", notebookId] });
    } catch (err) {
      console.error("Failed to reorder section:", err);
    }
  };

  const handleReorderPage = async (pageId: number, newPosition: number) => {
    try {
      await pageActions.move(pageId, { position: newPosition });
      await queryClient.invalidateQueries({ queryKey: ["notebook", selectedNotebookId] });
    } catch (err) {
      console.error("Failed to reorder page:", err);
    }
  };

  // Expose methods via ref for keyboard shortcuts
  useImperativeHandle(ref, () => ({
    createNewPage: async () => {
      // Find the first expanded section, or the first section of the selected notebook
      if (!selectedNotebookId || !selectedNotebook) return;
      const sections = selectedNotebook.sections ?? [];
      if (sections.length === 0) {
        // Create a section first
        await handleCreateSection(selectedNotebookId);
        return;
      }
      // Use the first expanded section, or the first section
      const expandedSectionIds = Array.from(expandedSections);
      const targetSectionId = expandedSectionIds.length > 0 ? expandedSectionIds[0] : sections[0].id;
      await handleCreatePage(selectedNotebookId, targetSectionId);
    },
  }), [selectedNotebookId, selectedNotebook, expandedSections]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-40", className)}>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-40 text-center p-4", className)}>
        <p className="text-sm text-destructive mb-2">Failed to load notebooks</p>
        <p className="text-xs text-muted-foreground mb-3">{error.message}</p>
        <Button variant="outline" size="sm" onClick={() => mutateNotebooks()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h2 className="font-semibold text-sm">Notebooks</h2>
        <div className="flex items-center gap-1">
          <Button
            variant={isSelectMode ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              if (isSelectMode) {
                clearSelection();
              } else {
                setIsSelectMode(true);
              }
            }}
            title={isSelectMode ? "Cancel selection" : "Select pages"}
          >
            {isSelectMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCreateNotebook}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {isSelectMode && (
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={selectAllPages}
            >
              Select All
            </Button>
            <span className="text-xs text-muted-foreground">
              {selectedPageIds.size} page{selectedPageIds.size !== 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowMoveDialog(true)}
              disabled={selectedPageIds.size === 0}
            >
              <MoveRight className="h-3.5 w-3.5 mr-1" />
              Move
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={handleBulkDelete}
              disabled={selectedPageIds.size === 0}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search notes..."
            className="h-8 pl-8 pr-8 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={clearSearch}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {isSearchMode && (
        <div className="flex-1 overflow-auto">
          <div className="py-2">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-5 w-5" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1 px-2">
                {searchResults.map((page) => (
                  <SearchResultItem
                    key={page.id}
                    page={page}
                    isSelected={selectedPageId === page.id}
                    onSelect={() => {
                      if (page.notebook?.id) {
                        onSelectPage(page.id, page.notebook.id);
                        clearSearch();
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                No results found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notebook List - hidden when searching */}
      {!isSearchMode && (
        <div className="flex-1 overflow-auto">
          <div className="py-2">
            {notebooks.map((notebook) => (
              <NotebookItem
              key={notebook.id}
              notebook={notebook}
              isSelected={selectedNotebookId === notebook.id}
              selectedNotebook={selectedNotebookId === notebook.id ? selectedNotebook : null}
              selectedPageId={selectedPageId}
              expandedSections={expandedSections}
              editingSection={editingSection}
              newSectionName={newSectionName}
              onSelect={() => onSelectNotebook(notebook.id)}
              onSelectPage={(pageId) => onSelectPage(pageId, notebook.id)}
              onToggleSection={toggleSection}
              onCreateSection={() => handleCreateSection(notebook.id)}
              onStartEditSection={(sectionId, name) => {
                setEditingSection(sectionId);
                setNewSectionName(name);
              }}
              onSectionNameChange={setNewSectionName}
              onFinishEditSection={(sectionId) =>
                handleRenameSection(notebook.id, sectionId)
              }
              onDeleteSection={(sectionId) => handleDeleteSection(notebook.id, sectionId)}
              onCreatePage={(sectionId) => handleCreatePage(notebook.id, sectionId)}
              onDeletePage={handleDeletePage}
              onTogglePin={handleTogglePin}
              onReorderSection={(sectionId, newPosition) => handleReorderSection(notebook.id, sectionId, newPosition)}
              onReorderPage={handleReorderPage}
              onDeleteNotebook={() => handleDeleteNotebook(notebook.id)}
              isSelectMode={isSelectMode}
              selectedPageIds={selectedPageIds}
              onTogglePageSelection={togglePageSelection}
            />
          ))}

          {notebooks.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              <Notebook className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notebooks yet</p>
              <Button
                variant="link"
                size="sm"
                className="mt-1"
                onClick={onCreateNotebook}
              >
                Create your first notebook
              </Button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Move Pages Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move {selectedPageIds.size} page{selectedPageIds.size > 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Select a notebook and section to move the selected pages to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-[400px] overflow-auto">
            {notebooks.map((notebook) => (
              <MoveDialogNotebookItem
                key={notebook.id}
                notebook={notebook}
                isCurrentNotebook={notebook.id === selectedNotebookId}
                onSelectSection={(sectionId) => handleBulkMove(sectionId, notebook.id)}
              />
            ))}
            {notebooks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No notebooks available.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

interface NotebookItemProps {
  notebook: NotebookType;
  isSelected: boolean;
  selectedNotebook: NotebookType | null;
  selectedPageId: number | null;
  expandedSections: Set<number>;
  editingSection: number | null;
  newSectionName: string;
  onSelect: () => void;
  onSelectPage: (pageId: number) => void;
  onToggleSection: (sectionId: number) => void;
  onCreateSection: () => void;
  onStartEditSection: (sectionId: number, name: string) => void;
  onSectionNameChange: (name: string) => void;
  onFinishEditSection: (sectionId: number) => void;
  onDeleteSection: (sectionId: number) => void;
  onCreatePage: (sectionId: number) => void;
  onDeletePage: (pageId: number) => void;
  onTogglePin: (pageId: number) => void;
  onReorderSection: (sectionId: number, newPosition: number) => void;
  onReorderPage: (pageId: number, newPosition: number) => void;
  onDeleteNotebook: () => void;
  // Multi-select props
  isSelectMode: boolean;
  selectedPageIds: Set<number>;
  onTogglePageSelection: (pageId: number) => void;
}

function NotebookItem({
  notebook,
  isSelected,
  selectedNotebook,
  selectedPageId,
  expandedSections,
  editingSection,
  newSectionName,
  onSelect,
  onSelectPage,
  onToggleSection,
  onCreateSection,
  onStartEditSection,
  onSectionNameChange,
  onFinishEditSection,
  onDeleteSection,
  onCreatePage,
  onDeletePage,
  onTogglePin,
  onReorderSection,
  onReorderPage,
  onDeleteNotebook,
  isSelectMode,
  selectedPageIds,
  onTogglePageSelection,
}: NotebookItemProps) {
  const sections = selectedNotebook?.sections ?? [];
  const sensors = createDndSensors();
  const [activeSectionId, setActiveSectionId] = React.useState<number | null>(null);

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSectionId(null);

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        // Position is 1-indexed
        onReorderSection(Number(active.id), newIndex + 1);
      }
    }
  };

  const handleSectionDragStart = (event: DragStartEvent) => {
    setActiveSectionId(Number(event.active.id));
  };

  return (
    <div className="mb-1">
      {/* Notebook Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50 rounded-sm mx-1 group",
          isSelected && "bg-muted"
        )}
        onClick={onSelect}
      >
        <Notebook
          className="h-4 w-4 shrink-0"
          style={{ color: notebook.color || undefined }}
        />
        <span className="text-sm font-medium truncate flex-1">{notebook.name}</span>
        {isSelected && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onCreateSection();
              }}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNotebook();
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Notebook
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Sections (only show when notebook is selected) */}
      {isSelected && sections.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleSectionDragStart}
          onDragEnd={handleSectionDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="ml-4 mt-1">
              {sections.map((section) => (
                <SortableSectionItem
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections.has(section.id)}
                  isEditing={editingSection === section.id}
                  editName={newSectionName}
                  selectedPageId={selectedPageId}
                  onToggle={() => onToggleSection(section.id)}
                  onSelectPage={onSelectPage}
                  onStartEdit={() => onStartEditSection(section.id, section.name)}
                  onNameChange={onSectionNameChange}
                  onFinishEdit={() => onFinishEditSection(section.id)}
                  onDelete={() => onDeleteSection(section.id)}
                  onCreatePage={() => onCreatePage(section.id)}
                  onDeletePage={onDeletePage}
                  onTogglePin={onTogglePin}
                  onReorderPage={onReorderPage}
                  isSelectMode={isSelectMode}
                  selectedPageIds={selectedPageIds}
                  onTogglePageSelection={onTogglePageSelection}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeSectionId && (
              <div className="px-2 py-1 bg-background border rounded shadow-md text-xs">
                {sections.find((s) => s.id === activeSectionId)?.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

interface SortableSectionItemProps extends SectionItemProps {
  // Same as SectionItemProps but used with useSortable
}

function SortableSectionItem(props: SortableSectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.section.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SectionItem {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

interface SectionItemProps {
  section: NotebookSection;
  isExpanded: boolean;
  isEditing: boolean;
  editName: string;
  selectedPageId: number | null;
  onToggle: () => void;
  onSelectPage: (pageId: number) => void;
  onStartEdit: () => void;
  onNameChange: (name: string) => void;
  onFinishEdit: () => void;
  onDelete: () => void;
  onCreatePage: () => void;
  onDeletePage: (pageId: number) => void;
  onTogglePin: (pageId: number) => void;
  onReorderPage?: (pageId: number, newPosition: number) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  // Multi-select props
  isSelectMode: boolean;
  selectedPageIds: Set<number>;
  onTogglePageSelection: (pageId: number) => void;
}

function SectionItem({
  section,
  isExpanded,
  isEditing,
  editName,
  selectedPageId,
  onToggle,
  onSelectPage,
  onStartEdit,
  onNameChange,
  onFinishEdit,
  onDelete,
  onCreatePage,
  onDeletePage,
  onTogglePin,
  onReorderPage,
  dragHandleProps,
  isSelectMode,
  selectedPageIds,
  onTogglePageSelection,
}: SectionItemProps) {
  const pages = section.pages ?? [];

  return (
    <div className="mb-0.5">
      {/* Section Header */}
      <div className="flex items-center gap-1 group">
        {/* Drag Handle */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
        <button
          className="p-0.5 hover:bg-muted rounded"
          onClick={onToggle}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onFinishEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onFinishEdit();
              if (e.key === "Escape") onFinishEdit();
            }}
            className="h-6 text-xs py-0"
            autoFocus
          />
        ) : (
          <span
            className="text-xs font-medium text-muted-foreground flex-1 truncate cursor-pointer hover:text-foreground"
            style={{ color: section.color || undefined }}
            onClick={onToggle}
          >
            {section.name}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCreatePage}>
              <Plus className="h-4 w-4 mr-2" />
              Add Page
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onStartEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Pages */}
      {isExpanded && pages.length > 0 && (
        <div className="ml-5 mt-0.5">
          {pages.map((page) => (
            <PageItem
              key={page.id}
              page={page}
              isSelected={selectedPageId === page.id}
              onSelect={() => onSelectPage(page.id)}
              onDelete={() => onDeletePage(page.id)}
              onTogglePin={() => onTogglePin(page.id)}
              isSelectMode={isSelectMode}
              isChecked={selectedPageIds.has(page.id)}
              onToggleSelection={() => onTogglePageSelection(page.id)}
            />
          ))}
        </div>
      )}

      {isExpanded && pages.length === 0 && (
        <div className="ml-5 mt-0.5">
          <button
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-0.5"
            onClick={onCreatePage}
          >
            <Plus className="h-3 w-3" />
            Add page
          </button>
        </div>
      )}
    </div>
  );
}

interface PageItemProps {
  page: NotebookPageSummary;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  // Multi-select props
  isSelectMode: boolean;
  isChecked: boolean;
  onToggleSelection: () => void;
}

function PageItem({
  page,
  isSelected,
  onSelect,
  onDelete,
  onTogglePin,
  isSelectMode,
  isChecked,
  onToggleSelection,
}: PageItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (isSelectMode) {
      e.preventDefault();
      onToggleSelection();
    } else {
      onSelect();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-muted/50 rounded-sm group",
        isSelected && !isSelectMode && "bg-primary/10",
        isChecked && "bg-primary/20"
      )}
      onClick={handleClick}
    >
      {/* Checkbox in select mode */}
      {isSelectMode ? (
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => onToggleSelection()}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 shrink-0"
        />
      ) : page.is_pinned ? (
        <Pin className="h-3 w-3 shrink-0 text-primary" />
      ) : (
        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
      <span className="text-xs truncate flex-1">{page.title}</span>

      {/* Hide menu in select mode */}
      {!isSelectMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onTogglePin}>
              <Pin className="h-4 w-4 mr-2" />
              {page.is_pinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

interface SearchResultItemProps {
  page: NotebookPage;
  isSelected: boolean;
  onSelect: () => void;
}

function SearchResultItem({ page, isSelected, onSelect }: SearchResultItemProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 px-3 py-2 cursor-pointer hover:bg-muted/50 rounded-md",
        isSelected && "bg-primary/10"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        {page.is_pinned ? (
          <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-medium truncate">{page.title}</span>
      </div>
      {page.notebook && (
        <div className="flex items-center gap-1 ml-5 text-xs text-muted-foreground">
          <Notebook className="h-3 w-3" />
          <span className="truncate">
            {page.notebook.name}
            {page.section && ` / ${page.section.name}`}
          </span>
        </div>
      )}
      {page.preview && (
        <p className="text-xs text-muted-foreground ml-5 line-clamp-1">
          {page.preview}
        </p>
      )}
    </div>
  );
}

// Component for Move Dialog - shows notebook with expandable sections
interface MoveDialogNotebookItemProps {
  notebook: NotebookType;
  isCurrentNotebook: boolean;
  onSelectSection: (sectionId: number) => void;
}

function MoveDialogNotebookItem({
  notebook,
  isCurrentNotebook,
  onSelectSection,
}: MoveDialogNotebookItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(isCurrentNotebook);
  const { notebook: notebookWithSections } = useNotebook(isExpanded ? notebook.id : null);

  const sections = notebookWithSections?.sections ?? [];

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Notebook Header */}
      <button
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50",
          isCurrentNotebook && "bg-muted/30"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <Notebook
          className="h-4 w-4 shrink-0"
          style={{ color: notebook.color || undefined }}
        />
        <span className="text-sm font-medium truncate flex-1">{notebook.name}</span>
        {isCurrentNotebook && (
          <span className="text-xs text-muted-foreground">(current)</span>
        )}
      </button>

      {/* Sections */}
      {isExpanded && (
        <div className="border-t bg-muted/20">
          {sections.length > 0 ? (
            sections.map((section) => (
              <button
                key={section.id}
                className="flex items-center gap-2 w-full px-3 py-1.5 pl-9 text-left hover:bg-muted/50 text-sm"
                onClick={() => onSelectSection(section.id)}
              >
                <FolderPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{section.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {section.page_count} page{section.page_count !== 1 ? "s" : ""}
                </span>
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground px-3 py-2 pl-9">
              No sections in this notebook
            </p>
          )}
        </div>
      )}
    </div>
  );
}
