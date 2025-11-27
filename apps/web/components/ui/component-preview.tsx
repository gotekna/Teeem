"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone,
  Tablet,
  Copy,
  Check,
  Code2,
  Eye,
  Package,
  ExternalLink,
  FileCode,
} from "lucide-react";
import { Button } from "./button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

export interface Dependency {
  name: string;
  version?: string;
  url?: string;
  type: "npm" | "radix" | "internal" | "other";
}

interface ComponentPreviewProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  code?: string;
  className?: string;
  align?: "start" | "center" | "end";
  dependencies?: Dependency[];
  sourceFile?: string;
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const viewportWidths: Record<ViewportSize, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

// Helper function to get dependency URL
function getDependencyUrl(dep: Dependency): string {
  if (dep.url) return dep.url;

  switch (dep.type) {
    case "npm":
      return `https://www.npmjs.com/package/${dep.name}`;
    case "radix":
      const radixName = dep.name.replace("@radix-ui/react-", "");
      return `https://www.radix-ui.com/primitives/docs/components/${radixName}`;
    case "internal":
      return `#${dep.name}`;
    default:
      return "#";
  }
}

// Dependency badge component
function DependencyBadge({ dep }: { dep: Dependency }) {
  const url = getDependencyUrl(dep);
  const isExternal = dep.type !== "internal";

  const typeColors = {
    npm: "bg-[#CB3837]/10 text-[#CB3837] dark:bg-[#CB3837]/20",
    radix: "bg-[#7C66DC]/10 text-[#7C66DC] dark:bg-[#7C66DC]/20",
    internal: "bg-secondary text-text-secondary",
    other: "bg-secondary text-text-secondary",
  };

  return (
    <a
      href={url}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 text-brand-xs font-medium transition-opacity hover:opacity-80",
        typeColors[dep.type]
      )}
    >
      <span>{dep.name}</span>
      {dep.version && (
        <span className="opacity-60">@{dep.version}</span>
      )}
      {isExternal && <ExternalLink className="h-3 w-3 opacity-60" />}
    </a>
  );
}

export function ComponentPreview({
  children,
  title,
  description,
  code,
  className,
  align = "start",
  dependencies,
  sourceFile,
}: ComponentPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");

  const handleCopyCode = useCallback(async () => {
    if (code) {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const previewContent = (
    <div
      className={cn(
        "flex min-h-[200px] w-full p-6 transition-all duration-200",
        align === "center" && "items-center justify-center",
        align === "start" && "items-start justify-start",
        align === "end" && "items-end justify-end",
      )}
      style={{ maxWidth: isFullscreen ? viewportWidths[viewport] : "100%" }}
    >
      {children}
    </div>
  );

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b bg-background px-4 h-14">
          <div className="flex items-center gap-4">
            <h3 className="text-brand-md font-medium">{title}</h3>
            {description && (
              <span className="text-brand-sm text-text-muted hidden sm:inline">
                {description}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Viewport Switcher */}
            <div className="flex items-center border bg-secondary mr-2">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  viewport === "desktop" && "bg-background"
                )}
                onClick={() => setViewport("desktop")}
              >
                <Monitor className="h-4 w-4" />
                <span className="sr-only">Desktop</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  viewport === "tablet" && "bg-background"
                )}
                onClick={() => setViewport("tablet")}
              >
                <Tablet className="h-4 w-4" />
                <span className="sr-only">Tablet</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  viewport === "mobile" && "bg-background"
                )}
                onClick={() => setViewport("mobile")}
              >
                <Smartphone className="h-4 w-4" />
                <span className="sr-only">Mobile</span>
              </Button>
            </div>

            {/* Copy Code */}
            {code && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleCopyCode}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-status-success-foreground" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="sr-only">Copy code</span>
              </Button>
            )}

            {/* Exit Fullscreen */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsFullscreen(false)}
            >
              <Minimize2 className="h-4 w-4" />
              <span className="sr-only">Exit fullscreen</span>
            </Button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex items-center justify-center h-[calc(100vh-56px)] overflow-auto bg-[#F2F1EF] dark:bg-[#1D1D1D]">
          <div
            className="bg-background border shadow-sm transition-all duration-200"
            style={{ width: viewportWidths[viewport], maxWidth: "100%" }}
          >
            {previewContent}
          </div>
        </div>
      </div>
    );
  }

  // Normal view
  return (
    <div className={cn("border bg-card", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h4 className="text-brand-md font-medium">{title}</h4>
          {description && (
            <p className="text-brand-sm text-text-muted">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Tab Switcher (if code provided) */}
          {code && (
            <div className="flex items-center border bg-secondary mr-2">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-3 gap-1.5",
                  activeTab === "preview" && "bg-background"
                )}
                onClick={() => setActiveTab("preview")}
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="text-brand-xs">Preview</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-3 gap-1.5",
                  activeTab === "code" && "bg-background"
                )}
                onClick={() => setActiveTab("code")}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span className="text-brand-xs">Code</span>
              </Button>
            </div>
          )}

          {/* Dependencies Popover */}
          {dependencies && dependencies.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 gap-1.5"
                >
                  <Package className="h-4 w-4" />
                  <span className="text-brand-xs hidden sm:inline">Deps</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-text-muted" />
                    <h4 className="text-brand-md font-medium">Dependencies</h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dependencies.map((dep, i) => (
                      <DependencyBadge key={i} dep={dep} />
                    ))}
                  </div>
                  {sourceFile && (
                    <div className="pt-2 border-t">
                      <a
                        href={`vscode://file/${sourceFile}`}
                        className="flex items-center gap-2 text-brand-xs text-text-muted hover:text-foreground transition-colors"
                      >
                        <FileCode className="h-3.5 w-3.5" />
                        <span className="font-mono truncate">{sourceFile.split('/').pop()}</span>
                      </a>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Copy Code */}
          {code && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleCopyCode}
            >
              {copied ? (
                <Check className="h-4 w-4 text-status-success-foreground" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="sr-only">Copy code</span>
            </Button>
          )}

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsFullscreen(true)}
          >
            <Maximize2 className="h-4 w-4" />
            <span className="sr-only">Fullscreen</span>
          </Button>
        </div>
      </div>

      {/* Dependencies bar (shown below header if deps exist) */}
      {dependencies && dependencies.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-secondary/50">
          <span className="text-brand-xs text-text-muted">Uses:</span>
          <div className="flex flex-wrap gap-1">
            {dependencies.slice(0, 4).map((dep, i) => (
              <DependencyBadge key={i} dep={dep} />
            ))}
            {dependencies.length > 4 && (
              <span className="text-brand-xs text-text-muted px-2 py-1">
                +{dependencies.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === "preview" ? (
        <div className="bg-[#F2F1EF] dark:bg-[#1D1D1D]">
          {previewContent}
        </div>
      ) : (
        <div className="relative">
          <pre className="overflow-auto p-4 text-brand-sm font-mono bg-[#0d0d0d] text-[#f8f8f2] max-h-[400px]">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

// Simple preview card for smaller components
interface SimplePreviewProps {
  children: React.ReactNode;
  className?: string;
}

export function SimplePreview({ children, className }: SimplePreviewProps) {
  return (
    <div className={cn("p-4 bg-[#F2F1EF] dark:bg-[#1D1D1D] border", className)}>
      {children}
    </div>
  );
}
