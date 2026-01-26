"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import {
  Paperclip,
  File,
  FileImage,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileCog,
  X,
  Download,
} from "lucide-react";

// =============================================================================
// FILE TYPE DETECTION (SSoT)
// =============================================================================
// Consolidated from: AttachmentList.tsx, RevitTab.tsx, ContactDocumentsTab.tsx,
// document-viewer-modal.tsx

type FileCategory =
  | "image"
  | "pdf"
  | "word"
  | "spreadsheet"
  | "cad"
  | "revit"
  | "design3d"
  | "default";

const FILE_EXTENSIONS: Record<FileCategory, string[]> = {
  // Images → FileImage
  image: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"],

  // PDF → FileText (red)
  pdf: ["pdf"],

  // Word → FileText (blue)
  word: ["doc", "docx"],

  // Excel/Spreadsheet → FileSpreadsheet (green)
  spreadsheet: ["xlsx", "xls", "csv"],

  // CAD → FileCode (blue)
  cad: ["dwg", "dxf"],

  // Revit/BIM → FileCog (orange)
  revit: ["rvt", "rfa", "rte", "rft"],

  // 3D/Design → FileCog (purple) - SketchUp, Unreal Datasmith
  design3d: ["skp", "udatasmith", "datasmith"],

  // Default → File
  default: [],
};

const CONTENT_TYPE_PATTERNS: Array<{ pattern: RegExp; category: FileCategory }> = [
  { pattern: /^image\//i, category: "image" },
  { pattern: /pdf/i, category: "pdf" },
  { pattern: /word|document/i, category: "word" },
  { pattern: /spreadsheet|excel|sheet/i, category: "spreadsheet" },
];

function detectFileCategory(
  fileName?: string,
  contentType?: string
): FileCategory {
  // Check content type first (more reliable)
  if (contentType) {
    const lowerType = contentType.toLowerCase();
    for (const { pattern, category } of CONTENT_TYPE_PATTERNS) {
      if (pattern.test(lowerType)) {
        return category;
      }
    }
  }

  // Check file extension
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    for (const [category, extensions] of Object.entries(FILE_EXTENSIONS)) {
      if (extensions.includes(ext)) {
        return category as FileCategory;
      }
    }
  }

  return "default";
}

// Icon and color mapping per category
const FILE_CATEGORY_CONFIG: Record<
  FileCategory,
  { icon: typeof File; colorClass: string }
> = {
  image: {
    icon: FileImage,
    colorClass: "text-purple-500 dark:text-purple-400",
  },
  pdf: { icon: FileText, colorClass: "text-red-600 dark:text-red-400" },
  word: { icon: FileText, colorClass: "text-blue-500 dark:text-blue-400" },
  spreadsheet: {
    icon: FileSpreadsheet,
    colorClass: "text-green-500 dark:text-green-400",
  },
  cad: { icon: FileCode, colorClass: "text-blue-500 dark:text-blue-400" },
  revit: { icon: FileCog, colorClass: "text-orange-500 dark:text-orange-400" },
  design3d: { icon: FileCog, colorClass: "text-purple-500 dark:text-purple-400" },
  default: { icon: File, colorClass: "text-muted-foreground" },
};

// =============================================================================
// SIZE CONFIGURATION
// =============================================================================

const SIZE_CONFIG = {
  xs: { icon: "h-3 w-3", text: "text-xs", padding: "px-1.5 py-0.5", gap: "gap-1" },
  sm: { icon: "h-3.5 w-3.5", text: "text-xs", padding: "px-2 py-1", gap: "gap-1.5" },
  md: { icon: "h-4 w-4", text: "text-sm", padding: "px-2.5 py-1", gap: "gap-2" },
} as const;

// =============================================================================
// VARIANT CONFIGURATION
// =============================================================================

const VARIANT_CONFIG = {
  default: "bg-muted/50 border-border text-foreground",
  muted: "bg-muted/30 border-transparent text-muted-foreground",
  success: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400",
  primary: "bg-primary/10 border-primary/20 text-primary dark:bg-primary/20",
} as const;

// =============================================================================
// UTILITY: FORMAT FILE SIZE
// =============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// =============================================================================
// ATTACHMENT BADGE COMPONENT
// =============================================================================

export interface AttachmentBadgeProps {
  // Display
  fileName?: string; // For file type detection + fallback display
  displayName?: string; // What to show (overrides fileName)
  contentType?: string; // MIME type for icon detection
  fileSize?: number; // Bytes - shows formatted size
  count?: number; // Badge count (indicator mode)

  // Appearance
  size?: "xs" | "sm" | "md";
  variant?: "default" | "muted" | "success" | "primary";
  loading?: boolean; // Shows spinner
  truncate?: boolean; // Truncate long names (default true)

  // Actions (when present, component becomes interactive)
  onDownload?: () => void; // Click
  onOpen?: () => void; // Double-click
  onRemove?: () => void; // Shows X button

  // Drag and Drop
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  dragData?: Record<string, unknown>;

  className?: string;
}

/**
 * AttachmentBadge - THE ONE component for attachment indicators and file badges.
 *
 * SSoT for:
 * - File type icon detection (from extension or content type)
 * - Attachment count indicators (paperclip icon)
 * - File badges with actions (download, remove)
 *
 * @example
 * // Simple indicator (paperclip only)
 * <AttachmentBadge />
 * <AttachmentBadge count={3} variant="success" />
 *
 * // With file type icon (auto-detected from fileName/contentType)
 * <AttachmentBadge fileName="report.pdf" />
 * <AttachmentBadge fileName="photo.jpg" contentType="image/jpeg" />
 *
 * // With display name
 * <AttachmentBadge fileName="report.pdf" displayName="Q4 Report" />
 *
 * // With loading state
 * <AttachmentBadge fileName="report.pdf" loading />
 *
 * // With size
 * <AttachmentBadge fileName="report.pdf" fileSize={1024000} />
 *
 * // With actions (becomes clickable)
 * <AttachmentBadge
 *   fileName="report.pdf"
 *   displayName="Q4 Report"
 *   onDownload={handleDownload}
 *   onRemove={handleRemove}
 * />
 *
 * // Draggable attachment
 * <AttachmentBadge
 *   fileName="report.pdf"
 *   draggable
 *   dragData={{ id: attachment.id, type: 'attachment' }}
 * />
 */
export function AttachmentBadge({
  fileName,
  displayName,
  contentType,
  fileSize,
  count,
  size = "sm",
  variant = "default",
  loading = false,
  truncate = true,
  onDownload,
  onOpen,
  onRemove,
  draggable = false,
  onDragStart,
  onDragEnd,
  dragData,
  className,
}: AttachmentBadgeProps) {
  const sizeConfig = SIZE_CONFIG[size];
  const variantConfig = VARIANT_CONFIG[variant];

  // Determine if this is indicator mode (no file info) or badge mode
  const isIndicatorMode = !fileName && !displayName;

  // Detect file category and get icon config
  const category = detectFileCategory(fileName, contentType);
  const { icon: FileIcon, colorClass } = FILE_CATEGORY_CONFIG[category];

  // What icon to show
  const IconComponent = isIndicatorMode ? Paperclip : FileIcon;
  const iconColorClass = isIndicatorMode ? "text-muted-foreground" : colorClass;

  // Display text
  const displayText = displayName || fileName;

  // Is this interactive?
  const isInteractive = Boolean(onDownload || onOpen);

  // Handle click
  const handleClick = React.useCallback(() => {
    if (loading) return;
    onDownload?.();
  }, [loading, onDownload]);

  // Handle double click
  const handleDoubleClick = React.useCallback(() => {
    if (loading) return;
    onOpen?.();
  }, [loading, onOpen]);

  // Handle remove
  const handleRemove = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove?.();
    },
    [onRemove]
  );

  // Drag handlers
  const handleDragStart = React.useCallback(
    (e: React.DragEvent) => {
      if (dragData) {
        e.dataTransfer.setData("application/json", JSON.stringify(dragData));
      }
      onDragStart?.(e);
    },
    [dragData, onDragStart]
  );

  const handleDragEnd = React.useCallback(
    (e: React.DragEvent) => {
      onDragEnd?.(e);
    },
    [onDragEnd]
  );

  // Indicator mode: just icon (+ optional count)
  if (isIndicatorMode) {
    return (
      <span
        className={cn(
          "inline-flex items-center",
          sizeConfig.gap,
          loading && "opacity-50",
          className
        )}
      >
        {loading ? (
          <Spinner className={sizeConfig.icon} />
        ) : (
          <Paperclip className={cn(sizeConfig.icon, "text-muted-foreground")} />
        )}
        {typeof count === "number" && count > 0 && (
          <span className={cn(sizeConfig.text, "font-medium")}>{count}</span>
        )}
      </span>
    );
  }

  // Badge mode: full badge with file info
  return (
    <span
      className={cn(
        "inline-flex items-center border transition-colors",
        sizeConfig.padding,
        sizeConfig.gap,
        variantConfig,
        isInteractive && "cursor-pointer hover:bg-muted hover:border-primary/50",
        draggable && "cursor-grab active:cursor-grabbing",
        loading && "opacity-50 pointer-events-none",
        className
      )}
      onClick={isInteractive ? handleClick : undefined}
      onDoubleClick={onOpen ? handleDoubleClick : undefined}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? handleDragEnd : undefined}
      title={
        isInteractive
          ? "Click to download" + (onOpen ? ", double-click to open" : "")
          : displayText
      }
    >
      {/* Icon or spinner */}
      {loading ? (
        <Spinner className={cn(sizeConfig.icon, "shrink-0")} />
      ) : (
        <IconComponent className={cn(sizeConfig.icon, iconColorClass, "shrink-0")} />
      )}

      {/* Display text */}
      {displayText && (
        <span
          className={cn(
            sizeConfig.text,
            "font-medium",
            truncate && "truncate max-w-[200px]"
          )}
        >
          {displayText}
        </span>
      )}

      {/* File size */}
      {typeof fileSize === "number" && fileSize > 0 && (
        <span className={cn(sizeConfig.text, "text-muted-foreground shrink-0")}>
          {formatFileSize(fileSize)}
        </span>
      )}

      {/* Download indicator (when interactive) */}
      {isInteractive && !onRemove && (
        <Download
          className={cn(sizeConfig.icon, "text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100")}
        />
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className={cn(
            "shrink-0 rounded-sm opacity-70 hover:opacity-100 focus:outline-none",
            "hover:bg-muted-foreground/20"
          )}
        >
          <X className={sizeConfig.icon} />
          <span className="sr-only">Remove</span>
        </button>
      )}
    </span>
  );
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

/**
 * Get the file category for a given file name and/or content type.
 * Useful for external styling or logic.
 */
export { detectFileCategory, formatFileSize };
export type { FileCategory };
