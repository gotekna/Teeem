"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Paperclip, Check, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { AttachmentBadge } from "@/components/ui/attachment-badge";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

export interface RfqDocument {
  id: number;
  name: string;
  originalFilename: string | null;
  folder: string | null;
  contentType: string | null;
  size: number | null;
  versionLetter: string | null;
  versionNumber: number | null;
}

/** Grouped data: document type ID → matched documents */
export type RfqGroupedDocs = Record<number, RfqDocument[]>;

interface RfqAttachmentPreviewProps {
  jobId: string | number;
  /** Document type IDs selected on this line */
  documentTypeIds: number[];
  /** Document type names (parallel array with documentTypeIds) */
  documentTypeNames: string[];
  /** Called when document data loads/changes - provides grouped docs for RFQ text */
  onDocumentsLoaded?: (grouped: RfqGroupedDocs) => void;
}

/**
 * RfqAttachmentPreview - Shows which document types have actual files in the job.
 *
 * Top section: types WITH matching files (will be attached to RFQ)
 * Bottom section: types WITHOUT files (warning for missing docs)
 *
 * Also exposes matched document data via onDocumentsLoaded for use
 * in RFQ instruction text generation.
 */
export function RfqAttachmentPreview({
  jobId,
  documentTypeIds,
  documentTypeNames,
  onDocumentsLoaded,
}: RfqAttachmentPreviewProps) {
  const [grouped, setGrouped] = useState<RfqGroupedDocs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevKeyRef = useRef<string>("");
  const onDocumentsLoadedRef = useRef(onDocumentsLoaded);
  onDocumentsLoadedRef.current = onDocumentsLoaded;

  const fetchGrouped = useCallback(async () => {
    if (documentTypeIds.length === 0) {
      setGrouped(null);
      return;
    }

    const key = `${jobId}:${[...documentTypeIds].sort().join(",")}`;
    if (key === prevKeyRef.current && grouped !== null) return;
    prevKeyRef.current = key;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const id of documentTypeIds) {
        params.append("document_type_ids[]", String(id));
      }
      const url = `/api/v1/jobs/${jobId}/rfq_documents?${params.toString()}`;
      console.log("[RfqAttachmentPreview] Fetching:", url, "typeIds:", documentTypeIds);

      const res = await api.get<{
        success: boolean;
        data: RfqGroupedDocs;
      }>(url);

      console.log("[RfqAttachmentPreview] API response:", JSON.stringify(res));

      if (res?.data) {
        // Log which types have matches
        const summary = Object.entries(res.data).map(([k, v]) => `${k}:${(v as RfqDocument[]).length}`).join(", ");
        console.log("[RfqAttachmentPreview] Grouped summary:", summary);
        setGrouped(res.data);
        onDocumentsLoadedRef.current?.(res.data);
      } else {
        const msg = `No data in response: ${JSON.stringify(res)}`;
        console.warn("[RfqAttachmentPreview]", msg);
        setError(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[RfqAttachmentPreview] Failed to fetch:", msg, err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [jobId, documentTypeIds, grouped]);

  useEffect(() => {
    fetchGrouped();
  }, [fetchGrouped]);

  if (documentTypeIds.length === 0) return null;

  // Build lists: types with files vs types without
  const withFiles: Array<{ typeId: number; name: string; docs: RfqDocument[] }> = [];
  const withoutFiles: Array<{ typeId: number; name: string }> = [];

  for (let i = 0; i < documentTypeIds.length; i++) {
    const typeId = documentTypeIds[i];
    const name = documentTypeNames[i] || `Type ${typeId}`;
    const docs = grouped?.[typeId] || [];

    if (docs.length > 0) {
      withFiles.push({ typeId, name, docs });
    } else {
      withoutFiles.push({ typeId, name });
    }
  }

  const totalFiles = withFiles.reduce((sum, g) => sum + g.docs.length, 0);

  return (
    <div>
      <Label className="text-xs flex items-center gap-1">
        <Paperclip className="h-3 w-3" />
        RFQ Attachments
        {loading && <Spinner className="h-3 w-3 ml-1" />}
      </Label>

      {/* Error display */}
      {error && (
        <div className="mt-1 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-[10px] text-red-600 dark:text-red-400">
          API Error: {error}
        </div>
      )}

      {/* Types WITH files - will be attached */}
      {withFiles.length > 0 && (
        <div className="mt-1.5">
          <div className="flex items-center gap-1 mb-1">
            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
            <span className="text-[10px] text-green-700 dark:text-green-400 font-medium">
              Will attach ({totalFiles} file{totalFiles !== 1 ? "s" : ""})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {withFiles.map(({ typeId, name, docs }) => (
              <AttachmentBadge
                key={typeId}
                displayName={`${name} (${docs.length})`}
                size="xs"
                variant="success"
              />
            ))}
          </div>
        </div>
      )}

      {/* Types WITHOUT files - won't attach */}
      {withoutFiles.length > 0 && !loading && (
        <div className={withFiles.length > 0 ? "mt-2" : "mt-1.5"}>
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3 w-3 text-amber-500 dark:text-amber-400" />
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              No files found ({withoutFiles.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {withoutFiles.map(({ typeId, name }) => (
              <AttachmentBadge
                key={typeId}
                displayName={name}
                size="xs"
                variant="muted"
              />
            ))}
          </div>
        </div>
      )}

      {/* Still loading, show all as muted */}
      {loading && grouped === null && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {documentTypeNames.map((name) => (
            <AttachmentBadge
              key={name}
              displayName={name}
              size="xs"
              variant="muted"
              loading
            />
          ))}
        </div>
      )}
    </div>
  );
}
