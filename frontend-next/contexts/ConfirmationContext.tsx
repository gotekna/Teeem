"use client";

/**
 * ConfirmationContext - SSoT for confirmation dialogs
 *
 * Replaces native browser confirm() with styled AlertDialog.
 * Provides promise-based API for easy migration:
 *
 * Before: if (confirm("Delete this?")) { ... }
 * After:  if (await confirm("Delete this?")) { ... }
 *
 * Features:
 * - Matches design system (dark mode, accessibility)
 * - Customizable title, description, button labels
 * - Destructive variant for dangerous actions
 * - Promise-based API for async/await usage
 *
 * @example
 * // Simple usage
 * const { confirm } = useConfirm();
 * if (await confirm("Delete this item?")) {
 *   // User confirmed
 * }
 *
 * @example
 * // Full customization
 * const confirmed = await confirm({
 *   title: "Delete Document",
 *   description: "This action cannot be undone.",
 *   confirmLabel: "Delete",
 *   cancelLabel: "Keep",
 *   variant: "destructive"
 * });
 */

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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Types
export interface ConfirmOptions {
  /** Dialog title (default: "Confirm") */
  title?: string;
  /** Dialog description/message */
  description: string;
  /** Confirm button label (default: "Confirm") */
  confirmLabel?: string;
  /** Cancel button label (default: "Cancel") */
  cancelLabel?: string;
  /** Use destructive styling for dangerous actions */
  variant?: "default" | "destructive";
}

type ConfirmInput = string | ConfirmOptions;

interface ConfirmationContextValue {
  confirm: (input: ConfirmInput) => Promise<boolean>;
}

const ConfirmationContext = React.createContext<ConfirmationContextValue | null>(null);

// Internal state for the dialog
interface DialogState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolve: ((value: boolean) => void) | null;
}

const defaultOptions: ConfirmOptions = {
  title: "Confirm",
  description: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  variant: "default",
};

export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DialogState>({
    isOpen: false,
    options: defaultOptions,
    resolve: null,
  });

  const confirm = React.useCallback((input: ConfirmInput): Promise<boolean> => {
    return new Promise((resolve) => {
      const options: ConfirmOptions =
        typeof input === "string"
          ? { ...defaultOptions, description: input }
          : { ...defaultOptions, ...input };

      setState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = React.useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const { options } = state;
  const isDestructive = options.variant === "destructive";

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={state.isOpen} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title}</AlertDialogTitle>
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {options.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                isDestructive && buttonVariants({ variant: "destructive" })
              )}
            >
              {options.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmationContext.Provider>
  );
}

/**
 * Hook to access the confirmation dialog
 *
 * @returns Object with confirm function
 * @throws Error if used outside ConfirmationProvider
 *
 * @example
 * const { confirm } = useConfirm();
 * const handleDelete = async () => {
 *   if (await confirm("Delete this item?")) {
 *     await deleteItem();
 *   }
 * };
 */
export function useConfirm(): ConfirmationContextValue {
  const context = React.useContext(ConfirmationContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmationProvider");
  }
  return context;
}
