"use client";

/**
 * FieldPalette
 *
 * Grid of available field types. Click to add to the form canvas.
 */

import { Button } from "@/components/ui/button";
import { FIELD_TYPE_META, type FieldType, type FieldCategory } from "@/lib/workflow-forms/types";

interface FieldPaletteProps {
  onAddField: (type: FieldType) => void;
}

const CATEGORY_LABELS: Record<FieldCategory, string> = {
  input: "Input",
  choice: "Choice",
  date: "Date & Time",
  display: "Display",
};

const CATEGORY_ORDER: FieldCategory[] = ["input", "choice", "date", "display"];

export function FieldPalette({ onAddField }: FieldPaletteProps) {
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    fields: FIELD_TYPE_META.filter((f) => f.category === category),
  }));

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.category}>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {group.label}
          </h4>
          <div className="grid grid-cols-2 gap-1.5">
            {group.fields.map((meta) => {
              const Icon = meta.icon;
              return (
                <Button
                  key={meta.type}
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 px-2.5 justify-start gap-2 text-xs font-normal hover:bg-accent"
                  onClick={() => onAddField(meta.type)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{meta.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
