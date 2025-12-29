"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/ui/back-button";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { type PhotoItem } from "@/components/ui/photo-gallery";
import MultipleSelector, { type Option } from "@/components/ui/multiple-selector";
import { Badge } from "@/components/ui/badge";
import { Camera, RefreshCw, User } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const STORAGE_KEY_TYPES = "job-photos-selected-job-types";
const STORAGE_KEY_STATUSES = "job-photos-selected-statuses";

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
    total_jobs: number;
    supervisors: SupervisorGroup;
  };
}

interface JobType {
  id: number;
  name: string;
}

interface JobTypesResponse {
  success: boolean;
  data: JobType[];
}

interface JobStatus {
  id: number;
  name: string;
}

interface StatusesResponse {
  success: boolean;
  data: JobStatus[];
}

export default function JobPhotosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allJobTypes, setAllJobTypes] = useState<JobType[]>([]);
  const [selectedJobTypeIds, setSelectedJobTypeIds] = useState<number[]>([]);
  const [typesInitialized, setTypesInitialized] = useState(false);
  const [allStatuses, setAllStatuses] = useState<JobStatus[]>([]);
  const [selectedStatusIds, setSelectedStatusIds] = useState<number[]>([]);
  const [statusesInitialized, setStatusesInitialized] = useState(false);
  const [data, setData] = useState<SupervisorGroup>({});
  const [totalJobs, setTotalJobs] = useState(0);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<PhotoItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Calculate photos per job based on total job count
  const photosPerJob = Math.max(1, Math.min(5, Math.floor(20 / Math.max(totalJobs, 1))));

  // Load saved selections from localStorage
  const loadSaved = (key: string): number[] | null => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  // Save selections to localStorage
  const saveSelection = (key: string, ids: number[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      // Ignore storage errors
    }
  };

  // Load available job types and statuses
  useEffect(() => {
    const loadFilters = async () => {
      try {
        // Load job types
        const typesResponse = await api.get<JobTypesResponse>("/api/v1/jobs_photos/job_types");
        if (typesResponse?.success) {
          setAllJobTypes(typesResponse.data);
          const savedTypes = loadSaved(STORAGE_KEY_TYPES);
          if (savedTypes && savedTypes.length > 0) {
            const validIds = typesResponse.data.map(t => t.id);
            const validSaved = savedTypes.filter(id => validIds.includes(id));
            setSelectedJobTypeIds(validSaved.length > 0 ? validSaved : validIds);
          } else {
            setSelectedJobTypeIds(typesResponse.data.map(t => t.id));
          }
          setTypesInitialized(true);
        }

        // Load statuses
        const statusesResponse = await api.get<StatusesResponse>("/api/v1/jobs_photos/statuses");
        if (statusesResponse?.success) {
          setAllStatuses(statusesResponse.data);
          const savedStatuses = loadSaved(STORAGE_KEY_STATUSES);
          if (savedStatuses && savedStatuses.length > 0) {
            const validIds = statusesResponse.data.map(s => s.id);
            const validSaved = savedStatuses.filter(id => validIds.includes(id));
            setSelectedStatusIds(validSaved.length > 0 ? validSaved : validIds);
          } else {
            setSelectedStatusIds(statusesResponse.data.map(s => s.id));
          }
          setStatusesInitialized(true);
        }
      } catch (err) {
        console.error("Failed to load filters:", err);
      }
    };
    loadFilters();
  }, []);

  // Convert job types to MultipleSelector options
  const jobTypeOptions: Option[] = allJobTypes.map(t => ({
    value: String(t.id),
    label: t.name,
  }));

  // Get selected options for MultipleSelector
  const selectedOptions: Option[] = selectedJobTypeIds
    .map(id => jobTypeOptions.find(o => o.value === String(id)))
    .filter((o): o is Option => o !== undefined);

  // Handle job type selection change from MultipleSelector
  const handleJobTypeChange = (options: Option[]) => {
    const newIds = options.map(o => Number(o.value));
    setSelectedJobTypeIds(newIds);
    saveSelection(STORAGE_KEY_TYPES, newIds);
  };

  // Toggle status selection
  const toggleStatus = (statusId: number) => {
    setSelectedStatusIds(prev => {
      const newSelection = prev.includes(statusId)
        ? prev.filter(id => id !== statusId)
        : [...prev, statusId];
      saveSelection(STORAGE_KEY_STATUSES, newSelection);
      return newSelection;
    });
  };

  // Load photos data
  const loadPhotos = useCallback(async () => {
    if (!typesInitialized || !statusesInitialized || selectedJobTypeIds.length === 0 || selectedStatusIds.length === 0) {
      setData({});
      setTotalJobs(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const typeParams = selectedJobTypeIds.map(id => `job_type_ids[]=${id}`).join("&");
      const statusParams = selectedStatusIds.map(id => `status_ids[]=${id}`).join("&");
      const url = `/api/v1/jobs_photos?${typeParams}&${statusParams}&limit=${photosPerJob}`;
      const response = await api.get<JobsPhotosResponse>(url);
      if (response?.success) {
        setData(response.data.supervisors);
        setTotalJobs(response.data.total_jobs);
      } else {
        setError("Failed to load photos");
      }
    } catch (err) {
      console.error("Failed to load job photos:", err);
      setError("Failed to load photos. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [typesInitialized, statusesInitialized, selectedJobTypeIds, selectedStatusIds, photosPerJob]);

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
      <div className="border-b dark:border-gray-800">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <BackButton fallbackHref="/jobs" />
            <Camera className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Job Photos</h1>
          </div>
          <Button variant="outline" size="sm" onClick={loadPhotos} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        {/* Job Type Multi-Select Dropdown */}
        {allJobTypes.length > 0 && (
          <div className="px-4 pb-3">
            <MultipleSelector
              value={selectedOptions}
              options={jobTypeOptions}
              onChange={handleSelectionChange}
              placeholder="Select house types..."
              hidePlaceholderWhenSelected
              className="max-w-md"
            />
          </div>
        )}
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
        ) : selectedJobTypeIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Camera className="h-12 w-12 mb-4 opacity-50" />
            <p>Select at least one job type to view photos</p>
          </div>
        ) : supervisorNames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Camera className="h-12 w-12 mb-4 opacity-50" />
            <p>No photos found for selected job types</p>
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
