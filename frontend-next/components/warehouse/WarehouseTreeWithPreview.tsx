"use client";

/**
 * WarehouseTreeWithPreview
 *
 * SSoT: THE ONE component for embedded warehouse tree contexts (Job, Contact, Corporate).
 * Owns all click/preview logic internally so callers just pass mode.
 *
 * Standard UX (enforced here, not by callers):
 *   Single click  → DocumentPreviewSheet drawer
 *   Double click  → open in new window
 *   Mailbox click → navigate to /email?mailbox=...
 *   Mailbox dbl   → open in new window
 *
 * Usage:
 *   <WarehouseTreeWithPreview mode={{ type: "context", entityType: "Job", entityId: id }} />
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { WarehouseTree } from "@/components/warehouse/WarehouseTree";
import { DocumentPreviewSheet } from "@/components/warehouse/DocumentPreviewSheet";
import type { DocumentItem, WarehouseTreeMode } from "@/components/warehouse/types";

interface WarehouseTreeWithPreviewProps {
  mode: WarehouseTreeMode;
}

export function WarehouseTreeWithPreview({ mode }: WarehouseTreeWithPreviewProps) {
  const router = useRouter();
  const [previewDoc, setPreviewDoc] = React.useState<DocumentItem | null>(null);
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mailboxTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFileClick = React.useCallback((doc: DocumentItem) => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { setPreviewDoc(doc); clickTimer.current = null; }, 200);
  }, []);

  const handleFileDoubleClick = React.useCallback((doc: DocumentItem) => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    if (doc.fileUrl) window.open(doc.fileUrl, "_blank");
  }, []);

  const handleMailboxClick = React.useCallback((email: string) => {
    if (mailboxTimer.current) clearTimeout(mailboxTimer.current);
    mailboxTimer.current = setTimeout(() => {
      router.push(`/email?mailbox=${encodeURIComponent(email)}`);
      mailboxTimer.current = null;
    }, 200);
  }, [router]);

  const handleMailboxDoubleClick = React.useCallback((link: string) => {
    if (mailboxTimer.current) { clearTimeout(mailboxTimer.current); mailboxTimer.current = null; }
    window.open(link, "_blank");
  }, []);

  return (
    <>
      <WarehouseTree
        mode={mode}
        onFileClick={handleFileClick}
        onFileDoubleClick={handleFileDoubleClick}
        onMailboxClick={handleMailboxClick}
        onMailboxDoubleClick={handleMailboxDoubleClick}
        selectedDocument={previewDoc}
      />
      <DocumentPreviewSheet
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onOpenInNewWindow={(doc) => { if (doc.fileUrl) window.open(doc.fileUrl, "_blank"); }}
      />
    </>
  );
}
