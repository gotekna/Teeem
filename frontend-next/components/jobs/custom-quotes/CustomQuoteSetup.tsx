"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { Calendar, ChevronDown, Package, Plus, Save, Trash2, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const hasSmTasks = smTaskCount > 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b">
      {/* Create options when no quote exists */}
      {!hasActiveQuote && (
        <>
          {/* Primary action based on what the job has */}
          {hasSmTasks ? (
            <Button size="sm" onClick={onPopulateFromSchedule}>
              <Calendar className="h-4 w-4 mr-1" />
              From Current Schedule ({smTaskCount} tasks)
            </Button>
          ) : (
            <PackPicker
              packs={packs}
              packsLoading={packsLoading}
              onApplyPack={onApplyPack}
            />
          )}

          {/* Divider */}
          <span className="text-muted-foreground text-sm">or</span>

          {/* Secondary options in a dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                More Options
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {hasSmTasks && packs.length > 0 && (
                <PackPickerMenu packs={packs} onApplyPack={onApplyPack} />
              )}
              {!hasSmTasks && (
                <DropdownMenuItem onClick={onPopulateFromSchedule}>
                  <Calendar className="h-4 w-4 mr-2" />
                  From Schedule (0 tasks)
                </DropdownMenuItem>
              )}
              {templates.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => onApplyTemplate(t.id)}>
                  <Package className="h-4 w-4 mr-2" />
                  {t.name} ({t.lineCount} lines)
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={onCreateBlank}>
                <Plus className="h-4 w-4 mr-2" />
                Blank Quote
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {existingPoCount > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              {existingPoCount} POs already exist
            </span>
          )}
        </>
      )}

      {/* Active quote actions */}
      {hasActiveQuote && hasLinkedTemplate && (
        <Button size="sm" variant="outline" onClick={onOverwriteTemplate}>
          <Upload className="h-4 w-4 mr-1" />
          Save to Template
        </Button>
      )}

      {hasActiveQuote && (
        <Button size="sm" variant="outline" onClick={onSaveAsTemplate}>
          <Save className="h-4 w-4 mr-1" />
          Save as Template
        </Button>
      )}

      {hasActiveQuote && (
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
      )}
    </div>
  );
}

/** Inline PO Pack picker — shown as primary when no SmTasks */
function PackPicker({
  packs,
  packsLoading,
  onApplyPack,
}: {
  packs: PoTemplatePackSummary[];
  packsLoading: boolean;
  onApplyPack: (packId: number) => void;
}) {
  const items: ComboboxItem[] = packs.map((p) => ({
    id: String(p.id),
    label: `${p.name} (${p.itemCount} POs)`,
  }));

  return (
    <ComboboxDropdown
      items={items}
      onSelect={(item) => onApplyPack(Number(item.id))}
      placeholder="Select PO Pack..."
      className="w-64"
      disabled={packsLoading}
    />
  );
}

/** PO Pack options inside dropdown menu — shown as secondary when SmTasks exist */
function PackPickerMenu({
  packs,
  onApplyPack,
}: {
  packs: PoTemplatePackSummary[];
  onApplyPack: (packId: number) => void;
}) {
  return (
    <>
      {packs.map((p) => (
        <DropdownMenuItem key={p.id} onClick={() => onApplyPack(p.id)}>
          <Package className="h-4 w-4 mr-2" />
          {p.name} ({p.itemCount} POs)
        </DropdownMenuItem>
      ))}
    </>
  );
}
