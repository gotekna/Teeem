"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Paperclip, Check, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { AttachmentBadge } from "@/components/ui/attachment-badge";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface RfqDocument {
  id: number;
  name: string;
  folder: string | null;
  contentType: string | null;
  size: number | null;
}

interface RfqAttachmentPreviewProps {
  jobId: string | number;
  /** Document type IDs selected on this line */
  documentTypeIds: number[];
  /** Document type names (parallel array with documentTypeIds) */
  documentTypeNames: string[];
}

/**
 * RfqAttachmentPreview - Shows which document types have actual files in the job.
 *
 * Top section: types WITH matching files (will be attached to RFQ)
 * Bottom section: types WITHOUT files (warning for missing docs)
 */
export function RfqAttachmentPreview({
  jobId,
  documentTypeIds,
  documentTypeNames,
}: RfqAttachmentPreviewProps) {
  const [grouped, setGrouped] = useState<Record<number, RfqDocument[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const prevKeyRef = useRef<string>("");

  const fetchGrouped = useCallback(async () => {
    if (documentTypeIds.length === 0) {
      setGrouped(null);
      return;
    }

    const key = `${jobId}:${documentTypeIds.sort().join(",")}`;
    if (key === prevKeyRef.current && grouped !== null) return;
    prevKeyRef.current = key;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const id of documentTypeIds) {
        params.append("document_type_ids[]", String(id));
      }
      const res = await api.get<{
        success: boolean;
        data: Record<number, RfqDocument[]>;
      }>(`/api/v1/jobs/${jobId}/rfq_documents?${params.toString()}`);

      if (res?.data) {
        setGrouped(res.data);
      }
    } catch {
      // Silently fail - the badges will just not show file counts
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
