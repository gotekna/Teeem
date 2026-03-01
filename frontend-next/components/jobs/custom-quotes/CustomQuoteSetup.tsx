"use client";

import { Button } from "@/components/ui/button";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { Calendar, Info, Package, Plus, Save, Trash2, Upload } from "lucide-react";
import type { CustomQuoteTemplate } from "./types";
import type { PoTemplatePackSummary } from "./useCustomQuote";

interface CustomQuoteSetupProps {
  jobId: string | number;
  templates: CustomQuoteTemplate[];
  templatesLoading: boolean;
  packs: PoTemplatePackSummary[];
  packsLoading: boolean;
  smTaskCount: number;
  existingPoCount: number;
  onApplyTemplate: (templateId: number) => void;
  onCreateBlank: () => void;
  onPopulateFromSchedule: () => void;
  onApplyPack: (packId: number) => void;
  onSaveAsTemplate: () => void;
  onOverwriteTemplate: () => void;
  onDeleteQuote: () => void;
  activeTemplateName: string | null;
  hasActiveQuote: boolean;
  hasLinkedTemplate: boolean;
}

export function CustomQuoteSetup({
  templates,
  templatesLoading,
  packs,
  packsLoading,
  smTaskCount,
  existingPoCount,
  onApplyTemplate,
  onCreateBlank,
  onPopulateFromSchedule,
  onApplyPack,
  onSaveAsTemplate,
  onOverwriteTemplate,
  onDeleteQuote,
  hasActiveQuote,
  hasLinkedTemplate,
}: CustomQuoteSetupProps) {
  const templateItems: ComboboxItem[] = templates.map((t) => ({
    id: String(t.id),
    label: `${t.name} (${t.lineCount} lines)`,
  }));

  const packItems: ComboboxItem[] = packs.map((p) => ({
    id: String(p.id),
    label: `${p.name} (${p.itemCount} POs)`,
  }));

  const hasSmTasks = smTaskCount > 0;
  const hasExistingPos = existingPoCount > 0;

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-muted/50 border-b">
      {/* Create options when no quote exists */}
      {!hasActiveQuote && (
        <div className="flex flex-col gap-2">
          {/* Smart info bar */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            {hasSmTasks ? (
              <span>
                This job has <strong className="text-foreground">{smTaskCount}</strong> schedule tasks
                {hasExistingPos && (
                  <> and <strong className="text-foreground">{existingPoCount}</strong> existing POs</>
                )}
              </span>
            ) : (
              <span>
                No schedule tasks found.
                {hasExistingPos
                  ? <> This job has <strong className="text-foreground">{existingPoCount}</strong> existing POs.</>
                  : <> Select a PO template pack or create a blank quote.</>
                }
              </span>
            )}
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-3">
            {/* Primary action: From Schedule (if SmTasks exist) */}
            {hasSmTasks && (
              <Button size="sm" variant="default" onClick={onPopulateFromSchedule}>
                <Calendar className="h-4 w-4 mr-1" />
                From Schedule ({smTaskCount})
              </Button>
            )}

            {/* PO Pack picker (prominent if no SmTasks, secondary if SmTasks exist) */}
            <ComboboxDropdown
              items={packItems}
              onSelect={(item) => onApplyPack(Number(item.id))}
              placeholder={hasSmTasks ? "Or from PO Pack..." : "From PO Pack..."}
              className="w-64"
              disabled={packsLoading}
            />

            {/* Template picker */}
            <ComboboxDropdown
              items={templateItems}
              onSelect={(item) => onApplyTemplate(Number(item.id))}
              placeholder="Apply template..."
              className="w-64"
              disabled={templatesLoading}
            />

            {/* Blank quote */}
            <Button size="sm" variant="outline" onClick={onCreateBlank}>
              <Plus className="h-4 w-4 mr-1" />
              Blank
            </Button>
          </div>
        </div>
      )}

      {/* Active quote actions */}
      {hasActiveQuote && (
        <div className="flex items-center gap-3">
          {hasLinkedTemplate && (
            <Button size="sm" variant="outline" onClick={onOverwriteTemplate}>
              <Upload className="h-4 w-4 mr-1" />
              Save to Template
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={onSaveAsTemplate}>
            <Save className="h-4 w-4 mr-1" />
            Save as Template
          </Button>

          <div className="ml-auto">
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (window.confirm("Delete this custom quote? This cannot be undone.")) {
                  onDeleteQuote();
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Quote
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
