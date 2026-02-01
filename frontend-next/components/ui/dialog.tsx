"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import * as React from "react";
import { cn } from "../../lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Start below header (top-12 = 48px) so header/breadcrumb stay accessible
      // z-[1100] to be above Leaflet map controls (z-1000) and EntityConfigurationTab fullscreen overlay (z-120)
      "fixed top-12 left-0 right-0 bottom-0 z-[1100] bg-black/50 data-[state=closed]:animate-[dialog-overlay-hide_100ms] data-[state=open]:animate-[dialog-overlay-show_100ms]",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideClose?: boolean;
  }
>(({ className, children, hideClose, onOpenAutoFocus, onPointerDownOutside, onInteractOutside, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      onPointerDownOutside={(e) => {
        // Allow clicks on writing-checker tooltips (rendered outside dialog portal)
        // These tooltips use createRoot portal to document.body, which Radix treats as "outside"
        const target = e.target as HTMLElement;
        const isWritingChecker = target.closest('[data-writing-checker-tooltip]');
        if (isWritingChecker) {
          console.log('[Dialog] Allowing writing-checker tooltip click');
          e.preventDefault(); // Prevent Radix from closing dialog or blocking event
          return;
        }
        onPointerDownOutside?.(e);
      }}
      onInteractOutside={(e) => {
        // Also handle onInteractOutside for writing-checker tooltips
        const target = e.target as HTMLElement;
        if (target.closest('[data-writing-checker-tooltip]')) {
          console.log('[Dialog] Allowing writing-checker tooltip interaction');
          e.preventDefault();
          return;
        }
        onInteractOutside?.(e);
      }}
      onOpenAutoFocus={(e) => {
        // Prevent auto-focus to avoid aria-hidden conflict
        e.preventDefault();
        // Find first focusable element in dialog and focus it after a microtask
        // to ensure aria-hidden has been applied to background
        setTimeout(() => {
          const dialog = document.querySelector('[role="dialog"]');
          if (dialog) {
            const firstFocusable = dialog.querySelector<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            firstFocusable?.focus();
          }
        }, 0);
        onOpenAutoFocus?.(e);
      }}
      className={cn(
        "bg-background border-border border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[calc(100svh-10vw)] overflow-y-auto w-[90vw] max-w-xl p-6 text-foreground z-[1100] data-[state=closed]:animate-[dialog-content-hide_100ms] data-[state=open]:animate-[dialog-content-show_100ms]",
        className,
      )}
      {...props}
    >
      {children}

      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-6 top-6 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <Cross2Icon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogContentFrameless = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onOpenAutoFocus, onPointerDownOutside, onInteractOutside, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      onPointerDownOutside={(e) => {
        // Allow clicks on writing-checker tooltips (rendered outside dialog portal)
        const target = e.target as HTMLElement;
        if (target.closest('[data-writing-checker-tooltip]')) {
          e.preventDefault();
          return;
        }
        onPointerDownOutside?.(e);
      }}
      onInteractOutside={(e) => {
        // Also handle onInteractOutside for writing-checker tooltips
        const target = e.target as HTMLElement;
        if (target.closest('[data-writing-checker-tooltip]')) {
          e.preventDefault();
          return;
        }
        onInteractOutside?.(e);
      }}
      onOpenAutoFocus={(e) => {
        // Prevent auto-focus to avoid aria-hidden conflict
        e.preventDefault();
        // Find first focusable element in dialog and focus it after a microtask
        // to ensure aria-hidden has been applied to background
        setTimeout(() => {
          const dialog = document.querySelector('[role="dialog"]');
          if (dialog) {
            const firstFocusable = dialog.querySelector<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            firstFocusable?.focus();
          }
        }, 0);
        onOpenAutoFocus?.(e);
      }}
      className={cn(
        "fixed bg-background top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-xl border dark:border-none dark:p-px text-foreground z-[1100] data-[state=closed]:animate-[dialog-content-hide_100ms] data-[state=open]:animate-[dialog-content-show_100ms]",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight mb-4",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-text-muted", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogContentFrameless,
};
