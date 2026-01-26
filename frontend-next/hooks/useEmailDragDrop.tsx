"use client";

import * as React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { api } from "@/lib/api";

interface DraggedEmail {
  id: number;
  subject: string;
  from_email: string;
  accountId: string;
  accountType: "imap" | "outlook" | "ms365";
  sourceFolder?: string;
  uid?: number;
}

interface EmailDragDropContextType {
  isDragging: boolean;
  draggedEmail: DraggedEmail | null;
  isMoving: boolean;
}

const EmailDragDropContext = createContext<EmailDragDropContextType>({
  isDragging: false,
  draggedEmail: null,
  isMoving: false,
});

export function useEmailDragDropContext() {
  return useContext(EmailDragDropContext);
}

interface EmailDragDropProviderProps {
  children: React.ReactNode;
  onMoveComplete?: () => void;
}

export function EmailDragDropProvider({
  children,
  onMoveComplete,
}: EmailDragDropProviderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedEmail, setDraggedEmail] = useState<DraggedEmail | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Configure sensors with activation constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DraggedEmail | undefined;
    if (data) {
      setDraggedEmail(data);
      setIsDragging(true);
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setIsDragging(false);

      if (!over || !draggedEmail) {
        setDraggedEmail(null);
        return;
      }

      // Get folder data from droppable
      const folderData = over.data.current as {
        folderId: string;
        folderName: string;
      } | undefined;

      if (!folderData) {
        setDraggedEmail(null);
        return;
      }

      // Move the email to the folder
      setIsMoving(true);
      try {
        if (draggedEmail.accountType === "imap") {
          if (!draggedEmail.uid) {
            console.error("UID required for IMAP move");
            return;
          }
          await api.post(
            `/api/v1/imap_credentials/${draggedEmail.accountId}/move_email`,
            {
              uid: draggedEmail.uid,
              destination_folder: folderData.folderName,
              source_folder: draggedEmail.sourceFolder || "INBOX",
            }
          );
        } else {
          // For Outlook/MS365
          await api.post(
            `/api/v1/synced_emails/${draggedEmail.id}/move_to_folder`,
            {
              folder_id: folderData.folderId,
              folder_name: folderData.folderName,
            }
          );
        }
        onMoveComplete?.();
      } catch (error) {
        console.error("Failed to move email:", error);
      } finally {
        setIsMoving(false);
        setDraggedEmail(null);
      }
    },
    [draggedEmail, onMoveComplete]
  );

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setDraggedEmail(null);
  }, []);

  return (
    <EmailDragDropContext.Provider value={{ isDragging, draggedEmail, isMoving }}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {isDragging && draggedEmail && (
            <div className="bg-background border rounded-md shadow-lg px-3 py-2 max-w-[300px]">
              <div className="text-sm font-medium truncate">
                {draggedEmail.subject || "(No subject)"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {draggedEmail.from_email}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </EmailDragDropContext.Provider>
  );
}

// Draggable email wrapper component
import { useDraggable } from "@dnd-kit/core";

interface DraggableEmailProps {
  email: {
    id: number;
    subject: string;
    from_email?: string;
    from_address?: string;
  };
  accountId: string;
  accountType: "imap" | "outlook" | "ms365";
  sourceFolder?: string;
  uid?: number;
  children: React.ReactNode;
  disabled?: boolean;
}

export function DraggableEmail({
  email,
  accountId,
  accountType,
  sourceFolder,
  uid,
  children,
  disabled = false,
}: DraggableEmailProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `email-${email.id}`,
    data: {
      id: email.id,
      subject: email.subject,
      from_email: email.from_email || email.from_address,
      accountId,
      accountType,
      sourceFolder,
      uid,
    } as DraggedEmail,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      {children}
    </div>
  );
}

// Droppable folder wrapper component
import { useDroppable } from "@dnd-kit/core";

interface DroppableFolderProps {
  folderId: string;
  folderName: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function DroppableFolder({
  folderId,
  folderName,
  children,
  disabled = false,
}: DroppableFolderProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder-${folderId}`,
    data: {
      folderId,
      folderName,
    },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={isOver ? "bg-primary/20 rounded-sm" : ""}
    >
      {children}
    </div>
  );
}

export default EmailDragDropProvider;
