"use client";

/**
 * TokenBuilder - Draggable placeholder tokens with preview
 *
 * THE ONE component for building template strings with placeholders.
 * Used for document file naming, display names, email templates, etc.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import { TokenBuilder } from "@/components/ui/tokens";
 *
 * <TokenBuilder
 *   value="{CompanyCode} - {Description}"
 *   onChange={(newValue) => setTemplate(newValue)}
 *   scope="company"
 *   showPreview
 *   previewData={{ CompanyCode: "TH", Description: "Example" }}
 * />
 * ```
 */

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TokenBadge } from "./TokenBadge";
import { TokenPalette } from "./TokenPalette";
import {
  type PlaceholderScope,
  type PlaceholderToken,
  parseTemplate,
  buildTemplate,
  resolveWithExamples,
  getPlaceholderColor,
} from "@/lib/placeholders";

export interface TokenBuilderProps {
  /** Current template value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Scope of placeholders to show */
  scope?: PlaceholderScope;
  /** Custom placeholders (overrides scope) */
  placeholders?: PlaceholderToken[];
  /** Whether to show live preview */
  showPreview?: boolean;
  /** Custom preview data (overrides examples) */
  previewData?: Record<string, string>;
  /** Whether preview should use long variants */
  previewUseLong?: boolean;
  /** Label for the field */
  label?: string;
  /** Placeholder text for empty state */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Error message */
  error?: string;
  /** Help text */
  helpText?: string;
}

export function TokenBuilder({
  value,
  onChange,
  scope = "all",
  placeholders: customPlaceholders,
  showPreview = true,
  previewData,
  previewUseLong = false,
  label,
  placeholder = "Click + to add placeholders or type text...",
  disabled = false,
  className,
  error,
  helpText,
}: TokenBuilderProps) {
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [customText, setCustomText] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Parse current value into tokens
  const tokens = React.useMemo(() => parseTemplate(value), [value]);

  // Generate preview
  const preview = React.useMemo(() => {
    if (!showPreview) return "";
    if (previewData) {
      let result = value;
      Object.entries(previewData).forEach(([key, val]) => {
        // Support both {Key} and {{Key}} formats
        result = result.replace(new RegExp(`\\{\\{?${key}\\}\\}?`, "g"), val);
      });
      return result;
    }
    return resolveWithExamples(value, previewUseLong);
  }, [value, showPreview, previewData, previewUseLong]);

  // Insert a token at the end
  const insertToken = (code: string) => {
    const newValue = value ? `${value}${code}` : code;
    onChange(newValue);
    setIsPopoverOpen(false);
  };

  // Remove a token at index
  const removeToken = (index: number) => {
    const newTokens = tokens.filter((_, i) => i !== index);
    onChange(buildTemplate(newTokens));
  };

  // Add custom text
  const addCustomText = () => {
    if (customText.trim()) {
      const newValue = value ? `${value}${customText}` : customText;
      onChange(newValue);
      setCustomText("");
    }
  };

  // Handle key press in custom text input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomText();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      {/* Token Display Area */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 p-2 min-h-[42px] border rounded-none bg-background",
          error && "border-destructive",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {tokens.length === 0 ? (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        ) : (
          tokens.map((token, index) => (
            <React.Fragment key={index}>
              {token.type === "placeholder" ? (
                <TokenBadge
                  code={token.value}
                  color={getPlaceholderColor(token.value)}
                  removable={!disabled}
                  onRemove={() => removeToken(index)}
                  size="md"
                />
              ) : (
                <span className="text-sm">{token.value}</span>
              )}
            </React.Fragment>
          ))
        )}

        {/* Add Button */}
        {!disabled && (
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              {/* Custom Text Input */}
              <div className="p-2 border-b">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Add custom text..."
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={addCustomText}
                    disabled={!customText.trim()}
                    className="h-8"
                  >
                    Add
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Drag to add editable text. Click X to remove.
                </p>
              </div>

              {/* Token Palette */}
              <TokenPalette
                scope={scope}
                placeholders={customPlaceholders}
                onSelect={(code) => insertToken(code)}
                showLongVariants={true}
                showSearch={true}
                maxHeight="300px"
                className="border-0 rounded-none"
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Preview */}
      {showPreview && value && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Preview:</span>
          <span className="text-sm font-mono text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-none">
            {preview}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Help Text */}
      {helpText && !error && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
