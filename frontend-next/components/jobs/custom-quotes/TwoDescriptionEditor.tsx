"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TwoDescriptionEditorProps {
  tenderDescription: string | null;
  poDescription: string | null;
  rfqInstructions?: string | null;
  onUpdate: (field: string, value: string) => void;
  readOnly?: boolean;
}

export function TwoDescriptionEditor({
  tenderDescription,
  poDescription,
  rfqInstructions,
  onUpdate,
  readOnly = false,
}: TwoDescriptionEditorProps) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    const hasContent = tenderDescription || poDescription || rfqInstructions;
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
          value={tenderDescription || ""}
          onChange={(e) => onUpdate("tender_description", e.target.value)}
          placeholder="Description for client tender documents..."
          className="mt-1 text-sm min-h-[60px]"
          readOnly={readOnly}
        />
      </div>

      <div>
        <Label className="text-xs">PO Description (supplier-facing)</Label>
        <Textarea
          value={poDescription || ""}
          onChange={(e) => onUpdate("po_description", e.target.value)}
          placeholder="Description for purchase order to supplier..."
          className="mt-1 text-sm min-h-[60px]"
          readOnly={readOnly}
        />
      </div>

      {rfqInstructions !== undefined && (
        <div>
          <Label className="text-xs">RFQ Instructions</Label>
          <Textarea
            value={rfqInstructions || ""}
            onChange={(e) => onUpdate("rfq_instructions", e.target.value)}
            placeholder="Special instructions for this RFQ..."
            className="mt-1 text-sm min-h-[60px]"
            readOnly={readOnly}
          />
        </div>
      )}
    </div>
  );
}
