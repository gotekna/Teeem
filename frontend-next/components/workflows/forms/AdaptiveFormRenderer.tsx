"use client";

/**
 * AdaptiveFormRenderer
 *
 * Runtime form component that renders an AdaptiveFormSchema
 * using react-hook-form + dynamic Zod validation.
 * Implements TaskFormProps so it plugs into the workflow task system.
 */

import { useForm, type Resolver } from "react-hook-form";
import { useMemo, useCallback } from "react";
import { type z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { AdaptiveFieldRenderer } from "./AdaptiveFieldRenderer";
import type { TaskFormProps } from "@/lib/workflow-task-forms";
import type { AdaptiveFormSchema } from "@/lib/workflow-forms/types";
import { buildZodSchema } from "@/lib/workflow-forms/schema-utils";
import { isDisplayField } from "@/lib/workflow-forms/types";

// Minimal Zod resolver (avoids @hookform/resolvers dependency)
function createZodResolver(
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>
): Resolver<Record<string, unknown>> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const fieldErrors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) {
        fieldErrors[path] = { type: issue.code, message: issue.message };
      }
    }
    return { values: {}, errors: fieldErrors };
  };
}

interface AdaptiveFormRendererProps {
  schema: AdaptiveFormSchema;
  defaultValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
  /** When true, renders just the fields without the form chrome (title, description, buttons) */
  fieldsOnly?: boolean;
}

export function AdaptiveFormRenderer({
  schema,
  defaultValues = {},
  onSubmit,
  onCancel,
  submitLabel,
  disabled = false,
  fieldsOnly = false,
}: AdaptiveFormRendererProps) {
  const zodSchema = useMemo(() => buildZodSchema(schema.fields), [schema.fields]);
  const resolver = useCallback(createZodResolver(zodSchema), [zodSchema]);

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver,
    defaultValues: defaultValues as Record<string, string | number | boolean | string[]>,
  });

  const values = watch();

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit(data as Record<string, unknown>);
  });

  const fieldElements = schema.fields.map((field) => {
    const isDisplay = isDisplayField(field.type);
    const fieldError = errors[field.name]?.message as string | undefined;

    if (isDisplay) {
      return (
        <div key={field.id}>
          <AdaptiveFieldRenderer
            field={field}
            value={undefined}
            onChange={() => {}}
            disabled={disabled}
          />
        </div>
      );
    }

    return (
      <FormField
        key={field.id}
        label={field.label}
        required={field.required}
        error={fieldError}
      >
        <AdaptiveFieldRenderer
          field={field}
          value={values[field.name]}
          onChange={(val) => setValue(field.name, val as string | number | boolean | string[], { shouldValidate: true })}
          error={fieldError}
          disabled={disabled}
        />
      </FormField>
    );
  });

  if (fieldsOnly) {
    return <div className="space-y-4">{fieldElements}</div>;
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {(schema.title || schema.description) && (
        <div className="space-y-1">
          {schema.title && (
            <h2 className="text-xl font-semibold">{schema.title}</h2>
          )}
          {schema.description && (
            <p className="text-sm text-muted-foreground">{schema.description}</p>
          )}
        </div>
      )}

      <div className="space-y-4">{fieldElements}</div>

      <div className="flex items-center gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || disabled}>
          {isSubmitting ? "Submitting..." : submitLabel || schema.submitLabel || "Complete"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Wrapper that implements TaskFormProps for the workflow task system.
 * This is what gets registered in TASK_FORM_REGISTRY.
 */
export default function AdaptiveTaskForm({
  formSchema,
  formData,
  onComplete,
  onCancel,
}: TaskFormProps) {
  const schema = formSchema as unknown as AdaptiveFormSchema;

  return (
    <AdaptiveFormRenderer
      schema={schema}
      defaultValues={formData}
      onSubmit={onComplete}
      onCancel={onCancel}
      submitLabel={schema.submitLabel}
    />
  );
}
