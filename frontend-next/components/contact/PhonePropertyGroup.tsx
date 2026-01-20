"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Plus,
  Star,
  Trash2,
  Phone,
  Smartphone,
  Building2,
  Printer,
  Home,
  Check,
} from "lucide-react";
import { formatPhoneNumber, validatePhoneNumber } from "@/app/(app)/contacts/[id]/types";

export interface ContactPhone {
  id?: number;
  _tempId?: string;
  phone_number: string;
  phone_type: "mobile" | "office" | "fax" | "home";
  is_primary: boolean;
  label: string | null;
  position: number;
  _destroy?: boolean;
}

export interface PhonePropertyGroupProps {
  /** Contact ID for API calls */
  contactId: number;
  /** Current list of phones */
  phones: ContactPhone[];
  /** Save function that patches the contact with updated phones */
  onSave: (phones: ContactPhone[]) => Promise<void>;
  /** Custom class */
  className?: string;
}

const PHONE_TYPES = [
  { value: "mobile", label: "Mobile", icon: Smartphone },
  { value: "office", label: "Office", icon: Building2 },
  { value: "home", label: "Home", icon: Home },
  { value: "fax", label: "Fax", icon: Printer },
] as const;

function getPhoneIcon(type: string) {
  const typeConfig = PHONE_TYPES.find((t) => t.value === type);
  return typeConfig?.icon || Phone;
}

/**
 * Generate a temporary ID for new phones
 */
function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Individual phone row component
 */
interface PhoneRowProps {
  phone: ContactPhone;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (updates: Partial<ContactPhone>) => Promise<void>;
  onSetPrimary: () => Promise<void>;
  onDelete: () => Promise<void>;
  isNew?: boolean;
  onCancelNew?: () => void;
}

function PhoneRow({
  phone,
  isEditing,
  onStartEdit,
  onSave,
  onSetPrimary,
  onDelete,
  isNew = false,
  onCancelNew,
}: PhoneRowProps) {
  const [draft, setDraft] = useState(phone.phone_number);
  const [draftType, setDraftType] = useState(phone.phone_type);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync draft with phone when not editing
  useEffect(() => {
    if (!isEditing) {
      setDraft(phone.phone_number);
      setDraftType(phone.phone_type);
    }
  }, [phone.phone_number, phone.phone_type, isEditing]);

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim();

    // If new and empty, cancel
    if (isNew && !trimmed) {
      onCancelNew?.();
      return;
    }

    // Validate
    const validation = validatePhoneNumber(trimmed);
    if (!validation.isValid) {
      setError(validation.error || "Invalid phone number");
      return;
    }

    // Format the phone number
    const formatted = formatPhoneNumber(trimmed);

    // Skip save if nothing changed
    if (formatted === phone.phone_number && draftType === phone.phone_type) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({ phone_number: formatted, phone_type: draftType });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [draft, draftType, phone.phone_number, phone.phone_type, isNew, onCancelNew, onSave]);

  const handleTypeChange = useCallback(
    async (newType: string) => {
      setDraftType(newType as ContactPhone["phone_type"]);

      // If not a new phone and has a number, save immediately
      if (!isNew && phone.phone_number) {
        setSaving(true);
        setError(null);
        try {
          await onSave({ phone_type: newType as ContactPhone["phone_type"] });
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 1500);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
          setSaving(false);
        }
      }
    },
    [isNew, phone.phone_number, onSave]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (isNew) {
          onCancelNew?.();
        } else {
          setDraft(phone.phone_number);
          setDraftType(phone.phone_type);
          setError(null);
        }
      }
    },
    [handleSave, isNew, onCancelNew, phone.phone_number, phone.phone_type]
  );

  const Icon = getPhoneIcon(draftType);

  // Edit mode or new phone
  if (isEditing || isNew) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 -mx-2 transition-colors",
          isNew ? "bg-blue-50 dark:bg-blue-950/30" : "bg-secondary",
          error && "bg-red-50 dark:bg-red-950/30"
        )}
      >
        {/* Type selector */}
        <Select value={draftType} onValueChange={handleTypeChange} disabled={saving}>
          <SelectTrigger className="w-24 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHONE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <span className="flex items-center gap-1.5">
                  <type.icon className="h-3 w-3" />
                  {type.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Phone input */}
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder="Enter phone number"
          disabled={saving}
          className={cn("flex-1 h-8", error && "border-red-500")}
        />

        {/* Status indicators */}
        {saving && <Spinner className="h-4 w-4 shrink-0" />}
        {showSuccess && <Check className="h-4 w-4 text-green-500 dark:text-green-400 shrink-0" />}

        {/* Actions */}
        {!isNew && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0",
                phone.is_primary && "text-yellow-500 dark:text-yellow-400"
              )}
              onClick={async (e) => {
                e.stopPropagation();
                await onSetPrimary();
              }}
              disabled={saving || phone.is_primary}
              title={phone.is_primary ? "Primary phone" : "Set as primary"}
            >
              <Star
                className={cn("h-4 w-4", phone.is_primary && "fill-current")}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={async (e) => {
                e.stopPropagation();
                await onDelete();
              }}
              disabled={saving}
              title="Delete phone"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Cancel button for new phones */}
        {isNew && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground"
            onClick={() => onCancelNew?.()}
          >
            Cancel
          </Button>
        )}

        {/* Error display */}
        {error && (
          <span className="text-[11px] text-red-500 dark:text-red-400 absolute -bottom-4 left-28">
            {error}
          </span>
        )}
      </div>
    );
  }

  // Read mode
  return (
    <div
      className={cn(
        "group flex items-center gap-2 py-1.5 px-2 -mx-2 transition-colors cursor-pointer hover:bg-secondary",
        showSuccess && "bg-green-50 dark:bg-green-950/30"
      )}
      onClick={onStartEdit}
    >
      {/* Type badge */}
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground w-16 shrink-0">
        <Icon className="h-3.5 w-3.5" />
        <span className="capitalize">{phone.phone_type}</span>
      </span>

      {/* Phone number */}
      <span className="flex-1 text-[14px] text-text-secondary">
        {formatPhoneNumber(phone.phone_number) || phone.phone_number}
      </span>

      {/* Primary indicator */}
      {phone.is_primary && (
        <Star className="h-4 w-4 text-yellow-500 dark:text-yellow-400 fill-current shrink-0" />
      )}

      {/* Success indicator */}
      {showSuccess && <Check className="h-4 w-4 text-green-500 dark:text-green-400 shrink-0" />}

      {/* Hover actions */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0">
        {!phone.is_primary && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={async (e) => {
              e.stopPropagation();
              await onSetPrimary();
            }}
            title="Set as primary"
          >
            <Star className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          onClick={async (e) => {
            e.stopPropagation();
            await onDelete();
          }}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * PhonePropertyGroup - Phone list with inline add/edit/delete
 */
export function PhonePropertyGroup({
  contactId,
  phones,
  onSave,
  className,
}: PhonePropertyGroupProps) {
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newPhone, setNewPhone] = useState<ContactPhone | null>(null);

  // Filter out destroyed phones and sort by primary first, then position
  const visiblePhones = phones
    .filter((p) => !p._destroy)
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.position - b.position;
    });

  const handleAdd = useCallback(() => {
    const tempId = generateTempId();
    setNewPhone({
      _tempId: tempId,
      phone_number: "",
      phone_type: "mobile",
      is_primary: visiblePhones.length === 0,
      label: null,
      position: visiblePhones.length,
    });
    setIsAdding(true);
  }, [visiblePhones.length]);

  const handleCancelNew = useCallback(() => {
    setNewPhone(null);
    setIsAdding(false);
  }, []);

  const handleSaveNew = useCallback(
    async (updates: Partial<ContactPhone>) => {
      if (!newPhone) return;

      const phoneToAdd: ContactPhone = {
        ...newPhone,
        ...updates,
      };

      // Remove temp ID before saving
      delete phoneToAdd._tempId;

      const updatedPhones = [...phones, phoneToAdd];
      await onSave(updatedPhones);

      setNewPhone(null);
      setIsAdding(false);
    },
    [newPhone, phones, onSave]
  );

  const handleSaveExisting = useCallback(
    async (phone: ContactPhone, updates: Partial<ContactPhone>) => {
      const updatedPhones = phones.map((p) => {
        if (p.id === phone.id || p._tempId === phone._tempId) {
          return { ...p, ...updates };
        }
        return p;
      });
      await onSave(updatedPhones);
      setEditingId(null);
    },
    [phones, onSave]
  );

  const handleSetPrimary = useCallback(
    async (phone: ContactPhone) => {
      const updatedPhones = phones.map((p) => ({
        ...p,
        is_primary: p.id === phone.id || p._tempId === phone._tempId,
      }));
      await onSave(updatedPhones);
    },
    [phones, onSave]
  );

  const handleDelete = useCallback(
    async (phone: ContactPhone) => {
      let updatedPhones: ContactPhone[];

      if (phone.id) {
        // Soft delete for saved phones
        updatedPhones = phones.map((p) =>
          p.id === phone.id ? { ...p, _destroy: true } : p
        );
      } else {
        // Hard delete for unsaved phones
        updatedPhones = phones.filter(
          (p) => p._tempId !== phone._tempId
        );
      }

      // If we deleted the primary, make the first remaining one primary
      const remaining = updatedPhones.filter((p) => !p._destroy);
      const hasPrimary = remaining.some((p) => p.is_primary);
      if (!hasPrimary && remaining.length > 0) {
        const firstId = remaining[0].id || remaining[0]._tempId;
        updatedPhones = updatedPhones.map((p) => ({
          ...p,
          is_primary: p.id === firstId || p._tempId === firstId,
        }));
      }

      await onSave(updatedPhones);
    },
    [phones, onSave]
  );

  return (
    <div className={cn("space-y-1", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[14px] text-muted-foreground">Phones</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-text-secondary"
          onClick={handleAdd}
          disabled={isAdding}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Phone list */}
      <div className="space-y-0.5">
        {visiblePhones.length === 0 && !isAdding && (
          <p className="text-[14px] text-muted-foreground italic py-2 px-2">
            No phone numbers
          </p>
        )}

        {visiblePhones.map((phone) => (
          <PhoneRow
            key={phone.id || phone._tempId}
            phone={phone}
            isEditing={editingId === (phone.id || phone._tempId)}
            onStartEdit={() => setEditingId(phone.id || phone._tempId || null)}
            onSave={(updates) => handleSaveExisting(phone, updates)}
            onSetPrimary={() => handleSetPrimary(phone)}
            onDelete={() => handleDelete(phone)}
          />
        ))}

        {/* New phone row */}
        {isAdding && newPhone && (
          <PhoneRow
            phone={newPhone}
            isEditing={false}
            isNew
            onStartEdit={() => {}}
            onSave={handleSaveNew}
            onSetPrimary={async () => {}}
            onDelete={async () => {}}
            onCancelNew={handleCancelNew}
          />
        )}
      </div>
    </div>
  );
}

export default PhonePropertyGroup;
