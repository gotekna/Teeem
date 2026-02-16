"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Trash2, ArrowRightLeft, ExternalLink } from "lucide-react";

/**
 * Fix option from the backend health check
 */
interface FixOption {
  action: string;
  label: string;
  description: string;
  destructive?: boolean;
  requires_value?: boolean;
  value_field?: string;
  frontend_only?: boolean;
}

/**
 * Valid type option for relationship type changes
 */
interface ValidTypeOption {
  value: string;
  label: string;
}

/**
 * Health check item with fix-related fields
 */
interface FixableItem {
  id: number | string;
  display?: string;
  source_contact_id?: number;
  related_contact_id?: number;
  valid_type_options?: ValidTypeOption[];
  [key: string]: unknown;
}

/**
 * Props for HealthFixDialog
 */
interface HealthFixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FixableItem | null;
  fixType: string;
  fixOptions: FixOption[];
  onFixComplete: () => void;
}

/**
 * HealthFixDialog - Multi-option fix dialog for health check items
 *
 * Renders fix options from the backend (SSoT) as action rows.
 * Supports delete, change type (with value selection), and frontend navigation.
 */
export function HealthFixDialog({
  open,
  onOpenChange,
  item,
  fixType,
  fixOptions,
  onFixComplete,
}: HealthFixDialogProps) {
  const router = useRouter();
  const [fixing, setFixing] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  const handleFix = async (option: FixOption) => {
    setError(null);

    // Frontend-only actions (navigation)
    if (option.frontend_only) {
      if (item.source_contact_id) {
        router.push(`/contacts/${item.source_contact_id}`);
      }
      onOpenChange(false);
      return;
    }

    // Validate value selection for change actions
    if (option.requires_value && !selectedType) {
      setError("Please select a new type first");
      return;
    }

    setFixing(option.action);

    try {
      await api.post("/api/v1/health/fix", {
        fix_type: fixType,
        item_ids: [item.id],
        action: option.action,
        new_value: option.requires_value ? selectedType : undefined,
      });

      onOpenChange(false);
      setSelectedType("");
      onFixComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setFixing(null);
    }
  };

  const getOptionIcon = (option: FixOption) => {
    if (option.destructive) return <Trash2 className="h-4 w-4" />;
    if (option.frontend_only) return <ExternalLink className="h-4 w-4" />;
    return <ArrowRightLeft className="h-4 w-4" />;
  };

  const validTypeOptions: ValidTypeOption[] = item.valid_type_options ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fix Health Issue</DialogTitle>
          <DialogDescription className="text-sm">
            {item.display}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {fixOptions.map((option) => (
            <div
              key={option.action}
              className={cn(
                "border rounded-lg p-3",
                option.destructive && "border-red-200 dark:border-red-800"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex-shrink-0",
                    option.destructive
                      ? "text-red-500"
                      : "text-muted-foreground"
                  )}
                >
                  {getOptionIcon(option)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </div>

                  {/* Value selection for change_relationship_type */}
                  {option.requires_value && validTypeOptions.length > 0 && (
                    <select
                      value={selectedType}
                      onChange={(e) => {
                        setSelectedType(e.target.value);
                        setError(null);
                      }}
                      className="mt-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">Select new type...</option>
                      {validTypeOptions.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {option.requires_value && validTypeOptions.length === 0 && (
                    <div className="mt-2 text-xs text-muted-foreground italic">
                      No valid types available for this entity combination
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={option.destructive ? "destructive" : option.frontend_only ? "outline" : "default"}
                  className="flex-shrink-0"
                  disabled={
                    fixing !== null ||
                    (option.requires_value && validTypeOptions.length === 0)
                  }
                  onClick={() => handleFix(option)}
                >
                  {fixing === option.action ? (
                    <Spinner size={14} />
                  ) : option.frontend_only ? (
                    "Open"
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
            </div>
          ))}

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
