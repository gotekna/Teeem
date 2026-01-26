"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  /**
   * Field label text
   */
  label: string;

  /**
   * Unique ID for the field (used for label htmlFor)
   * If not provided, will be auto-generated
   */
  id?: string;

  /**
   * Error message to display
   * Field is considered invalid when this is set
   */
  error?: string | null;

  /**
   * Helper text displayed below the input
   */
  hint?: string;

  /**
   * Whether the field is required
   * Adds visual indicator to label
   */
  required?: boolean;

  /**
   * Whether the field is disabled
   */
  disabled?: boolean;

  /**
   * The form input element(s)
   */
  children: React.ReactNode;

  /**
   * Additional class name for the wrapper
   */
  className?: string;

  /**
   * Additional class name for the label
   */
  labelClassName?: string;

  /**
   * Orientation of label relative to input
   * @default "vertical"
   */
  orientation?: "vertical" | "horizontal";
}

/**
 * Form Field Component
 *
 * SSoT wrapper for form inputs with label, error, and hint display.
 * Standardizes form field layout across the app.
 *
 * Features:
 * - Consistent label styling
 * - Required indicator
 * - Error message display (red text)
 * - Hint text display (muted text)
 * - Accessibility (label htmlFor)
 * - Vertical and horizontal orientations
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FormField label="Email" error={errors.email} required>
 *   <Input value={email} onChange={...} />
 * </FormField>
 *
 * // With hint
 * <FormField
 *   label="Password"
 *   hint="Must be at least 8 characters"
 *   error={errors.password}
 *   required
 * >
 *   <Input type="password" value={password} onChange={...} />
 * </FormField>
 *
 * // Horizontal layout (for settings)
 * <FormField label="Enable notifications" orientation="horizontal">
 *   <Switch checked={enabled} onCheckedChange={setEnabled} />
 * </FormField>
 * ```
 */
export function FormField({
  label,
  id: providedId,
  error,
  hint,
  required = false,
  disabled = false,
  children,
  className,
  labelClassName,
  orientation = "vertical",
}: FormFieldProps) {
  // Generate unique ID if not provided
  const generatedId = React.useId();
  const id = providedId ?? generatedId;

  const hasError = Boolean(error);

  // Clone children to inject id prop for accessibility
  const enhancedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      // Inject id and aria attributes for accessibility
      return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        id,
        "aria-invalid": hasError ? true : undefined,
        "aria-describedby": hasError
          ? `${id}-error`
          : hint
          ? `${id}-hint`
          : undefined,
        disabled: disabled || (child.props as { disabled?: boolean }).disabled,
      });
    }
    return child;
  });

  if (orientation === "horizontal") {
    return (
      <div className={cn("flex items-center justify-between gap-4", className)}>
        <Label
          htmlFor={id}
          className={cn(
            "text-sm font-medium",
            disabled && "opacity-50 cursor-not-allowed",
            labelClassName
          )}
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <div className="flex flex-col items-end gap-1">
          {enhancedChildren}
          {hasError && (
            <p
              id={`${id}-error`}
              className="text-xs text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label
        htmlFor={id}
        className={cn(
          "text-sm font-medium",
          disabled && "opacity-50 cursor-not-allowed",
          labelClassName
        )}
      >
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {enhancedChildren}
      {hasError && (
        <p
          id={`${id}-error`}
          className="text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {!hasError && hint && (
        <p
          id={`${id}-hint`}
          className="text-xs text-muted-foreground"
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export default FormField;
