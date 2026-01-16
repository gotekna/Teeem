/**
 * Photo Capture Hook
 *
 * Provides camera access and photo capture functionality.
 * Photos are stored locally and synced when back online.
 *
 * Features:
 * - Camera stream management
 * - Photo capture with compression
 * - GPS location tagging
 * - Offline-first storage
 * - Auto-sync when online
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { isOnlineAtom } from "./offline-atoms";
import {
  storePhoto,
  getJobPhotos,
  getPhotoCacheStats,
  deletePhoto as deletePhotoFromCache,
  type PendingPhoto,
  type PhotoCacheStats,
} from "./photo-cache";
import {
  syncAllPendingPhotos,
  retryFailedPhotos,
  cleanupSyncedPhotos,
  type PhotoSyncProgress,
} from "./photo-sync";

// =============================================================================
// Types
// =============================================================================

export interface UsePhotoCaptureOptions {
  /** Job ID for associating photos */
  jobId: number;
  /** Task ID if capturing for a specific task */
  taskId?: number;
  /** Task name for display */
  taskName?: string;
  /** Whether to request GPS location */
  requestLocation?: boolean;
  /** Auto-sync photos when online */
  autoSync?: boolean;
}

export interface UsePhotoCaptureResult {
  /** Whether camera is currently active */
  isCameraActive: boolean;
  /** Start the camera stream */
  startCamera: () => Promise<void>;
  /** Stop the camera stream */
  stopCamera: () => void;
  /** Capture a photo from the camera */
  capturePhoto: (caption?: string) => Promise<PendingPhoto | null>;
  /** Take photo from file input (for selecting from gallery) */
  selectPhoto: (file: File, caption?: string) => Promise<PendingPhoto | null>;
  /** Video ref for camera preview */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Canvas ref for capturing */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Photos for this job */
  photos: PendingPhoto[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Camera permission status */
  permissionStatus: "prompt" | "granted" | "denied" | null;
  /** Whether we're online */
  isOnline: boolean;
  /** Sync progress */
  syncProgress: PhotoSyncProgress | null;
  /** Manually trigger sync */
  syncPhotos: () => Promise<void>;
  /** Cache statistics */
  cacheStats: PhotoCacheStats;
  /** Refresh photos list */
  refreshPhotos: () => Promise<void>;
  /** Delete a photo */
  deletePhoto: (photoId: string) => Promise<void>;
  /** Current GPS location */
  location: GeolocationCoordinates | null;
}

// =============================================================================
// Hook
// =============================================================================

export function usePhotoCapture(options: UsePhotoCaptureOptions): UsePhotoCaptureResult {
  const { jobId, taskId, taskName, requestLocation = true, autoSync = true } = options;
  const isOnline = useAtomValue(isOnlineAtom);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<"prompt" | "granted" | "denied" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Photos state
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state
  const [syncProgress, setSyncProgress] = useState<PhotoSyncProgress | null>(null);
  const [cacheStats, setCacheStats] = useState<PhotoCacheStats>({
    totalCount: 0,
    pendingCount: 0,
    syncingCount: 0,
    syncedCount: 0,
    errorCount: 0,
    totalSizeBytes: 0,
    totalSizeDisplay: "0 KB",
  });

  // Location state
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);

  // ==========================================================================
  // Location
  // ==========================================================================

  useEffect(() => {
    if (!requestLocation) return;

    // Check if geolocation is available
    if (!("geolocation" in navigator)) {
      console.log("[PhotoCapture] Geolocation not available");
      return;
    }

    // Get current position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position.coords);
      },
      (err) => {
        console.warn("[PhotoCapture] Geolocation error:", err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache for 1 minute
      }
    );
  }, [requestLocation]);

  // ==========================================================================
  // Load Photos
  // ==========================================================================

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const jobPhotos = await getJobPhotos(jobId);
      // Sort by takenAt descending (newest first)
      jobPhotos.sort((a, b) => b.takenAt - a.takenAt);
      setPhotos(jobPhotos);

      const stats = await getPhotoCacheStats();
      setCacheStats(stats);
    } catch (err) {
      console.error("[PhotoCapture] Failed to load photos:", err);
      setError(err instanceof Error ? err.message : "Failed to load photos");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // ==========================================================================
  // Camera
  // ==========================================================================

  const startCamera = useCallback(async () => {
    setError(null);

    try {
      // Check permission
      if ("permissions" in navigator) {
        const permission = await navigator.permissions.query({ name: "camera" as PermissionName });
        setPermissionStatus(permission.state as "prompt" | "granted" | "denied");
      }

      // Request camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Prefer back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      setPermissionStatus("granted");
    } catch (err) {
      console.error("[PhotoCapture] Camera error:", err);

      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setPermissionStatus("denied");
          setError("Camera access denied. Please allow camera access in your browser settings.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError(err.message);
        }
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ==========================================================================
  // Photo Capture
  // ==========================================================================

  const capturePhoto = useCallback(
    async (caption?: string): Promise<PendingPhoto | null> => {
      if (!videoRef.current || !canvasRef.current) {
        setError("Camera not ready");
        return null;
      }

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setError("Could not get canvas context");
          return null;
        }

        ctx.drawImage(video, 0, 0);

        // Convert to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (b) resolve(b);
              else reject(new Error("Failed to create blob"));
            },
            "image/jpeg",
            0.9
          );
        });

        // Store the photo
        const photo = await storePhoto(jobId, blob, {
          taskId,
          taskName,
          caption,
          location: location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy || undefined,
              }
            : undefined,
        });

        // Refresh photos list
        await loadPhotos();

        console.log(`[PhotoCapture] Captured photo: ${photo.fileName}`);
        return photo;
      } catch (err) {
        console.error("[PhotoCapture] Capture failed:", err);
        setError(err instanceof Error ? err.message : "Failed to capture photo");
        return null;
      }
    },
    [jobId, taskId, taskName, location, loadPhotos]
  );

  const selectPhoto = useCallback(
    async (file: File, caption?: string): Promise<PendingPhoto | null> => {
      try {
        const photo = await storePhoto(jobId, file, {
          taskId,
          taskName,
          caption,
          location: location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy || undefined,
              }
            : undefined,
        });

        await loadPhotos();
        console.log(`[PhotoCapture] Selected photo: ${photo.fileName}`);
        return photo;
      } catch (err) {
        console.error("[PhotoCapture] Select failed:", err);
        setError(err instanceof Error ? err.message : "Failed to select photo");
        return null;
      }
    },
    [jobId, taskId, taskName, location, loadPhotos]
  );

  // ==========================================================================
  // Sync
  // ==========================================================================

  const syncPhotos = useCallback(async () => {
    if (!isOnline) {
      console.log("[PhotoCapture] Cannot sync while offline");
      return;
    }

    try {
      // Sync pending photos
      await syncAllPendingPhotos((progress) => {
        setSyncProgress(progress);
      });

      // Retry failed photos
      await retryFailedPhotos((progress) => {
        setSyncProgress(progress);
      });

      // Cleanup synced photos after a delay
      setTimeout(async () => {
        const cleaned = await cleanupSyncedPhotos();
        if (cleaned > 0) {
          console.log(`[PhotoCapture] Cleaned up ${cleaned} synced photos`);
        }
        await loadPhotos();
      }, 5000);

      await loadPhotos();
    } catch (err) {
      console.error("[PhotoCapture] Sync failed:", err);
    } finally {
      // Clear progress after delay
      setTimeout(() => {
        setSyncProgress(null);
      }, 3000);
    }
  }, [isOnline, loadPhotos]);

  // Auto-sync when coming online
  useEffect(() => {
    if (autoSync && isOnline && cacheStats.pendingCount > 0) {
      console.log(`[PhotoCapture] Auto-syncing ${cacheStats.pendingCount} pending photos`);
      syncPhotos();
    }
  }, [autoSync, isOnline, cacheStats.pendingCount, syncPhotos]);

  // ==========================================================================
  // Delete
  // ==========================================================================

  const deletePhoto = useCallback(
    async (photoId: string) => {
      try {
        await deletePhotoFromCache(photoId);
        await loadPhotos();
      } catch (err) {
        console.error("[PhotoCapture] Delete failed:", err);
        setError(err instanceof Error ? err.message : "Failed to delete photo");
      }
    },
    [loadPhotos]
  );

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
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
    refreshPhotos: loadPhotos,
    deletePhoto,
    location,
  };
}
