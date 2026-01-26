"use client";

/**
 * Photo Capture Component
 *
 * Camera interface for capturing photos on-site.
 * Works offline - photos sync when back online.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Camera,
  CameraOff,
  ImagePlus,
  Check,
  X,
  Trash2,
  RefreshCw,
  Cloud,
  CloudOff,
  MapPin,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePhotoCapture } from "@/lib/offline/use-photo-capture";
import { createPhotoBlobUrl, revokePhotoBlobUrl, type PendingPhoto } from "@/lib/offline/photo-cache";

// =============================================================================
// Types
// =============================================================================

interface PhotoCaptureProps {
  jobId: number;
  taskId?: number;
  taskName?: string;
  /** Callback when photo is captured */
  onPhotoCaptured?: (photo: PendingPhoto) => void;
  /** Show gallery of captured photos */
  showGallery?: boolean;
  /** Compact mode for embedding */
  compact?: boolean;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function PhotoCapture({
  jobId,
  taskId,
  taskName,
  onPhotoCaptured,
  showGallery = true,
  compact = false,
  className,
}: PhotoCaptureProps) {
  const {
    isCameraActive,
    startCamera,
    stopCamera,
    capturePhoto,
    selectPhoto,
    videoRef,
    canvasRef,
    photos,
    loading,
    error,
    permissionStatus,
    isOnline,
    syncProgress,
    syncPhotos,
    cacheStats,
    refreshPhotos,
    deletePhoto,
    location,
  } = usePhotoCapture({
    jobId,
    taskId,
    taskName,
    requestLocation: true,
    autoSync: true,
  });

  const [caption, setCaption] = React.useState("");
  const [showCaptionInput, setShowCaptionInput] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle photo capture
  const handleCapture = async () => {
    const photo = await capturePhoto(caption || undefined);
    if (photo) {
      onPhotoCaptured?.(photo);
      setCaption("");
      setShowCaptionInput(false);
    }
  };

  // Handle file select
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const photo = await selectPhoto(file, caption || undefined);
      if (photo) {
        onPhotoCaptured?.(photo);
        setCaption("");
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Filter photos for this task (if taskId provided)
  const displayPhotos = taskId
    ? photos.filter((p) => p.taskId === taskId)
    : photos;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Camera View */}
      <Card className={cn(
        "overflow-hidden",
        compact && "border-0 shadow-none"
      )}>
        <CardContent className={cn("p-0", !compact && "p-4")}>
          {/* Camera Preview */}
          {isCameraActive ? (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video bg-black rounded-lg object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Camera Controls Overlay */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                {/* Capture Button */}
                <Button
                  size="lg"
                  className="rounded-full w-16 h-16 bg-white hover:bg-gray-100 text-black shadow-lg"
                  onClick={handleCapture}
                >
                  <Camera className="h-8 w-8" />
                </Button>
              </div>

              {/* Close Button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
                onClick={stopCamera}
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Location Indicator */}
              {location && (
                <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  GPS
                </div>
              )}
            </div>
          ) : (
            /* Camera Inactive - Show Buttons */
            <div className={cn(
              "flex flex-col items-center justify-center gap-4 py-8",
              compact && "py-4"
            )}>
              {permissionStatus === "denied" ? (
                <div className="text-center text-muted-foreground">
                  <CameraOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Camera access denied</p>
                  <p className="text-xs">Check your browser settings</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-3">
                    <Button onClick={startCamera} variant="default">
                      <Camera className="h-4 w-4 mr-2" />
                      Open Camera
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="h-4 w-4 mr-2" />
                      Choose Photo
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </>
              )}

              {/* Error Message */}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          )}

          {/* Caption Input */}
          {(isCameraActive || showCaptionInput) && (
            <div className="p-3 border-t">
              <Input
                placeholder="Add a caption (optional)..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Status */}
      {(cacheStats.pendingCount > 0 || syncProgress) && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Cloud className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <CloudOff className="h-4 w-4 text-slate-500" />
                )}
                <span className="text-sm">
                  {syncProgress ? (
                    `Syncing ${syncProgress.completed}/${syncProgress.total}...`
                  ) : (
                    `${cacheStats.pendingCount} photo${cacheStats.pendingCount === 1 ? "" : "s"} pending sync`
                  )}
                </span>
              </div>
              {isOnline && !syncProgress && (
                <Button variant="ghost" size="sm" onClick={syncPhotos}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Sync Now
                </Button>
              )}
            </div>
            {syncProgress && syncProgress.total > 0 && (
              <Progress
                value={(syncProgress.completed / syncProgress.total) * 100}
                className="h-1 mt-2"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Photo Gallery */}
      {showGallery && displayPhotos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">
              Recent Photos ({displayPhotos.length})
            </h4>
            <Button variant="ghost" size="sm" onClick={refreshPhotos}>
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {displayPhotos.slice(0, 9).map((photo) => (
              <PhotoThumbnail
                key={photo.id}
                photo={photo}
                onDelete={deletePhoto}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Photo Thumbnail
// =============================================================================

interface PhotoThumbnailProps {
  photo: PendingPhoto;
  onDelete: (id: string) => void;
}

function PhotoThumbnail({ photo, onDelete }: PhotoThumbnailProps) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const url = createPhotoBlobUrl(photo);
    setImageUrl(url);

    return () => {
      revokePhotoBlobUrl(url);
    };
  }, [photo]);

  const statusBadge = () => {
    switch (photo.syncStatus) {
      case "synced":
        return (
          <Badge className="absolute top-1 right-1 bg-green-500 text-white text-[10px] px-1 py-0">
            <Check className="h-2.5 w-2.5" />
          </Badge>
        );
      case "syncing":
        return (
          <Badge className="absolute top-1 right-1 bg-blue-500 text-white text-[10px] px-1 py-0">
            <RefreshCw className="h-2.5 w-2.5 animate-spin" />
          </Badge>
        );
      case "error":
        return (
          <Badge className="absolute top-1 right-1 bg-red-500 text-white text-[10px] px-1 py-0">
            <X className="h-2.5 w-2.5" />
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge className="absolute top-1 right-1 bg-amber-500 text-white text-[10px] px-1 py-0">
            <Clock className="h-2.5 w-2.5" />
          </Badge>
        );
    }
  };

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={photo.caption || "Photo"}
          className="w-full h-full object-cover"
        />
      )}
      {statusBadge()}

      {/* Delete button on hover */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size="icon"
            className="absolute bottom-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo?</AlertDialogTitle>
            <AlertDialogDescription>
              {photo.syncStatus === "synced"
                ? "This photo has been synced. It will be removed from your device but remain on the server."
                : "This photo hasn't been synced yet. It will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(photo.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Caption overlay */}
      {photo.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
          {photo.caption}
        </div>
      )}
    </div>
  );
}

export default PhotoCapture;
