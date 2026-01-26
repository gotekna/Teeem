"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export interface ConfirmationDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback when dialog open state changes
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Dialog title
   */
  title: string;

  /**
   * Dialog description/message
   */
  description: string;

  /**
   * Callback when confirm button is clicked
   * If returns a Promise, shows loading state until resolved
   */
  onConfirm: () => void | Promise<void>;

  /**
   * Optional callback when cancel button is clicked
   */
  onCancel?: () => void;

  /**
   * Confirm button label
   * @default "Confirm"
   */
  confirmLabel?: string;

  /**
   * Cancel button label
   * @default "Cancel"
   */
  cancelLabel?: string;

  /**
   * Button variant for confirm button
   * @default "default"
   */
  variant?: "default" | "destructive";

  /**
   * Whether confirm action is currently loading
   * When true, shows spinner and disables buttons
   */
  loading?: boolean;
}

/**
 * Confirmation Dialog Component
 *
 * SSoT for all confirmation dialogs in the app (delete, cancel, discard, etc.)
 * Replaces 25+ inline AlertDialog implementations.
 *
 * Features:
 * - Consistent styling across the app
 * - Built-in loading state for async operations
 * - Destructive variant for dangerous actions
 * - Proper accessibility
 *
 * @example
 * ```tsx
 * // Simple delete confirmation
 * <ConfirmationDialog
 *   open={showConfirm}
 *   onOpenChange={setShowConfirm}
 *   title="Delete Contact?"
 *   description="This action cannot be undone."
 *   variant="destructive"
 *   confirmLabel="Delete"
 *   onConfirm={handleDelete}
 * />
 *
 * // Async operation with loading
 * <ConfirmationDialog
 *   open={showConfirm}
 *   onOpenChange={setShowConfirm}
 *   title="Save Changes?"
 *   description="Your changes will be saved."
 *   loading={saving}
 *   onConfirm={async () => {
 *     setSaving(true);
 *     await saveChanges();
 *     setSaving(false);
 *     setShowConfirm(false);
 *   }}
 * />
 * ```
 */
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
}: ConfirmationDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);

  const isLoading = loading || internalLoading;

  const handleConfirm = async () => {
    const result = onConfirm();

    // If onConfirm returns a promise, show loading state
    if (result instanceof Promise) {
      setInternalLoading(true);
      try {
        await result;
      } finally {
        setInternalLoading(false);
      }
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              variant === "destructive" &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {isLoading ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                {confirmLabel}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook for managing confirmation dialog state
 *
 * @example
 * ```tsx
 * const { confirm, ConfirmDialog } = useConfirmation();
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: "Delete?",
 *     description: "This cannot be undone.",
 *     variant: "destructive",
 *   });
 *   if (confirmed) {
 *     await deleteItem();
 *   }
 * };
 *
 * return (
 *   <>
 *     <Button onClick={handleDelete}>Delete</Button>
 *     <ConfirmDialog />
 *   </>
 * );
 * ```
 */
export function useConfirmation() {
  const [state, setState] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    variant: "default" | "destructive";
    confirmLabel: string;
    cancelLabel: string;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    title: "",
    description: "",
    variant: "default",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    resolve: null,
  });

  const confirm = React.useCallback(
    (options: {
      title: string;
      description: string;
      variant?: "default" | "destructive";
      confirmLabel?: string;
      cancelLabel?: string;
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          open: true,
          title: options.title,
          description: options.description,
          variant: options.variant ?? "default",
          confirmLabel: options.confirmLabel ?? "Confirm",
          cancelLabel: options.cancelLabel ?? "Cancel",
          resolve,
        });
      });
    },
    []
  );

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (!open && state.resolve) {
      state.resolve(false);
    }
    setState((prev) => ({ ...prev, open, resolve: open ? prev.resolve : null }));
  }, [state.resolve]);

  const handleConfirm = React.useCallback(() => {
    if (state.resolve) {
      state.resolve(true);
    }
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  const ConfirmDialog = React.useCallback(
    () => (
      <ConfirmationDialog
        open={state.open}
        onOpenChange={handleOpenChange}
        title={state.title}
        description={state.description}
        variant={state.variant}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        onConfirm={handleConfirm}
      />
    ),
    [state, handleOpenChange, handleConfirm]
  );

  return { confirm, ConfirmDialog };
}

export default ConfirmationDialog;
