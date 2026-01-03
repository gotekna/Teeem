"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Notebook } from "lucide-react";
import {
  NotebooksSidebar,
  NotebookEditor,
  NotebookCreateModal,
  useNotebooks,
} from "@/components/notebooks";

export default function NotebooksPage() {
  // Use full-height layout mode for split view
  useSetLayoutMode("full-height");

  const { mutate: mutateNotebooks } = useNotebooks({ global: true });
  const [selectedNotebookId, setSelectedNotebookId] = useState<number | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleSelectNotebook = useCallback((notebookId: number) => {
    setSelectedNotebookId(notebookId);
    setSelectedPageId(null);
  }, []);

  const handleSelectPage = useCallback((pageId: number, notebookId: number) => {
    setSelectedNotebookId(notebookId);
    setSelectedPageId(pageId);
  }, []);

  const handleNotebookCreated = useCallback(
    (notebook: { id: number }) => {
      mutateNotebooks();
      setSelectedNotebookId(notebook.id);
      setSelectedPageId(null);
    },
    [mutateNotebooks]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between py-2 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <Notebook className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Notes</h1>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Notebook
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
        {/* Sidebar */}
        <Card className="col-span-3 flex flex-col min-h-0">
          <NotebooksSidebar
            selectedNotebookId={selectedNotebookId}
            selectedPageId={selectedPageId}
            onSelectNotebook={handleSelectNotebook}
            onSelectPage={handleSelectPage}
            onCreateNotebook={() => setShowCreateModal(true)}
            className="h-full"
          />
        </Card>

        {/* Editor */}
        <Card className="col-span-9 flex flex-col min-h-0">
          <NotebookEditor pageId={selectedPageId} className="h-full" />
        </Card>
      </div>

      {/* Create Notebook Modal */}
      <NotebookCreateModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreated={handleNotebookCreated}
      />
    </div>
  );
}
