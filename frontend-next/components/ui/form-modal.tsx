"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

export interface FormModalProps {
  /**
   * Whether the modal is open
   */
  open: boolean;

  /**
   * Callback when modal open state changes
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Modal title
   */
  title: string;

  /**
   * Optional modal description
   */
  description?: string;

  /**
   * Form submission handler
   * If returns a Promise, shows loading state until resolved
   */
  onSubmit: (e: React.FormEvent) => void | Promise<void>;

  /**
   * Whether the form is currently submitting
   * When true, shows spinner on submit button and disables inputs
   */
  isLoading?: boolean;

  /**
   * Submit button label
   * @default "Save"
   */
  submitLabel?: string;

  /**
   * Cancel button label
   * @default "Cancel"
   */
  cancelLabel?: string;

  /**
   * Whether to show the cancel button
   * @default true
   */
  showCancel?: boolean;

  /**
   * Form content (inputs, fields, etc.)
   */
  children: React.ReactNode;

  /**
   * Additional class name for the form content area
   */
  className?: string;

  /**
   * Modal size
   * @default "default"
   */
  size?: "sm" | "default" | "lg" | "xl" | "full";

  /**
   * Optional footer content (appears before buttons)
   */
  footer?: React.ReactNode;

  /**
   * Callback when cancel button is clicked
   */
  onCancel?: () => void;
}

const sizeClasses = {
  sm: "sm:max-w-sm",
  default: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-[90vw] sm:h-[90vh]",
};

/**
 * Form Modal Component
 *
 * SSoT for all form modals in the app (add, edit, create dialogs).
 * Replaces 40+ inline Dialog + form implementations.
 *
 * Features:
 * - Consistent modal structure
 * - Built-in form handling with submit/cancel
 * - Loading state management
 * - Multiple size options
 * - Proper accessibility
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FormModal
 *   open={showModal}
 *   onOpenChange={setShowModal}
 *   title="Add Contact"
 *   isLoading={saving}
 *   onSubmit={handleSubmit}
 * >
 *   <FormField label="Name" error={errors.name} required>
 *     <Input value={name} onChange={(e) => setName(e.target.value)} />
 *   </FormField>
 *   <FormField label="Email" error={errors.email}>
 *     <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
 *   </FormField>
 * </FormModal>
 *
 * // Large modal with custom footer
 * <FormModal
 *   open={showModal}
 *   onOpenChange={setShowModal}
 *   title="Edit Settings"
 *   size="lg"
 *   isLoading={saving}
 *   onSubmit={handleSubmit}
 *   footer={<p className="text-sm text-muted-foreground">Changes are saved immediately</p>}
 * >
 *   {children}
 * </FormModal>
 * ```
 */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  isLoading = false,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  showCancel = true,
  children,
  className,
  size = "default",
  footer,
  onCancel,
}: FormModalProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);

  const loading = isLoading || internalLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = onSubmit(e);

    // If onSubmit returns a promise, show loading state
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

  // Prevent closing during loading
  const handleOpenChange = (newOpen: boolean) => {
    if (loading && !newOpen) {
      return; // Don't close while loading
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(sizeClasses[size])}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>

          <div className={cn("py-4", className)}>{children}</div>

          <DialogFooter className="gap-2">
            {footer}
            {showCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
              >
                {cancelLabel}
              </Button>
            )}
            <SubmitButton
              type="submit"
              isSubmitting={loading}
            >
              {submitLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default FormModal;
