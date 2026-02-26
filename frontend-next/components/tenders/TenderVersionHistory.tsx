"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/formatters";

interface TenderDocumentSummary {
  id: number;
  document_number: string;
  version: number;
  status: string;
  date_prepared: string;
  total: number;
  client_name: string | null;
  created_by_name: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  revision_notes: string | null;
  has_pdf: boolean;
  pdf_status: string | null;
  item_count: number;
  created_at: string;
}

interface TenderVersionHistoryProps {
  documents: TenderDocumentSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  locked: "Locked",
  sent: "Sent",
  revision_requested: "Revision Requested",
  accepted: "Accepted",
  declined: "Declined",
  superseded: "Superseded",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  locked: "secondary",
  sent: "default",
  revision_requested: "destructive",
  accepted: "default",
  declined: "destructive",
  superseded: "outline",
};

export function TenderVersionHistory({ documents, selectedId, onSelect }: TenderVersionHistoryProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No tender documents yet.</p>
        <p className="text-sm mt-1">Create your first tender to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <button
          key={doc.id}
          onClick={() => onSelect(doc.id)}
          className={`w-full text-left p-3 rounded-lg border transition-colors ${
            selectedId === doc.id
              ? "border-primary bg-primary/5 dark:bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-sm">
              Version {doc.version}
            </span>
            <Badge variant={STATUS_VARIANTS[doc.status] || "outline"}>
              {STATUS_LABELS[doc.status] || doc.status}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {doc.date_prepared}
              {doc.created_at && ` ${new Date(doc.created_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Australia/Brisbane" })}`}
              {" · "}{doc.item_count} items
            </span>
            <span className="font-semibold text-foreground">{formatCurrency(doc.total)}</span>
          </div>
          {doc.revision_notes && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 truncate">
              {doc.revision_notes}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}

export type { TenderDocumentSummary };
