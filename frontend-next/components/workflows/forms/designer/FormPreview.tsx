"use client";

/**
 * FormPreview
 *
 * Live preview of the form being designed, using AdaptiveFormRenderer.
 */

import { AdaptiveFormRenderer } from "../AdaptiveFormRenderer";
import type { AdaptiveFormSchema } from "@/lib/workflow-forms/types";

interface FormPreviewProps {
  schema: AdaptiveFormSchema;
}

export function FormPreview({ schema }: FormPreviewProps) {
  if (schema.fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Add fields to see a preview
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <AdaptiveFormRenderer
        schema={schema}
        onSubmit={() => {
          // Preview only - no actual submission
        }}
        submitLabel={schema.submitLabel || "Complete"}
        disabled={false}
      />
    </div>
  );
}
