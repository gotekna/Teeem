"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Plus, Star, Trash2, Mail, Check } from "lucide-react";

export interface ContactEmail {
  id?: number;
  _tempId?: string;
  email: string;
  is_primary: boolean;
  label: string | null;
  position: number;
  _destroy?: boolean;
}

export interface EmailPropertyGroupProps {
  /** Contact ID for API calls */
  contactId: number;
  /** Current list of emails */
  emails: ContactEmail[];
  /** Save function that patches the contact with updated emails */
  onSave: (emails: ContactEmail[]) => Promise<void>;
  /** Custom class */
  className?: string;
}

/**
 * Generate a temporary ID for new emails
 */
function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Simple email validation
 */
function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || email.trim() === "") return { isValid: true };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Please enter a valid email address" };
  }
  return { isValid: true };
}

/**
 * Individual email row component
 */
interface EmailRowProps {
  email: ContactEmail;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (updates: Partial<ContactEmail>) => Promise<void>;
  onSetPrimary: () => Promise<void>;
  onDelete: () => Promise<void>;
  isNew?: boolean;
  onCancelNew?: () => void;
}

function EmailRow({
  email,
  isEditing,
  onStartEdit,
  onSave,
  onSetPrimary,
  onDelete,
  isNew = false,
  onCancelNew,
}: EmailRowProps) {
  const [draft, setDraft] = useState(email.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing
  useEffect(() => {
    if ((isEditing || isNew) && inputRef.current) {
      inputRef.current.focus();
      if (!isNew) {
        inputRef.current.select();
      }
    }
  }, [isEditing, isNew]);

  // Sync draft with email when not editing
  useEffect(() => {
    if (!isEditing && !isNew) {
      setDraft(email.email);
    }
  }, [email.email, isEditing, isNew]);

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim().toLowerCase();

    // If new and empty, cancel
    if (isNew && !trimmed) {
      onCancelNew?.();
      return;
    }

    // Validate
    const validation = validateEmail(trimmed);
    if (!validation.isValid) {
      setError(validation.error || "Invalid email");
      return;
    }

    // Skip save if nothing changed
    if (trimmed === email.email) {
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({ email: trimmed });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [draft, email.email, isNew, onCancelNew, onSave]);

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
          setDraft(email.email);
          setError(null);
        }
      }
    },
    [handleSave, isNew, onCancelNew, email.email]
  );

  // Edit mode or new email
  if (isEditing || isNew) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 -mx-2 rounded transition-colors",
          isNew ? "bg-blue-50 dark:bg-blue-950/30" : "bg-muted/30",
          error && "bg-red-50 dark:bg-red-950/30"
        )}
      >
        {/* Icon */}
        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />

        {/* Email input */}
        <Input
          ref={inputRef}
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder="Enter email address"
          disabled={saving}
          className={cn("flex-1 h-8", error && "border-red-500")}
        />

        {/* Status indicators */}
        {saving && <Spinner className="h-4 w-4 shrink-0" />}
        {showSuccess && <Check className="h-4 w-4 text-green-500 shrink-0" />}

        {/* Actions */}
        {!isNew && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0",
                email.is_primary && "text-yellow-500"
              )}
              onClick={async (e) => {
                e.stopPropagation();
                await onSetPrimary();
              }}
              disabled={saving || email.is_primary}
              title={email.is_primary ? "Primary email" : "Set as primary"}
            >
              <Star
                className={cn("h-4 w-4", email.is_primary && "fill-current")}
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
              title="Delete email"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Cancel button for new emails */}
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
          <span className="text-xs text-red-500 absolute -bottom-4 left-8">
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
        "group flex items-center gap-2 py-1.5 px-2 -mx-2 rounded transition-colors cursor-pointer hover:bg-muted/50",
        showSuccess && "bg-green-50 dark:bg-green-950/30"
      )}
      onClick={onStartEdit}
    >
      {/* Icon */}
      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />

      {/* Email address */}
      <span className="flex-1 text-sm truncate">{email.email}</span>

      {/* Primary indicator */}
      {email.is_primary && (
        <Star className="h-4 w-4 text-yellow-500 fill-current shrink-0" />
      )}

      {/* Success indicator */}
      {showSuccess && <Check className="h-4 w-4 text-green-500 shrink-0" />}

      {/* Hover actions */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0">
        {!email.is_primary && (
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
 * EmailPropertyGroup - Email list with inline add/edit/delete
 */
export function EmailPropertyGroup({
  contactId,
  emails,
  onSave,
  className,
}: EmailPropertyGroupProps) {
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newEmail, setNewEmail] = useState<ContactEmail | null>(null);

  // Filter out destroyed emails and sort by primary first, then position
  const visibleEmails = emails
    .filter((e) => !e._destroy)
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.position - b.position;
    });

  const handleAdd = useCallback(() => {
    const tempId = generateTempId();
    setNewEmail({
      _tempId: tempId,
      email: "",
      is_primary: visibleEmails.length === 0,
      label: null,
      position: visibleEmails.length,
    });
    setIsAdding(true);
  }, [visibleEmails.length]);

  const handleCancelNew = useCallback(() => {
    setNewEmail(null);
    setIsAdding(false);
  }, []);

  const handleSaveNew = useCallback(
    async (updates: Partial<ContactEmail>) => {
      if (!newEmail) return;

      const emailToAdd: ContactEmail = {
        ...newEmail,
        ...updates,
      };

      // Remove temp ID before saving
      delete emailToAdd._tempId;

      const updatedEmails = [...emails, emailToAdd];
      await onSave(updatedEmails);

      setNewEmail(null);
      setIsAdding(false);
    },
    [newEmail, emails, onSave]
  );

  const handleSaveExisting = useCallback(
    async (email: ContactEmail, updates: Partial<ContactEmail>) => {
      const updatedEmails = emails.map((e) => {
        if (e.id === email.id || e._tempId === email._tempId) {
          return { ...e, ...updates };
        }
        return e;
      });
      await onSave(updatedEmails);
      setEditingId(null);
    },
    [emails, onSave]
  );

  const handleSetPrimary = useCallback(
    async (email: ContactEmail) => {
      const updatedEmails = emails.map((e) => ({
        ...e,
        is_primary: e.id === email.id || e._tempId === email._tempId,
      }));
      await onSave(updatedEmails);
    },
    [emails, onSave]
  );

  const handleDelete = useCallback(
    async (email: ContactEmail) => {
      let updatedEmails: ContactEmail[];

      if (email.id) {
        // Soft delete for saved emails
        updatedEmails = emails.map((e) =>
          e.id === email.id ? { ...e, _destroy: true } : e
        );
      } else {
        // Hard delete for unsaved emails
        updatedEmails = emails.filter(
          (e) => e._tempId !== email._tempId
        );
      }

      // If we deleted the primary, make the first remaining one primary
      const remaining = updatedEmails.filter((e) => !e._destroy);
      const hasPrimary = remaining.some((e) => e.is_primary);
      if (!hasPrimary && remaining.length > 0) {
        const firstId = remaining[0].id || remaining[0]._tempId;
        updatedEmails = updatedEmails.map((e) => ({
          ...e,
          is_primary: e.id === firstId || e._tempId === firstId,
        }));
      }

      await onSave(updatedEmails);
    },
    [emails, onSave]
  );

  return (
    <div className={cn("space-y-1", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Emails</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={handleAdd}
          disabled={isAdding}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Email list */}
      <div className="space-y-0.5">
        {visibleEmails.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground italic py-2 px-2">
            No email addresses
          </p>
        )}

        {visibleEmails.map((email) => (
          <EmailRow
            key={email.id || email._tempId}
            email={email}
            isEditing={editingId === (email.id || email._tempId)}
            onStartEdit={() => setEditingId(email.id || email._tempId || null)}
            onSave={(updates) => handleSaveExisting(email, updates)}
            onSetPrimary={() => handleSetPrimary(email)}
            onDelete={() => handleDelete(email)}
          />
        ))}

        {/* New email row */}
        {isAdding && newEmail && (
          <EmailRow
            email={newEmail}
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

export default EmailPropertyGroup;
