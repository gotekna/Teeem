"use client";

import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Pencil, Check, X } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface PropertyRowProps {
  /** Label displayed on the left */
  label: string;
  /** Current value (null/undefined renders as "Not set") */
  value: string | boolean | null | undefined;
  /** Async save function - receives new value, should throw on error */
  onSave: (value: string | boolean) => Promise<void>;
  /** Field type determines the editor component */
  type?: "text" | "email" | "phone" | "select" | "textarea" | "switch" | "url";
  /** Options for select type */
  options?: SelectOption[];
  /** Placeholder text for empty fields */
  placeholder?: string;
  /** If true, shows as muted/readonly (no edit capability) */
  readonly?: boolean;
  /** Helper text shown below the value */
  hint?: string;
  /** Custom validation function */
  validate?: (value: string) => { isValid: boolean; error?: string };
  /** Format function applied to display value */
  format?: (value: string) => string;
  /** External link button (for URLs) */
  externalLink?: boolean;
  /** Custom class for the row */
  className?: string;
  /** Label width class (default: w-40) */
  labelWidth?: string;
  /** If true, shows a clear button when value exists */
  clearable?: boolean;
}

/**
 * PropertyRow - A click-to-edit property field
 *
 * Brand Guidelines Applied:
 * - Square corners (no rounded)
 * - Text: #606060 body, #878787 labels
 * - Hover: bg-[#F2F1EF] dark:bg-[#1D1D1D]
 *
 * Behavior:
 * - Read mode: Shows label + value, hover reveals edit icon
 * - Click → Edit mode: Shows input, auto-focused
 * - Blur/Enter → Saves, shows spinner, returns to read mode
 * - Escape → Cancels, reverts to original value
 * - Save success → Brief green flash
 * - Save error → Red border, keeps edit mode
 */
export const PropertyRow = memo(function PropertyRow({
  label,
  value,
  onSave,
  type = "text",
  options = [],
  placeholder,
  readonly = false,
  hint,
  validate,
  format,
  externalLink = false,
  className,
  labelWidth = "w-40",
  clearable = false,
}: PropertyRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const selectTriggerRef = useRef<HTMLButtonElement>(null);

  // Sync draft with value when value changes externally
  useEffect(() => {
    if (!isEditing) {
      setDraft(String(value ?? ""));
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      if (type === "select") {
        selectTriggerRef.current?.focus();
      } else {
        inputRef.current?.focus();
        // Select all text for easy replacement
        if (inputRef.current && "select" in inputRef.current) {
          (inputRef.current as HTMLInputElement).select();
        }
      }
    }
  }, [isEditing, type]);

  const handleSave = useCallback(async () => {
    const trimmedValue = draft.trim();

    // Skip save if value hasn't changed
    if (trimmedValue === String(value ?? "")) {
      setIsEditing(false);
      setError(null);
      return;
    }

    // Validate if validator provided
    if (validate) {
      const validation = validate(trimmedValue);
      if (!validation.isValid) {
        setError(validation.error || "Invalid value");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(trimmedValue);
      setIsEditing(false);
      // Show success flash
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      // Keep editing mode on error
    } finally {
      setSaving(false);
    }
  }, [draft, value, validate, onSave]);

  const handleCancel = useCallback(() => {
    setDraft(String(value ?? ""));
    setIsEditing(false);
    setError(null);
  }, [value]);

  const handleClear = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering edit mode
    setSaving(true);
    setError(null);
    try {
      // Pass empty string - the parent's onSave should handle converting to null if needed
      await onSave("");
      setDraft("");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear";
      setError(message);
      // Show toast for visibility
      console.error("[PropertyRow.handleClear] Error:", err);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && type !== "textarea") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel, type]
  );

  const handleSwitchChange = useCallback(
    async (checked: boolean) => {
      setSaving(true);
      setError(null);
      try {
        await onSave(checked);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [onSave]
  );

  const handleSelectChange = useCallback(
    async (newValue: string) => {
      if (newValue === String(value ?? "")) {
        setIsEditing(false);
        return;
      }

      setSaving(true);
      setError(null);
      try {
        await onSave(newValue);
        setDraft(newValue);
        setIsEditing(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [value, onSave]
  );

  // Get display value
  const displayValue = (() => {
    if (type === "switch") {
      return value ? "Yes" : "No";
    }
    if (type === "select" && options.length > 0) {
      const option = options.find((o) => o.value === String(value));
      return option?.label || String(value ?? "");
    }
    const stringValue = String(value ?? "");
    if (!stringValue) return null;
    return format ? format(stringValue) : stringValue;
  })();

  // Switch type - inline, no click-to-edit
  if (type === "switch") {
    return (
      <div
        className={cn(
          "flex items-center py-2.5 px-3 -mx-3 transition-colors",
          showSuccess && "bg-green-50 dark:bg-green-950/30",
          error && "bg-red-50 dark:bg-red-950/30",
          className
        )}
      >
        <span
          className={cn(
            "shrink-0 text-[14px] text-[#878787]",
            labelWidth
          )}
        >
          {label}
        </span>
        <div className="flex-1 flex items-center justify-between">
          <span className="text-[14px] text-[#878787]">
            {hint}
          </span>
          <div className="flex items-center gap-2">
            {saving && <Spinner className="h-4 w-4" />}
            {showSuccess && <Check className="h-4 w-4 text-green-500" />}
            <Switch
              checked={Boolean(value)}
              onCheckedChange={handleSwitchChange}
              disabled={saving || readonly}
            />
          </div>
        </div>
        {error && (
          <span className="text-[11px] text-red-500 ml-2">{error}</span>
        )}
      </div>
    );
  }

  // Read mode
  if (!isEditing) {
    return (
      <div
        className={cn(
          "group flex items-start py-2.5 px-3 -mx-3 transition-all cursor-pointer",
          !readonly && "hover:bg-[#F2F1EF] dark:hover:bg-[#1D1D1D]",
          showSuccess && "bg-green-50 dark:bg-green-950/30",
          readonly && "cursor-default",
          className
        )}
        onClick={() => !readonly && setIsEditing(true)}
      >
        <span
          className={cn(
            "shrink-0 text-[14px] text-[#878787] pt-0.5",
            labelWidth
          )}
        >
          {label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-[14px] text-[#606060] dark:text-gray-300 break-words",
                !displayValue && "text-[#878787] italic"
              )}
            >
              {displayValue || placeholder || "Not set"}
            </span>
            {showSuccess && <Check className="h-4 w-4 text-green-500 shrink-0" />}
            {externalLink && displayValue && (
              <a
                href={
                  displayValue.startsWith("http")
                    ? displayValue
                    : `https://${displayValue}`
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-primary shrink-0"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>
          {hint && !readonly && (
            <p className="text-[11px] text-[#878787] mt-0.5">{hint}</p>
          )}
        </div>
        {/* Clear button - shows when clearable and has value */}
        {!readonly && clearable && displayValue && (
          <button
            type="button"
            onClick={handleClear}
            disabled={saving}
            className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 shrink-0 ml-1 mt-0.5 transition-opacity"
            title="Clear value"
          >
            {saving ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        )}
        {/* Pencil icon - shows when not clearable, or clearable but no value */}
        {!readonly && (!clearable || !displayValue) && (
          <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 ml-2 mt-0.5" />
        )}
      </div>
    );
  }

  // Edit mode - Select
  if (type === "select") {
    return (
      <div
        className={cn(
          "flex items-start py-1.5 px-3 -mx-3 bg-[#F2F1EF] dark:bg-[#1D1D1D] transition-colors",
          error && "bg-red-50 dark:bg-red-950/30",
          className
        )}
      >
        <span
          className={cn(
            "shrink-0 text-[14px] text-[#878787] pt-2",
            labelWidth
          )}
        >
          {label}
        </span>
        <div className="flex-1 flex items-center gap-2">
          <Select
            value={draft}
            onValueChange={handleSelectChange}
            disabled={saving}
          >
            <SelectTrigger
              ref={selectTriggerRef}
              className={cn("flex-1", error && "border-red-500")}
              onKeyDown={handleKeyDown}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving && <Spinner className="h-4 w-4 shrink-0" />}
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && (
          <span className="text-[11px] text-red-500 ml-2 pt-2">{error}</span>
        )}
      </div>
    );
  }

  // Edit mode - Textarea
  if (type === "textarea") {
    return (
      <div
        className={cn(
          "flex items-start py-1.5 px-3 -mx-3 bg-[#F2F1EF] dark:bg-[#1D1D1D] transition-colors",
          error && "bg-red-50 dark:bg-red-950/30",
          className
        )}
      >
        <span
          className={cn(
            "shrink-0 text-[14px] text-[#878787] pt-2",
            labelWidth
          )}
        >
          {label}
        </span>
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancel();
                }
                // Ctrl/Cmd + Enter to save
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder={placeholder}
              disabled={saving}
              className={cn("min-h-[80px] resize-y", error && "border-red-500")}
            />
            <div className="flex flex-col gap-1 shrink-0">
              {saving && <Spinner className="h-4 w-4" />}
              <button
                type="button"
                onClick={handleCancel}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {error && <span className="text-[11px] text-red-500">{error}</span>}
          <span className="text-[11px] text-[#878787]">
            Press Escape to cancel, Cmd+Enter to save
          </span>
        </div>
      </div>
    );
  }

  // Edit mode - Text/Email/Phone/URL
  return (
    <div
      className={cn(
        "flex items-start py-1.5 px-3 -mx-3 bg-[#F2F1EF] dark:bg-[#1D1D1D] transition-colors",
        error && "bg-red-50 dark:bg-red-950/30",
        className
      )}
    >
      <span
        className={cn(
          "shrink-0 text-[14px] text-[#878787] pt-2",
          labelWidth
        )}
      >
        {label}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type === "email" ? "email" : type === "url" ? "url" : "text"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={saving}
            className={cn("flex-1", error && "border-red-500")}
          />
          {saving && <Spinner className="h-4 w-4 shrink-0" />}
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <span className="text-[11px] text-red-500 mt-1 block">{error}</span>}
      </div>
    </div>
  );
});

export default PropertyRow;
