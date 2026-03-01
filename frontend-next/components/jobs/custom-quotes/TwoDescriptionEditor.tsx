"use client";

import { useState, useCallback, useEffect, useRef, type TextareaHTMLAttributes } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RfqAttachmentPreview, type RfqGroupedDocs, type RfqDocument } from "./RfqAttachmentPreview";
import { useAuth } from "@/contexts/AuthContext";

interface TwoDescriptionEditorProps {
  tenderDescription: string | null;
  poDescription: string | null;
  rfqInstructions?: string | null;
  onUpdate: (field: string, value: string) => void;
  readOnly?: boolean;
  /** Job ID for fetching actual documents */
  jobId?: string | number;
  /** Document type IDs selected on this line */
  documentTypeIds?: number[];
  /** Document type names selected on this line (for RFQ context) */
  documentTypeNames?: string[];
  /** PO child line names (for RFQ quote breakdown) */
  poLineNames?: string[];
}

function useDebouncedSave(onUpdate: (field: string, value: string) => void, delay = 500) {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const save = useCallback((field: string, value: string) => {
    if (timers.current[field]) clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(() => {
      onUpdate(field, value);
    }, delay);
  }, [onUpdate, delay]);

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  return save;
}

/** Format a document for display in the RFQ text: "filename (Rev X)" */
function formatDocForRfq(doc: RfqDocument): string {
  const name = doc.originalFilename || doc.name;
  // Strip file extension for cleaner display
  const base = name.replace(/\.[^.]+$/, "");
  if (doc.versionLetter) {
    return `${base} (Rev ${doc.versionLetter})`;
  }
  return base;
}

/** Wrap tender text with RFQ greeting, attached docs, quote breakdown, and sender signature */
function wrapAsRfq(
  tenderText: string,
  opts: {
    senderName?: string;
    senderTitle?: string;
    senderPhone?: string;
    senderEmail?: string;
    /** Actual matched documents grouped by type name - only types with files in the job */
    attachedDocuments?: Array<{ typeName: string; docs: RfqDocument[] }>;
    poLineNames?: string[];
  }
): string {
  const parts: string[] = [];

  // Greeting
  parts.push("Hi {Name},\n");

  // Body from tender
  if (tenderText.trim()) {
    parts.push(tenderText.trim() + "\n");
  }

  // Attached documents - ONLY those that actually exist in the job
  if (opts.attachedDocuments && opts.attachedDocuments.length > 0) {
    parts.push("Please find the following documents attached for quoting:");
    for (const { docs } of opts.attachedDocuments) {
      for (const doc of docs) {
        parts.push(`  - ${formatDocForRfq(doc)}`);
      }
    }
    parts.push("");
  }

  // Quote breakdown by PO tasks
  if (opts.poLineNames && opts.poLineNames.length > 0) {
    parts.push("Please provide your quote broken down as follows:");
    for (const name of opts.poLineNames) {
      parts.push(`  - ${name}`);
    }
    parts.push("");
  }

  // Signature
  const sigParts: string[] = ["Kind regards,"];
  if (opts.senderName) sigParts.push(opts.senderName);
  if (opts.senderTitle) sigParts.push(opts.senderTitle);
  if (opts.senderPhone) sigParts.push(opts.senderPhone);
  if (opts.senderEmail) sigParts.push(opts.senderEmail);
  parts.push(sigParts.join("\n"));

  return parts.join("\n");
}

/** Textarea that auto-grows with content */
function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => { resize(); }, [props.value, resize]);

  return (
    <Textarea
      {...props}
      ref={ref}
      onInput={resize}
      style={{ ...props.style, overflow: "hidden", resize: "none" }}
    />
  );
}

export function TwoDescriptionEditor({
  tenderDescription,
  poDescription,
  rfqInstructions,
  onUpdate,
  readOnly = false,
  jobId,
  documentTypeIds = [],
  documentTypeNames = [],
  poLineNames = [],
}: TwoDescriptionEditorProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [syncRfq, setSyncRfq] = useState(false);

  // Local state for immediate typing feedback
  const [localTender, setLocalTender] = useState(tenderDescription || "");
  const [localRfq, setLocalRfq] = useState(rfqInstructions || "");

  // Live document data from RfqAttachmentPreview
  const [liveGroupedDocs, setLiveGroupedDocs] = useState<RfqGroupedDocs | null>(null);

  // Sync from props when they change externally
  useEffect(() => { setLocalTender(tenderDescription || ""); }, [tenderDescription]);
  useEffect(() => { setLocalRfq(rfqInstructions || ""); }, [rfqInstructions]);

  const debouncedSave = useDebouncedSave(onUpdate);

  // Build the list of attached documents (only types with actual files)
  const getAttachedDocuments = useCallback((): Array<{ typeName: string; docs: RfqDocument[] }> | undefined => {
    if (!liveGroupedDocs) return undefined;
    const result: Array<{ typeName: string; docs: RfqDocument[] }> = [];
    for (let i = 0; i < documentTypeIds.length; i++) {
      const typeId = documentTypeIds[i];
      const typeName = documentTypeNames[i] || `Type ${typeId}`;
      const docs = liveGroupedDocs[typeId] || [];
      if (docs.length > 0) {
        result.push({ typeName, docs });
      }
    }
    return result.length > 0 ? result : undefined;
  }, [liveGroupedDocs, documentTypeIds, documentTypeNames]);

  const buildRfqText = useCallback((tenderText: string) => {
    return wrapAsRfq(tenderText, {
      senderName: user?.name,
      senderTitle: user?.job_title || undefined,
      senderPhone: user?.mobile_phone || undefined,
      senderEmail: user?.email,
      attachedDocuments: getAttachedDocuments(),
      poLineNames,
    });
  }, [user, getAttachedDocuments, poLineNames]);

  const handleTenderChange = useCallback((value: string) => {
    setLocalTender(value);
    debouncedSave("tender_description", value);
    if (syncRfq) {
      const rfqText = buildRfqText(value);
      setLocalRfq(rfqText);
      debouncedSave("rfq_instructions", rfqText);
    }
  }, [debouncedSave, syncRfq, buildRfqText]);

  const handleRfqChange = useCallback((value: string) => {
    setLocalRfq(value);
    debouncedSave("rfq_instructions", value);
  }, [debouncedSave]);

  const handleSyncRfqToggle = useCallback((checked: boolean | "indeterminate") => {
    const on = checked === true;
    setSyncRfq(on);
    if (on) {
      const rfqText = buildRfqText(localTender);
      setLocalRfq(rfqText);
      debouncedSave("rfq_instructions", rfqText);
    }
  }, [localTender, debouncedSave, buildRfqText]);

  // When live documents load and sync is on, rebuild RFQ text
  const handleDocumentsLoaded = useCallback((grouped: RfqGroupedDocs) => {
    setLiveGroupedDocs(grouped);
  }, []);

  // Re-sync RFQ text when live documents change (if sync is on)
  useEffect(() => {
    if (syncRfq && liveGroupedDocs) {
      const rfqText = buildRfqText(localTender);
      setLocalRfq(rfqText);
      debouncedSave("rfq_instructions", rfqText);
    }
  }, [liveGroupedDocs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!expanded) {
    const hasContent = localTender || localRfq;
    return (
      <div
        className="flex items-center gap-1.5 cursor-pointer group py-1"
        onClick={() => setExpanded(true)}
      >
        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground group-hover:text-foreground">
          {hasContent ? "Descriptions" : "Add descriptions"}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      <div
        className="flex items-center gap-1.5 cursor-pointer group"
        onClick={() => setExpanded(false)}
      >
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">Descriptions</span>
      </div>

      <div>
        <Label className="text-xs">Tender Description (client-facing)</Label>
        <AutoTextarea
          value={localTender}
          onChange={(e) => handleTenderChange(e.target.value)}
          placeholder="Description for client tender documents..."
          className="mt-1 text-sm min-h-[36px]"
          readOnly={readOnly}
        />
      </div>

      {rfqInstructions !== undefined && (
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">RFQ Instructions</Label>
            {!readOnly && (
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer ml-auto">
                <Checkbox checked={syncRfq} onCheckedChange={handleSyncRfqToggle} className="h-3 w-3" />
                Copy from Tender
              </label>
            )}
          </div>
          <AutoTextarea
            value={localRfq}
            onChange={(e) => handleRfqChange(e.target.value)}
            placeholder="Special instructions for this RFQ..."
            className={`mt-1 text-sm min-h-[36px] ${syncRfq ? "opacity-60" : ""}`}
            readOnly={readOnly || syncRfq}
          />
        </div>
      )}

      {/* Attachments preview - shows which doc types have actual files in the job */}
      {jobId && documentTypeIds.length > 0 && (
        <RfqAttachmentPreview
          jobId={jobId}
          documentTypeIds={documentTypeIds}
          documentTypeNames={documentTypeNames}
          onDocumentsLoaded={handleDocumentsLoaded}
        />
      )}
    </div>
  );
}
