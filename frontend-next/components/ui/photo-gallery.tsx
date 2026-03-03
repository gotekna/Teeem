"use client";

/**
 * PhotoGallery - Grid & Filmstrip views for displaying photos
 *
 * THE ONE component for displaying photos in a grid or filmstrip layout.
 * See: frontend-next/lib/component-registry.ts
 *
 * Features:
 * - Grid view: CSS Grid layout (responsive) with date grouping
 * - Filmstrip view: Large main image + scrollable vertical thumbnail strip
 * - View mode toggle (grid/filmstrip) with localStorage persistence
 * - Lazy loading images
 * - Loading skeleton state
 * - Click to open lightbox (grid) or navigate (filmstrip)
 * - Keyboard navigation in filmstrip (arrow keys)
 *
 * Usage:
 * ```tsx
 * import { PhotoGallery, PhotoItem } from "@/components/ui/photo-gallery";
 *
 * <PhotoGallery
 *   photos={photos}
 *   onPhotoClick={(photo, index) => openLightbox(index)}
 *   groupByDate
 *   loading={isLoading}
 *   viewMode="grid"
 *   onViewModeChange={(mode) => setMode(mode)}
 * />
 * ```
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  Check,
  Square,
  CheckSquare,
  Download,
  ExternalLink,
  Mail,
  LayoutGrid,
  GalleryHorizontalEnd,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getTodayAsString, getCompanyTimezone } from "@/lib/timezone-utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export interface PhotoItem {
  id: string;
  name: string;
  url: string; // Full-size image URL
  thumbnailUrl?: string; // Optional thumbnail URL (uses url if not provided)
  webUrl?: string; // SharePoint web URL for opening in browser
  createdAt?: string; // ISO date string for grouping
  modifiedAt?: string; // Last modified date
  size?: number; // File size in bytes
  mimeType?: string; // e.g., "image/jpeg"
}

export type PhotoViewMode = "grid" | "filmstrip";

export interface PhotoGalleryProps {
  /** Array of photos to display */
  photos: PhotoItem[];
  /** Callback when a photo is clicked (single click, opens lightbox) */
  onPhotoClick?: (photo: PhotoItem, index: number) => void;
  /** Callback to download/open a photo document directly (shown as button on hover) */
  onDownloadPhoto?: (photo: PhotoItem) => void;
  /** Group photos by date */
  groupByDate?: boolean;
  /** Show loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Thumbnail size: sm (100px), md (150px), lg (200px), xl (250px) */
  thumbnailSize?: "sm" | "md" | "lg" | "xl";
  /** Enable multi-select mode */
  selectable?: boolean;
  /** Currently selected photo IDs */
  selectedIds?: Set<string>;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: Set<string>) => void;
  /** Callback for actions on selected photos (e.g., delete, download) */
  onSelectionAction?: (action: string, selectedPhotos: PhotoItem[]) => void;
  /** View mode: "grid" (default) or "filmstrip" */
  viewMode?: PhotoViewMode;
  /** Callback when view mode changes (parent controls persistence) */
  onViewModeChange?: (mode: PhotoViewMode) => void;
  /** Show view mode toggle buttons */
  showViewToggle?: boolean;
}

// Skeleton loader for loading state
function PhotoSkeleton({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const sizeClasses = {
    sm: "h-24 w-24",
    md: "h-36 w-36",
    lg: "h-48 w-48",
    xl: "h-60 w-60",
  };

  return (
    <div
      className={cn(
        "rounded-none bg-muted animate-pulse",
        sizeClasses[size]
      )}
    />
  );
}

// Individual photo thumbnail
// Handles expired Microsoft Graph thumbnail URLs by falling back to proxy URL
function PhotoThumbnail({
  photo,
  index,
  onClick,
  onDownload,
  size = "md",
  selectable = false,
  isSelected = false,
  onToggleSelect,
}: {
  photo: PhotoItem;
  index: number;
  onClick?: (photo: PhotoItem, index: number) => void;
  onDownload?: (photo: PhotoItem) => void;
  size?: "sm" | "md" | "lg" | "xl";
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (photo: PhotoItem, shiftKey: boolean) => void;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  // Track if we've tried the fallback URL (prevents infinite retry loop)
  const [useFallback, setUseFallback] = React.useState(false);

  const sizeClasses = {
    sm: "h-24 w-24",
    md: "h-36 w-36",
    lg: "h-48 w-48",
    xl: "h-60 w-60",
  };

  // Try thumbnailUrl first, fall back to url (proxy) if thumbnail fails
  // Microsoft Graph thumbnail URLs expire after a few hours, so fallback is common
  const thumbnailSrc = useFallback
    ? photo.url  // Fallback to proxy URL (always works but slower)
    : (photo.thumbnailUrl || photo.url);

  // Handle thumbnail load error - try fallback before showing error state
  const handleError = () => {
    if (!useFallback && photo.thumbnailUrl && photo.url && photo.thumbnailUrl !== photo.url) {
      // Thumbnail failed (likely expired), try the proxy URL
      setUseFallback(true);
      setLoaded(false);
    } else {
      // Both URLs failed or no fallback available
      setError(true);
    }
  };

  // Handle click - in selectable mode, toggle selection; otherwise open lightbox
  const handleClick = (e: React.MouseEvent) => {
    if (selectable) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect?.(photo, e.shiftKey);
    } else {
      onClick?.(photo, index);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "relative overflow-hidden rounded-none border bg-muted",
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "group cursor-pointer",
        sizeClasses[size],
        // Selection styling
        isSelected
          ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
          : "border-border hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background"
      )}
      title={photo.name}
    >
      {/* Selection checkbox - always visible in selectable mode */}
      {selectable && (
        <div
          className={cn(
            "absolute top-2 left-2 z-10 rounded-sm",
            "transition-all duration-200",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-black/50 text-white group-hover:bg-black/70"
          )}
        >
          {isSelected ? (
            <Check className="h-5 w-5 p-0.5" />
          ) : (
            <Square className="h-5 w-5 p-0.5" />
          )}
        </div>
      )}

      {/* Loading placeholder */}
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size={24} className="text-muted-foreground" />
        </div>
      )}

      {/* Error state - thumbnail preview failed to load (NOT an upload failure) */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
          <ImageIcon className="h-8 w-8 mb-1" />
          <span className="text-xs">No preview</span>
        </div>
      )}

      {/* Image */}
      {/* crossOrigin="anonymous" is required for cross-origin image loading to work
          Without it, browsers make "no-cors" requests which return opaque responses
          that get blocked by ORB (Opaque Response Blocking) for security */}
      {!error && (
        <img
          src={thumbnailSrc}
          alt={photo.name}
          loading="lazy"
          crossOrigin="anonymous"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            "transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
            !selectable && "group-hover:scale-105 transition-transform duration-300"
          )}
        />
      )}

      {/* Download button - shown on hover (top-right) */}
      {/* Uses div+role instead of button to avoid invalid nested <button> in HTML */}
      {onDownload && !selectable && (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDownload(photo);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onDownload(photo);
            }
          }}
          className={cn(
            "absolute top-2 right-2 z-10",
            "p-1.5 rounded-sm",
            "bg-black/60 hover:bg-black/80 text-white cursor-pointer",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            "focus:outline-none focus:ring-2 focus:ring-white/50"
          )}
          title="Open document"
        >
          <ExternalLink className="h-4 w-4" />
        </div>
      )}

      {/* Hover overlay with filename */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent",
          "p-2 pt-6",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        )}
      >
        <p className="text-xs text-white truncate">{photo.name}</p>
      </div>
    </button>
  );
}

// Format date for group headers using company timezone (SSoT: Admin Settings)
function formatGroupDate(dateStr: string): string {
  const tz = getCompanyTimezone();
  const date = new Date(dateStr);

  // Get today's date in company timezone (YYYY-MM-DD)
  const todayStr = getTodayAsString();

  // Get photo date in company timezone (YYYY-MM-DD)
  const photoDateStr = date.toLocaleDateString("en-CA", { timeZone: tz });

  // Calculate day difference using calendar dates in company timezone
  const todayDate = new Date(todayStr + "T00:00:00");
  const photoDate = new Date(photoDateStr + "T00:00:00");
  const diffDays = Math.floor(
    (todayDate.getTime() - photoDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  // Get current year in company timezone for year display logic
  const nowYear = parseInt(todayStr.split("-")[0]);
  const photoYear = date.getFullYear();

  return date.toLocaleDateString("en-AU", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: photoYear !== nowYear ? "numeric" : undefined,
  });
}

// Group photos by date using company timezone (SSoT: Admin Settings)
function groupPhotosByDate(photos: PhotoItem[]): Map<string, PhotoItem[]> {
  const groups = new Map<string, PhotoItem[]>();
  const tz = getCompanyTimezone();

  photos.forEach((photo) => {
    const dateStr = photo.createdAt || photo.modifiedAt;
    // Convert to company timezone date (YYYY-MM-DD) for consistent grouping
    const dateKey = dateStr
      ? new Date(dateStr).toLocaleDateString("en-CA", { timeZone: tz })
      : "unknown";

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(photo);
  });

  // Sort by date descending (newest first)
  return new Map(
    [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  );
}

// View mode toggle buttons - also exported for use in parent toolbars
export function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: PhotoViewMode;
  onChange: (mode: PhotoViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
      <Button
        variant={viewMode === "grid" ? "default" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange("grid")}
        title="Grid view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant={viewMode === "filmstrip" ? "default" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange("filmstrip")}
        title="Filmstrip view"
      >
        <GalleryHorizontalEnd className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// Filmstrip thumbnail in the side strip
function FilmstripThumb({
  photo,
  isActive,
  onClick,
}: {
  photo: PhotoItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [useFallback, setUseFallback] = React.useState(false);

  const thumbnailSrc = useFallback
    ? photo.url
    : (photo.thumbnailUrl || photo.url);

  const handleError = () => {
    if (!useFallback && photo.thumbnailUrl && photo.url && photo.thumbnailUrl !== photo.url) {
      setUseFallback(true);
      setLoaded(false);
    } else {
      setError(true);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full aspect-square overflow-hidden shrink-0",
        "transition-all duration-200 cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-primary",
        isActive
          ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
          : "opacity-60 hover:opacity-90"
      )}
      title={photo.name}
    >
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Spinner size={16} className="text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
          <ImageIcon className="h-5 w-5" />
        </div>
      )}
      {!error && (
        <img
          src={thumbnailSrc}
          alt={photo.name}
          loading="lazy"
          crossOrigin="anonymous"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={cn(
            "h-full w-full object-cover",
            "transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </button>
  );
}

// Filmstrip view: vertical thumbnail strip on left, large main image on right
function FilmstripView({
  photos,
  onPhotoClick,
  onDownloadPhoto,
}: {
  photos: PhotoItem[];
  onPhotoClick?: (photo: PhotoItem, index: number) => void;
  onDownloadPhoto?: (photo: PhotoItem) => void;
}) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const activeThumbRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Main image state
  const [mainLoaded, setMainLoaded] = React.useState(false);
  const [mainError, setMainError] = React.useState(false);
  const [mainUseFallback, setMainUseFallback] = React.useState(false);

  const currentPhoto = photos[activeIndex];

  // Reset main image state when active photo changes
  React.useEffect(() => {
    setMainLoaded(false);
    setMainError(false);
    setMainUseFallback(false);
  }, [activeIndex]);

  // Scroll active thumbnail into view
  React.useEffect(() => {
    if (activeThumbRef.current && stripRef.current) {
      activeThumbRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) &&
          document.activeElement !== document.body) return;

      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setActiveIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
      } else if (e.key === "Enter" && onPhotoClick && currentPhoto) {
        e.preventDefault();
        onPhotoClick(currentPhoto, activeIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photos.length, activeIndex, currentPhoto, onPhotoClick]);

  const mainSrc = mainUseFallback
    ? currentPhoto?.url
    : (currentPhoto?.url || "");

  const handleMainError = () => {
    if (!mainUseFallback && currentPhoto?.thumbnailUrl && currentPhoto?.url && currentPhoto.thumbnailUrl !== currentPhoto.url) {
      setMainUseFallback(true);
      setMainLoaded(false);
    } else {
      setMainError(true);
    }
  };

  const goToPrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  if (!currentPhoto) return null;

  return (
    <div ref={containerRef} className="flex gap-3 h-full min-h-[400px]" tabIndex={0}>
      {/* Thumbnail strip */}
      <div
        ref={stripRef}
        className="w-[100px] shrink-0 overflow-y-auto flex flex-col gap-1.5 pr-1 scrollbar-thin"
      >
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            ref={index === activeIndex ? activeThumbRef : undefined}
          >
            <FilmstripThumb
              photo={photo}
              isActive={index === activeIndex}
              onClick={() => setActiveIndex(index)}
            />
          </div>
        ))}
      </div>

      {/* Main image area */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Photo info bar */}
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{currentPhoto.name}</p>
            <p className="text-xs text-muted-foreground">
              {activeIndex + 1} of {photos.length}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onDownloadPhoto && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDownloadPhoto(currentPhoto)}
                title="Open document"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            {onPhotoClick && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPhotoClick(currentPhoto, activeIndex)}
                title="Open fullscreen"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Main image container */}
        <div
          className="flex-1 min-h-0 flex items-center justify-center bg-muted/30 rounded-lg relative overflow-hidden cursor-pointer"
          onClick={() => onPhotoClick?.(currentPhoto, activeIndex)}
        >
          {/* Navigation arrows */}
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 z-10 h-9 w-9 bg-background/80 hover:bg-background rounded-full shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrev();
                }}
                title="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 z-10 h-9 w-9 bg-background/80 hover:bg-background rounded-full shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                title="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          {/* Loading */}
          {!mainLoaded && !mainError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size={32} className="text-muted-foreground" />
            </div>
          )}

          {/* Error state */}
          {mainError && (
            <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
              <ImageIcon className="h-16 w-16 mb-2" />
              <p className="text-sm">Failed to load image</p>
            </div>
          )}

          {/* Main image */}
          {!mainError && (
            <img
              key={currentPhoto.id}
              src={mainSrc}
              alt={currentPhoto.name}
              crossOrigin="anonymous"
              onLoad={() => setMainLoaded(true)}
              onError={handleMainError}
              className={cn(
                "max-h-full max-w-full object-contain",
                "transition-opacity duration-300",
                mainLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function PhotoGallery({
  photos,
  onPhotoClick,
  onDownloadPhoto,
  groupByDate = false,
  loading = false,
  className,
  emptyMessage = "No photos found",
  thumbnailSize = "md",
  selectable = false,
  selectedIds,
  onSelectionChange,
  onSelectionAction,
  viewMode = "grid",
  onViewModeChange,
  showViewToggle = false,
}: PhotoGalleryProps) {
  // Internal selection state if not controlled
  const [internalSelectedIds, setInternalSelectedIds] = React.useState<Set<string>>(new Set());
  // Track last clicked photo for shift-select range
  const lastClickedRef = React.useRef<string | null>(null);

  // Use external or internal selection state
  const effectiveSelectedIds = selectedIds ?? internalSelectedIds;
  const setEffectiveSelectedIds = (ids: Set<string>) => {
    if (onSelectionChange) {
      onSelectionChange(ids);
    } else {
      setInternalSelectedIds(ids);
    }
  };

  // Handle photo selection toggle
  const handleToggleSelect = (photo: PhotoItem, shiftKey: boolean) => {
    const newSelectedIds = new Set(effectiveSelectedIds);

    if (shiftKey && lastClickedRef.current) {
      // Shift-click: select range
      const lastIndex = photos.findIndex(p => p.id === lastClickedRef.current);
      const currentIndex = photos.findIndex(p => p.id === photo.id);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);

        for (let i = start; i <= end; i++) {
          newSelectedIds.add(photos[i].id);
        }
      }
    } else {
      // Normal click: toggle single photo
      if (newSelectedIds.has(photo.id)) {
        newSelectedIds.delete(photo.id);
      } else {
        newSelectedIds.add(photo.id);
      }
    }

    lastClickedRef.current = photo.id;
    setEffectiveSelectedIds(newSelectedIds);
  };

  // Select all photos
  const handleSelectAll = () => {
    const allIds = new Set(photos.map(p => p.id));
    setEffectiveSelectedIds(allIds);
  };

  // Clear selection
  const handleClearSelection = () => {
    setEffectiveSelectedIds(new Set());
    lastClickedRef.current = null;
  };

  // Get selected photos for action callback
  const getSelectedPhotos = (): PhotoItem[] => {
    return photos.filter(p => effectiveSelectedIds.has(p.id));
  };

  // View toggle helper
  const renderViewToggle = () => {
    if (!showViewToggle || !onViewModeChange) return null;
    return (
      <div className="flex justify-end mb-3">
        <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        {renderViewToggle()}
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <PhotoSkeleton key={i} size={thumbnailSize} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (photos.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12 text-center",
          className
        )}
      >
        {renderViewToggle()}
        <ImageIcon className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // Filmstrip view (no selection support - filmstrip is a browsing mode)
  if (viewMode === "filmstrip") {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        {renderViewToggle()}
        <div className="flex-1 min-h-0">
          <FilmstripView
            photos={photos}
            onPhotoClick={onPhotoClick}
            onDownloadPhoto={onDownloadPhoto}
          />
        </div>
      </div>
    );
  }

  // Get index for a photo considering grouping
  const getGlobalIndex = (photo: PhotoItem): number => {
    return photos.findIndex((p) => p.id === photo.id);
  };

  // Selection toolbar - shown when selectable
  const SelectionToolbar = () => {
    if (!selectable) return null;

    const selectedCount = effectiveSelectedIds.size;
    const allSelected = selectedCount === photos.length;

    return (
      <div className="flex items-center justify-between mb-4 pb-3 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? handleClearSelection : handleSelectAll}
            className="gap-2"
          >
            {allSelected ? (
              <>
                <Square className="h-4 w-4" />
                Clear All
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4" />
                Select All
              </>
            )}
          </Button>
          {selectedCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedCount} selected
            </span>
          )}
        </div>
        {selectedCount > 0 && onSelectionAction && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectionAction("download", getSelectedPhotos())}
            >
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectionAction("email", getSelectedPhotos())}
            >
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onSelectionAction("delete", getSelectedPhotos())}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Grouped view
  if (groupByDate) {
    const groupedPhotos = groupPhotosByDate(photos);

    return (
      <div className={cn("space-y-6", className)}>
        {renderViewToggle()}
        <SelectionToolbar />
        {[...groupedPhotos.entries()].map(([dateKey, groupPhotos]) => (
          <div key={dateKey}>
            {/* Date header */}
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              {dateKey !== "unknown"
                ? formatGroupDate(dateKey)
                : "Unknown date"}
              <span className="ml-2 text-xs">({groupPhotos.length})</span>
            </h3>

            {/* Photo grid */}
            <div className="flex flex-wrap gap-2">
              {groupPhotos.map((photo) => (
                <PhotoThumbnail
                  key={photo.id}
                  photo={photo}
                  index={getGlobalIndex(photo)}
                  onClick={onPhotoClick}
                  onDownload={onDownloadPhoto}
                  size={thumbnailSize}
                  selectable={selectable}
                  isSelected={effectiveSelectedIds.has(photo.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Flat grid view
  return (
    <div className={cn("space-y-4", className)}>
      {renderViewToggle()}
      <SelectionToolbar />
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <PhotoThumbnail
            key={photo.id}
            photo={photo}
            index={index}
            onClick={onPhotoClick}
            onDownload={onDownloadPhoto}
            size={thumbnailSize}
            selectable={selectable}
            isSelected={effectiveSelectedIds.has(photo.id)}
            onToggleSelect={handleToggleSelect}
          />
        ))}
      </div>
    </div>
  );
}

export default PhotoGallery;
