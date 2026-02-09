import * as React from "react";
import { cn } from "@/lib/utils";

interface PdfChromeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface PdfFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const PdfChrome = React.forwardRef<HTMLDivElement, PdfChromeProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex-1 overflow-auto bg-muted/20 relative", className)}
      {...props}
    >
      {children}
    </div>
  )
);
PdfChrome.displayName = "PdfChrome";

const PdfFrame = React.forwardRef<HTMLDivElement, PdfFrameProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "overflow-visible ring-1 ring-border/50 shadow-sm rounded-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
PdfFrame.displayName = "PdfFrame";

export { PdfChrome, PdfFrame };
