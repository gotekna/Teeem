"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Camera, Trash2, Pencil, X } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import type { InspectionPhoto } from "@/lib/inspection-atoms";

interface InspectionPhotoCaptureProps {
  inspectionItemId: number;
  photos: InspectionPhoto[];
  onPhotosChanged: () => void;
  onAnnotate?: (photo: InspectionPhoto) => void;
}

export function InspectionPhotoCapture({
  inspectionItemId,
  photos,
  onPhotosChanged,
  onAnnotate,
}: InspectionPhotoCaptureProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleCapture = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);

        // Try to extract GPS from EXIF (if available via browser)
        try {
          if (navigator.geolocation) {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
            });
            formData.append("latitude", String(position.coords.latitude));
            formData.append("longitude", String(position.coords.longitude));
          }
        } catch {
          // GPS not available, continue without it
        }

        await api.postFormData(
          `/api/v1/inspection_items/${inspectionItemId}/inspection_photos`,
          formData
        );
      }

      toast({ title: `${files.length} photo${files.length > 1 ? "s" : ""} uploaded` });
      onPhotosChanged();
    } catch {
      toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
    } finally {
      setUploading(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [inspectionItemId, onPhotosChanged, toast]);

  const handleDelete = useCallback(async (photoId: number) => {
    try {
      await api.delete(`/api/v1/inspection_items/${inspectionItemId}/inspection_photos/${photoId}`);
      onPhotosChanged();
    } catch {
      toast({ title: "Error", description: "Failed to delete photo", variant: "destructive" });
    }
  }, [inspectionItemId, onPhotosChanged, toast]);

  return (
    <div className="space-y-2">
      {/* Hidden file input - accepts camera on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map(photo => {
            const blob = photo.annotated_blob || photo.storage_blob;
            return (
              <div key={photo.id} className="relative group">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-muted border">
                  <img
                    src={`/api/v1/storage_blobs/${blob.id}/download`}
                    alt={photo.caption || "Inspection photo"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-1">
                  {onAnnotate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-white hover:text-white"
                      onClick={() => onAnnotate(photo)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-white hover:text-red-400"
                    onClick={() => handleDelete(photo.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Capture button */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleCapture}
        disabled={uploading}
        className="h-7 text-xs"
      >
        {uploading ? (
          <Spinner className="h-3 w-3 mr-1" />
        ) : (
          <Camera className="h-3 w-3 mr-1" />
        )}
        {photos.length > 0 ? `${photos.length}` : "Photo"}
      </Button>
    </div>
  );
}
