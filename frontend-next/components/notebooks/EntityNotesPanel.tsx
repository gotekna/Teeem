"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Notebook, FileText, ChevronRight } from "lucide-react";
import {
  useNotebooks,
  useNotebook,
  notebookActions,
  sectionActions,
  type Notebook as NotebookType,
} from "./hooks/useNotebooks";
import { pageActions, type NotebookPage } from "./hooks/useNotebookPage";
import { NotebookEditor } from "./NotebookEditor";
import { NotebookCreateModal } from "./NotebookCreateModal";

interface EntityNotesPanelProps {
  entityType: string; // "Job", "Contact", etc.
  entityId: number;
  entityName?: string;
  className?: string;
}

export function EntityNotesPanel({
  entityType,
  entityId,
  entityName,
  className,
}: EntityNotesPanelProps) {
  const queryClient = useQueryClient();
  const {
    notebooks,
    isLoading,
    mutate: mutateNotebooks,
  } = useNotebooks({
    notable_type: entityType,
    notable_id: entityId,
  });

  const [selectedNotebookId, setSelectedNotebookId] = useState<number | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { notebook: selectedNotebook, mutate: mutateNotebook } = useNotebook(
    selectedNotebookId
  );

  // Auto-select first notebook if none selected
  React.useEffect(() => {
    if (notebooks.length > 0 && !selectedNotebookId) {
      setSelectedNotebookId(notebooks[0].id);
    }
  }, [notebooks, selectedNotebookId]);

  const handleCreateNotebook = useCallback(
    async (notebook: NotebookType) => {
      // Invalidate all notebook queries to ensure list updates
      await queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      setSelectedNotebookId(notebook.id);
      setSelectedPageId(null);
    },
    [queryClient]
  );

  const handleCreatePage = async (sectionId: number) => {
    if (!selectedNotebookId) return;
    try {
      const page = await pageActions.create(selectedNotebookId, sectionId, {
        title: "Untitled",
      });
      await queryClient.invalidateQueries({ queryKey: ["notebook", selectedNotebookId] });
      setSelectedPageId(page.id);
    } catch (err) {
      console.error("Failed to create page:", err);
    }
  };

  const handleQuickNote = async () => {
    // Create a notebook if none exists, then add a page
    if (notebooks.length === 0) {
      setShowCreateModal(true);
      return;
    }

    const notebook = notebooks[0];
    const section = notebook.sections?.[0];

    if (!section) {
      // Create a default section first
      try {
        const newSection = await sectionActions.create(notebook.id, {
          name: "General",
        });
        const page = await pageActions.create(notebook.id, newSection.id, {
          title: `Note - ${new Date().toLocaleDateString()}`,
        });
        await queryClient.invalidateQueries({ queryKey: ["notebooks"] });
        await queryClient.invalidateQueries({ queryKey: ["notebook", notebook.id] });
        setSelectedNotebookId(notebook.id);
        setSelectedPageId(page.id);
      } catch (err) {
        console.error("Failed to create quick note:", err);
      }
    } else {
      try {
        const page = await pageActions.create(notebook.id, section.id, {
          title: `Note - ${new Date().toLocaleDateString()}`,
        });
        await queryClient.invalidateQueries({ queryKey: ["notebook", notebook.id] });
        setSelectedPageId(page.id);
      } catch (err) {
        console.error("Failed to create quick note:", err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-64", className)}>
        <Spinner />
      </div>
    );
  }

  // Empty state
  if (notebooks.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-64 text-center", className)}>
        <Notebook className="h-12 w-12 mb-4 text-muted-foreground/50" />
        <h3 className="text-sm font-medium mb-1">No notes yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create a notebook to start taking notes for this {entityType.toLowerCase()}
        </p>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Notebook
        </Button>

        <NotebookCreateModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onCreated={handleCreateNotebook}
          notableType={entityType}
          notableId={entityId}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
          <span className="text-sm text-muted-foreground">
            {notebooks.length} notebook{notebooks.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleQuickNote}>
            <Plus className="h-4 w-4 mr-1" />
            Quick Note
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCreateModal(true)}>
            <Notebook className="h-4 w-4 mr-1" />
            New Notebook
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* Sidebar - notebooks and pages list */}
        <Card className="col-span-4 overflow-auto p-3">
          {notebooks.map((notebook) => (
            <NotebookListItem
              key={notebook.id}
              notebook={notebook}
              isSelected={selectedNotebookId === notebook.id}
              selectedNotebook={selectedNotebookId === notebook.id ? selectedNotebook : null}
              selectedPageId={selectedPageId}
              onSelect={() => {
                setSelectedNotebookId(notebook.id);
                setSelectedPageId(null);
              }}
              onSelectPage={(pageId) => setSelectedPageId(pageId)}
              onCreatePage={handleCreatePage}
            />
          ))}
        </Card>

        {/* Editor */}
        <Card className="col-span-8 overflow-hidden">
          <NotebookEditor pageId={selectedPageId} notebookId={selectedNotebookId} className="h-full" />
        </Card>
      </div>

      <NotebookCreateModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreated={handleCreateNotebook}
        notableType={entityType}
        notableId={entityId}
      />
    </div>
  );
}

interface NotebookListItemProps {
  notebook: NotebookType;
  isSelected: boolean;
  selectedNotebook: NotebookType | null;
  selectedPageId: number | null;
  onSelect: () => void;
  onSelectPage: (pageId: number) => void;
  onCreatePage: (sectionId: number) => void;
}

function NotebookListItem({
  notebook,
  isSelected,
  selectedNotebook,
  selectedPageId,
  onSelect,
  onSelectPage,
  onCreatePage,
}: NotebookListItemProps) {
  const [isExpanded, setIsExpanded] = useState(isSelected);

  React.useEffect(() => {
    if (isSelected) setIsExpanded(true);
  }, [isSelected]);

  const sections = selectedNotebook?.sections ?? [];

  return (
    <div className="mb-2">
      {/* Notebook header */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/50",
          isSelected && "bg-muted"
        )}
        onClick={() => {
          onSelect();
          setIsExpanded(!isExpanded);
        }}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            isExpanded && "rotate-90"
          )}
        />
        <Notebook
          className="h-4 w-4 shrink-0"
          style={{ color: notebook.color || undefined }}
        />
        <span className="text-sm font-medium truncate flex-1">{notebook.name}</span>
        <span className="text-xs text-muted-foreground">{notebook.page_count}</span>
      </div>

      {/* Sections and pages */}
      {isExpanded && isSelected && sections.length > 0 && (
        <div className="ml-6 mt-1 space-y-1">
          {sections.map((section) => (
            <div key={section.id}>
              <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                {section.name}
              </div>
              {section.pages?.map((page) => (
                <div
                  key={page.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-muted/50 text-sm",
                    selectedPageId === page.id && "bg-primary/10"
                  )}
                  onClick={() => onSelectPage(page.id)}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{page.title}</span>
                </div>
              ))}
              <button
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onCreatePage(section.id)}
              >
                <Plus className="h-3 w-3" />
                Add page
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
