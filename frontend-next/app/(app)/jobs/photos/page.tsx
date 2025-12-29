"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/ui/back-button";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { type PhotoItem } from "@/components/ui/photo-gallery";
import { Camera, RefreshCw, User } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Photo {
  id: number;
  name: string;
  thumbnail_url: string;
  modified_at: string | null;
  days_old: number | null;
}

interface JobPhotos {
  job_id: number;
  job_name: string;
  job_number: string | null;
  photos: Photo[];
}

interface SupervisorGroup {
  [supervisor: string]: JobPhotos[];
}

interface JobsPhotosResponse {
  success: boolean;
  data: {
    status: string;
    total_jobs: number;
    supervisors: SupervisorGroup;
  };
}

interface StatusesResponse {
  success: boolean;
  data: string[];
}

export default function JobPhotosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Active");
  const [statuses, setStatuses] = useState<ComboboxItem[]>([]);
  const [data, setData] = useState<SupervisorGroup>({});
  const [totalJobs, setTotalJobs] = useState(0);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<PhotoItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Calculate photos per job based on total job count
  const photosPerJob = Math.max(1, Math.min(5, Math.floor(20 / Math.max(totalJobs, 1))));

  // Current selected status item
  const selectedStatus = statuses.find(s => s.id === status);

  // Load available statuses
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const response = await api.get<StatusesResponse>("/api/v1/jobs_photos/statuses");
        if (response.data.success) {
          setStatuses(response.data.data.map(s => ({ id: s, label: s })));
        }
      } catch (err) {
        console.error("Failed to load statuses:", err);
      }
    };
    loadStatuses();
  }, []);

  // Load photos data
  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<JobsPhotosResponse>(
        `/api/v1/jobs_photos?status=${encodeURIComponent(status)}&limit=${photosPerJob}`
      );
      if (response.data.success) {
        setData(response.data.data.supervisors);
        setTotalJobs(response.data.data.total_jobs);
      } else {
        setError("Failed to load photos");
      }
    } catch (err) {
      console.error("Failed to load job photos:", err);
      setError("Failed to load photos. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [status, photosPerJob]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Handle photo click - navigate to job's photos tab
  const handlePhotoClick = (jobId: number) => {
    router.push(`/jobs/${jobId}?tab=photos`);
  };

  // Handle photo expand in lightbox
  const handlePhotoExpand = (photos: Photo[], index: number) => {
    setLightboxPhotos(photos.map(p => ({
      id: String(p.id),
      name: p.name,
      url: p.thumbnail_url,
      thumbnailUrl: p.thumbnail_url,
      modifiedAt: p.modified_at || undefined,
    })));
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  };

  const supervisorNames = Object.keys(data);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-800">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/jobs" />
          <Camera className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Job Photos</h1>
        </div>
        <div className="flex items-center gap-2">
          <ComboboxDropdown
            items={statuses}
            selectedItem={selectedStatus}
            onSelect={(item) => setStatus(item.id)}
            placeholder="Select status..."
            className="w-40"
          />
          <Button variant="outline" size="sm" onClick={loadPhotos} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner className="h-8 w-8" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadPhotos} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : supervisorNames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Camera className="h-12 w-12 mb-4 opacity-50" />
            <p>No photos found for {status} jobs</p>
          </div>
        ) : (
          <div className="space-y-6">
            {supervisorNames.map((supervisor) => (
              <Card key={supervisor} className="dark:bg-gray-900/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {supervisor}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({data[supervisor].length} job{data[supervisor].length !== 1 ? "s" : ""})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data[supervisor].map((job) => (
                      <div key={job.job_id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handlePhotoClick(job.job_id)}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                          >
                            {job.job_number ? `${job.job_number} - ` : ""}{job.job_name}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {job.photos.length} photo{job.photos.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {job.photos.map((photo, idx) => {
                            const isOld = photo.days_old !== null && photo.days_old > 3;
                            return (
                              <div
                                key={photo.id}
                                className="relative group cursor-pointer"
                                onClick={() => handlePhotoClick(job.job_id)}
                                onDoubleClick={() => handlePhotoExpand(job.photos, idx)}
                              >
                                <div
                                  className={cn(
                                    "w-24 h-24 rounded-lg overflow-hidden border-2 transition-all",
                                    isOld
                                      ? "border-red-500 dark:border-red-600"
                                      : "border-transparent hover:border-blue-500"
                                  )}
                                >
                                  <img
                                    src={photo.thumbnail_url}
                                    alt={photo.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className={cn(
                                  "absolute bottom-0 left-0 right-0 px-1 py-0.5 text-xs text-center",
                                  isOld
                                    ? "bg-red-500/90 text-white"
                                    : "bg-black/60 text-white"
                                )}>
                                  {formatDate(photo.modified_at)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <ImageLightbox
        photos={lightboxPhotos}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        initialIndex={lightboxIndex}
      />
    </div>
  );
}
