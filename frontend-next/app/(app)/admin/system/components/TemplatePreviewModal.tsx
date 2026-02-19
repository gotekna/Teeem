"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

const A4_HEIGHT_PX = 1123; // 297mm at 96dpi

interface TemplatePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  previewHtml: string;
  loading: boolean;
  /** Optional action button in footer */
  actionButton?: React.ReactNode;
}

export function TemplatePreviewModal({
  open,
  onOpenChange,
  title,
  previewHtml,
  loading,
  actionButton,
}: TemplatePreviewModalProps) {
  const mainIframeRef = React.useRef<HTMLIFrameElement>(null);
  const [pageCount, setPageCount] = React.useState(1);
  const [activePage, setActivePage] = React.useState(0);
  const [contentHeight, setContentHeight] = React.useState(A4_HEIGHT_PX);

  // Calculate page count after iframe loads
  const handleIframeLoad = React.useCallback(() => {
    const iframe = mainIframeRef.current;
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument;
      if (doc?.body) {
        const height = doc.body.scrollHeight;
        setContentHeight(height);
        // Tolerance of 30px to handle sub-pixel rounding from CSS min-height: 297mm
        const PAGE_TOLERANCE = 30;
        setPageCount(Math.max(1, Math.ceil((height - PAGE_TOLERANCE) / A4_HEIGHT_PX)));
      }
    } catch (err) {
      console.error("[TemplatePreviewModal] Cross-origin or sandbox restriction on page count:", err);
      setPageCount(1);
    }
  }, []);

  // Track scroll position in main iframe to highlight active thumbnail
  React.useEffect(() => {
    const iframe = mainIframeRef.current;
    if (!iframe || !previewHtml) return;

    const handleScroll = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.documentElement) {
          const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop;
          const page = Math.floor(scrollTop / A4_HEIGHT_PX);
          setActivePage(Math.min(page, pageCount - 1));
        }
      } catch (err) {
        console.error("[TemplatePreviewModal] Cross-origin error on scroll position read:", err);
      }
    };

    // Attach scroll listener to iframe content
    const attachListener = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          doc.addEventListener("scroll", handleScroll);
          return () => doc.removeEventListener("scroll", handleScroll);
        }
      } catch (err) {
        console.error("[TemplatePreviewModal] Cross-origin error attaching scroll listener:", err);
      }
    };

    // Try attaching after a small delay for iframe to fully load
    const timer = setTimeout(attachListener, 200);
    return () => clearTimeout(timer);
  }, [previewHtml, pageCount]);

  // Scroll main iframe to a specific page
  const scrollToPage = React.useCallback((pageIndex: number) => {
    const iframe = mainIframeRef.current;
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument;
      if (doc) {
        doc.documentElement.scrollTop = pageIndex * A4_HEIGHT_PX;
        setActivePage(pageIndex);
      }
    } catch (err) {
      console.error("[TemplatePreviewModal] Cross-origin error on scroll to page:", err);
    }
  }, []);

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setActivePage(0);
      setPageCount(1);
    }
  }, [open]);

  // Inject CSS to adapt A4-sized template HTML for iframe preview
  // Templates use width:210mm and min-height:297mm for PDF generation,
  // which causes overflow and multi-page reflow in the iframe
  const styledPreviewHtml = React.useMemo(() => {
    if (!previewHtml) return "";
    const iframeCSS = `
      <style>
        *{box-sizing:border-box}
        html,body{width:100%!important;max-width:100%!important;min-height:auto!important;margin:0;padding:0;overflow-x:hidden}
        .page{width:100%!important;max-width:100%!important;min-height:auto!important;box-sizing:border-box;overflow:hidden;page-break-after:auto!important}
      </style>
    `;
    return previewHtml.includes("</head>")
      ? previewHtml.replace("</head>", `${iframeCSS}</head>`)
      : `${iframeCSS}${previewHtml}`;
  }, [previewHtml]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[950px] h-[100vh] max-h-[100vh] overflow-hidden flex flex-col rounded-none sm:rounded-lg p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex gap-0 px-4 pb-4">
          {/* Left: Page Thumbnails */}
          {!loading && previewHtml && pageCount > 1 && (
            <div className="w-[120px] shrink-0 overflow-y-auto pr-2 space-y-2">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToPage(i)}
                  className={cn(
                    "w-full rounded border-2 transition-all hover:border-primary/50 overflow-hidden relative",
                    activePage === i
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border"
                  )}
                >
                  {/* Scaled-down page thumbnail */}
                  <div
                    className="relative bg-white"
                    style={{
                      width: "100%",
                      paddingBottom: "141.4%", // A4 ratio (297/210)
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "793px", // A4 width at 96dpi
                        height: `${A4_HEIGHT_PX}px`,
                        transform: "scale(0.14)",
                        transformOrigin: "top left",
                        pointerEvents: "none",
                        overflow: "hidden",
                      }}
                    >
                      <iframe
                        srcDoc={styledPreviewHtml}
                        className="border-0"
                        style={{
                          width: "793px",
                          height: `${contentHeight}px`,
                          marginTop: `-${i * A4_HEIGHT_PX}px`,
                        }}
                        title={`Page ${i + 1} thumbnail`}
                        tabIndex={-1}
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </div>
                  {/* Page number */}
                  <div className="text-[10px] text-muted-foreground text-center py-0.5 bg-muted/50">
                    {i + 1}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Right: Full Preview */}
          <div className="flex-1 min-w-0 overflow-hidden border rounded-lg bg-white">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Spinner size={32} className="text-muted-foreground" />
              </div>
            ) : previewHtml ? (
              <iframe
                ref={mainIframeRef}
                srcDoc={styledPreviewHtml}
                className="w-full h-full bg-white border-0"
                title="Template Preview"
                onLoad={handleIframeLoad}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Failed to load preview</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between px-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {pageCount > 1 && (
              <span className="text-xs text-muted-foreground">
                {pageCount} pages
              </span>
            )}
          </div>
          {actionButton}
        </div>
      </DialogContent>
    </Dialog>
  );
}
