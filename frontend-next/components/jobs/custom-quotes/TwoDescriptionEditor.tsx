"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface TwoDescriptionEditorProps {
  tenderDescription: string | null;
  poDescription: string | null;
  rfqInstructions?: string | null;
  onUpdate: (field: string, value: string) => void;
  readOnly?: boolean;
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

/** Wrap tender text with RFQ greeting, attached docs, quote breakdown, and sender signature */
function wrapAsRfq(
  tenderText: string,
  opts: {
    senderName?: string;
    senderTitle?: string;
    senderPhone?: string;
    senderEmail?: string;
    documentTypeNames?: string[];
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

  // Attached documents
  if (opts.documentTypeNames && opts.documentTypeNames.length > 0) {
    parts.push("Please find the following documents attached for quoting:");
    for (const name of opts.documentTypeNames) {
      parts.push(`  - ${name}`);
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

export function TwoDescriptionEditor({
  tenderDescription,
  poDescription,
  rfqInstructions,
  onUpdate,
  readOnly = false,
  documentTypeNames = [],
  poLineNames = [],
}: TwoDescriptionEditorProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [syncPo, setSyncPo] = useState(false);
  const [syncRfq, setSyncRfq] = useState(false);

  // Local state for immediate typing feedback
  const [localTender, setLocalTender] = useState(tenderDescription || "");
  const [localPo, setLocalPo] = useState(poDescription || "");
  const [localRfq, setLocalRfq] = useState(rfqInstructions || "");

  // Sync from props when they change externally
  useEffect(() => { setLocalTender(tenderDescription || ""); }, [tenderDescription]);
  useEffect(() => { setLocalPo(poDescription || ""); }, [poDescription]);
  useEffect(() => { setLocalRfq(rfqInstructions || ""); }, [rfqInstructions]);

  const debouncedSave = useDebouncedSave(onUpdate);

  const buildRfqText = useCallback((tenderText: string) => {
    return wrapAsRfq(tenderText, {
      senderName: user?.name,
      senderTitle: user?.job_title || undefined,
      senderPhone: user?.mobile_phone || undefined,
      senderEmail: user?.email,
      documentTypeNames,
      poLineNames,
    });
  }, [user, documentTypeNames, poLineNames]);

  const handleTenderChange = useCallback((value: string) => {
    setLocalTender(value);
    debouncedSave("tender_description", value);
    if (syncPo) {
      setLocalPo(value);
      debouncedSave("po_description", value);
    }
    if (syncRfq) {
      const rfqText = buildRfqText(value);
      setLocalRfq(rfqText);
      debouncedSave("rfq_instructions", rfqText);
    }
  }, [debouncedSave, syncPo, syncRfq, buildRfqText]);

  const handlePoChange = useCallback((value: string) => {
    setLocalPo(value);
    debouncedSave("po_description", value);
  }, [debouncedSave]);

  const handleRfqChange = useCallback((value: string) => {
    setLocalRfq(value);
    debouncedSave("rfq_instructions", value);
  }, [debouncedSave]);

  const handleSyncPoToggle = useCallback((checked: boolean | "indeterminate") => {
    const on = checked === true;
    setSyncPo(on);
    if (on) {
      setLocalPo(localTender);
      debouncedSave("po_description", localTender);
    }
  }, [localTender, debouncedSave]);

  const handleSyncRfqToggle = useCallback((checked: boolean | "indeterminate") => {
    const on = checked === true;
    setSyncRfq(on);
    if (on) {
      const rfqText = buildRfqText(localTender);
      setLocalRfq(rfqText);
      debouncedSave("rfq_instructions", rfqText);
    }
  }, [localTender, debouncedSave, buildRfqText]);

  if (!expanded) {
    const hasContent = localTender || localPo || localRfq;
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1"
      >
        <ChevronDown className="h-3 w-3" />
        {hasContent ? "Show descriptions" : "Add descriptions"}
      </button>
    );
  }

  return (
    <div className="space-y-3 py-2 pl-4 border-l-2 border-muted">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Descriptions</span>
        <Button size="sm" variant="ghost" className="h-5 px-1" onClick={() => setExpanded(false)}>
          <ChevronUp className="h-3 w-3" />
        </Button>
      </div>

      <div>
        <Label className="text-xs">Tender Description (client-facing)</Label>
        <Textarea
          value={localTender}
          onChange={(e) => handleTenderChange(e.target.value)}
          placeholder="Description for client tender documents..."
          className="mt-1 text-sm min-h-[60px]"
          readOnly={readOnly}
        />
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">PO Description (supplier-facing)</Label>
          {!readOnly && (
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer ml-auto">
              <Checkbox checked={syncPo} onCheckedChange={handleSyncPoToggle} className="h-3 w-3" />
              Copy from Tender
            </label>
          )}
        </div>
        <Textarea
          value={localPo}
          onChange={(e) => handlePoChange(e.target.value)}
          placeholder="Description for purchase order to supplier..."
          className={`mt-1 text-sm min-h-[60px] ${syncPo ? "opacity-60" : ""}`}
          readOnly={readOnly || syncPo}
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
          <Textarea
            value={localRfq}
            onChange={(e) => handleRfqChange(e.target.value)}
            placeholder="Special instructions for this RFQ..."
            className={`mt-1 text-sm min-h-[60px] ${syncRfq ? "opacity-60" : ""}`}
            readOnly={readOnly || syncRfq}
          />
        </div>
      )}
    </div>
  );
}
