"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const Sheet = ({ modal = true, ...props }: SheetPrimitive.DialogProps & { modal?: boolean }) => (
  <SheetPrimitive.Root modal={modal} {...props} />
);

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      // Start below header (top-12 = 48px) so header/breadcrumb stay accessible
      // z-[130] to be above EntityConfigurationTab (z-[120]) fullscreen overlay
      "fixed top-12 left-0 right-0 bottom-0 z-[130] bg-background/60 dark:bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  // Start below header (top-12 = 48px) so header/breadcrumb stay accessible
  // z-[130] to be above EntityConfigurationTab (z-[120]) fullscreen overlay
  "fixed z-[130] gap-4 transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
  {
    variants: {
      side: {
        top: "inset-x-0 top-12 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "top-12 bottom-0 left-0 w-3/4 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "top-12 bottom-0 right-0 w-3/4 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-[520px]",
        "right-half":
          "top-12 bottom-0 right-0 w-[50vw] min-w-[50vw] max-w-[50vw] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        "right-full":
          "top-12 bottom-0 right-0 w-[calc(100vw-64px)] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        "right-xl":
          "top-12 bottom-0 right-0 w-[600px] max-w-[600px] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        "right-wide":
          "top-12 bottom-0 right-0 w-[800px] max-w-[800px] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  stack?: boolean;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(
  (
    { side = "right", stack = false, className, children, title, ...props },
    ref,
  ) => {
    const contentRef = React.useRef<HTMLDivElement>(null);

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          onOpenAutoFocus={(e) => {
            // Focus the content container instead of preventing focus entirely
            // This avoids the aria-hidden warning while maintaining accessibility
            e.preventDefault();
            contentRef.current?.focus();
          }}
          ref={ref}
          className={cn("md:p-4", sheetVariants({ side }))}
          aria-describedby={props["aria-describedby"] || undefined}
          {...props}
        >
          <div
            ref={contentRef}
            tabIndex={-1}
            className={cn(
              "border w-full h-full bg-background p-6 relative overflow-hidden outline-none",
              className,
            )}
          >
            <SheetTitle className="sr-only">{title}</SheetTitle>
            {children}
          </div>
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
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
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
