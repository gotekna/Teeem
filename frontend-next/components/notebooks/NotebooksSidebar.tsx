"use client";

import * as React from "react";
import { useState } from "react";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  useNotebooks,
  useNotebook,
  notebookActions,
  sectionActions,
  type Notebook as NotebookType,
  type NotebookSection,
  type NotebookPageSummary,
} from "./hooks/useNotebooks";
import { pageActions } from "./hooks/useNotebookPage";

interface NotebooksSidebarProps {
  selectedNotebookId: number | null;
  selectedPageId: number | null;
  onSelectNotebook: (id: number) => void;
  onSelectPage: (pageId: number, notebookId: number) => void;
  onCreateNotebook?: () => void;
  className?: string;
}

export function NotebooksSidebar({
  selectedNotebookId,
  selectedPageId,
  onSelectNotebook,
  onSelectPage,
  onCreateNotebook,
  className,
}: NotebooksSidebarProps) {
  const { notebooks, isLoading, mutate: mutateNotebooks } = useNotebooks({ global: true });
  const { notebook: selectedNotebook, mutate: mutateNotebook } = useNotebook(selectedNotebookId);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [newSectionName, setNewSectionName] = useState("");

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
      mutateNotebook();
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
      mutateNotebook();
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
      mutateNotebook();
    } catch (err) {
      console.error("Failed to delete section:", err);
    }
  };

  const handleCreatePage = async (notebookId: number, sectionId: number) => {
    try {
      const page = await pageActions.create(notebookId, sectionId, { title: "Untitled" });
      mutateNotebook();
      onSelectPage(page.id, notebookId);
    } catch (err) {
      console.error("Failed to create page:", err);
    }
  };

  const handleDeletePage = async (pageId: number) => {
    if (!confirm("Are you sure you want to delete this page?")) return;
    try {
      await pageActions.delete(pageId);
      mutateNotebook();
    } catch (err) {
      console.error("Failed to delete page:", err);
    }
  };

  const handleTogglePin = async (pageId: number) => {
    try {
      await pageActions.togglePin(pageId);
      mutateNotebook();
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-40", className)}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h2 className="font-semibold text-sm">Notebooks</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCreateNotebook}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Notebook List */}
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
    </div>
  );
}

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
}: NotebookItemProps) {
  const sections = selectedNotebook?.sections ?? [];

  return (
    <div className="mb-1">
      {/* Notebook Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50 rounded-sm mx-1",
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
        )}
      </div>

      {/* Sections (only show when notebook is selected) */}
      {isSelected && sections.length > 0 && (
        <div className="ml-4 mt-1">
          {sections.map((section) => (
            <SectionItem
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
            />
          ))}
        </div>
      )}
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
}: SectionItemProps) {
  const pages = section.pages ?? [];

  return (
    <div className="mb-0.5">
      {/* Section Header */}
      <div className="flex items-center gap-1 group">
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
}

function PageItem({ page, isSelected, onSelect, onDelete, onTogglePin }: PageItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-muted/50 rounded-sm group",
        isSelected && "bg-primary/10"
      )}
      onClick={onSelect}
    >
      {page.is_pinned ? (
        <Pin className="h-3 w-3 shrink-0 text-primary" />
      ) : (
        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
      <span className="text-xs truncate flex-1">{page.title}</span>

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
    </div>
  );
}
