"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/ui/back-button";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { type PhotoItem } from "@/components/ui/photo-gallery";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, RefreshCw, User, ChevronDown, ChevronRight } from "lucide-react";
import { api, getApiBaseUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

const STORAGE_KEY_TYPES = "job-photos-selected-job-types";
const STORAGE_KEY_STATUSES = "job-photos-selected-statuses";
const STORAGE_KEY_SUPERVISORS = "job-photos-selected-supervisors";

// PhotoThumbnail with fallback - tries thumbnail_url first, falls back to proxy_url
// SSoT: Same pattern as PhotoGallery component
function PhotoThumbnailWithFallback({
  photo,
  onClick,
  isOld,
}: {
  photo: { thumbnail_url: string; proxy_url: string; name: string; modified_at: string | null };
  onClick: () => void;
  isOld: boolean;
}) {
  const [useFallback, setUseFallback] = React.useState(false);
  const [error, setError] = React.useState(false);

  // Build full proxy URL with API base
  const apiBase = getApiBaseUrl();
  const fullProxyUrl = `${apiBase}${photo.proxy_url}`;

  // Try thumbnail_url first, fall back to proxy_url if it fails
  const imageSrc = useFallback ? fullProxyUrl : photo.thumbnail_url;

  const handleError = () => {
    if (!useFallback) {
      // Thumbnail failed (likely expired), try proxy URL
      setUseFallback(true);
    } else {
      // Both URLs failed
      setError(true);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  };

  return (
    <div
      className="relative cursor-pointer flex-shrink-0 w-32 h-32"
      onClick={onClick}
    >
      <div
        className={cn(
          "w-full h-full rounded overflow-hidden border-2",
          isOld
            ? "border-red-500 dark:border-red-600"
            : "border-transparent hover:border-blue-500"
        )}
      >
        {error ? (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">
            Failed
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={photo.name}
            className="w-full h-full object-cover"
            onError={handleError}
          />
        )}
      </div>
      <div className={cn(
        "absolute bottom-0 left-0 right-0 px-1 py-0.5 text-xs text-center",
        isOld ? "bg-red-500/90 text-white" : "bg-black/60 text-white"
      )}>
        {formatDate(photo.modified_at)}
      </div>
    </div>
  );
}

interface Photo {
  id: number;
  name: string;
  thumbnail_url: string;
  proxy_url: string;           // Backend proxy URL (always works, bypasses expired tokens)
  full_url: string | null;
  modified_at: string | null;
  days_old: number | null;
}

interface JobPhotos {
  job_id: number;
  job_name: string;
  job_number: string | null;
  job_type: string | null;
  job_status: string | null;
  deposit: number | null;
  start_date: string | null;
  pc_date: string | null;
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

interface SupervisorsResponse {
  success: boolean;
  data: string[];
}

export default function JobPhotosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allJobTypes, setAllJobTypes] = useState<JobType[]>([]);
  const [selectedJobTypeIds, setSelectedJobTypeIds] = useState<number[]>([]);
  const [allStatuses, setAllStatuses] = useState<JobStatus[]>([]);
  const [selectedStatusIds, setSelectedStatusIds] = useState<number[]>([]);
  const [allSupervisors, setAllSupervisors] = useState<string[]>([]);
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([]);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [data, setData] = useState<SupervisorGroup>({});
  const [totalJobs, setTotalJobs] = useState(0);
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<PhotoItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Calculate photos per job - more jobs = fewer photos per job
  const photosPerJob = totalJobs <= 3 ? 10 : totalJobs <= 6 ? 7 : totalJobs <= 10 ? 5 : 3;

  // Load/save from localStorage
  const loadSaved = <T,>(key: string): T | null => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const saveSelection = (key: string, value: unknown) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore
    }
  };

  // Load all filters
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [typesRes, statusesRes, supervisorsRes] = await Promise.all([
          api.get<JobTypesResponse>("/api/v1/jobs_photos/job_types"),
          api.get<StatusesResponse>("/api/v1/jobs_photos/statuses"),
          api.get<SupervisorsResponse>("/api/v1/jobs_photos/supervisors"),
        ]);

        // Job Types
        if (typesRes?.success) {
          setAllJobTypes(typesRes.data);
          const saved = loadSaved<number[]>(STORAGE_KEY_TYPES);
          const validIds = typesRes.data.map(t => t.id);
          if (saved?.length) {
            setSelectedJobTypeIds(saved.filter(id => validIds.includes(id)));
          } else {
            setSelectedJobTypeIds(validIds);
          }
        }

        // Statuses
        if (statusesRes?.success) {
          setAllStatuses(statusesRes.data);
          const saved = loadSaved<number[]>(STORAGE_KEY_STATUSES);
          const validIds = statusesRes.data.map(s => s.id);
          if (saved?.length) {
            setSelectedStatusIds(saved.filter(id => validIds.includes(id)));
          } else {
            setSelectedStatusIds(validIds);
          }
        }

        // Supervisors
        if (supervisorsRes?.success) {
          setAllSupervisors(supervisorsRes.data);
          const saved = loadSaved<string[]>(STORAGE_KEY_SUPERVISORS);
          if (saved?.length) {
            setSelectedSupervisors(saved.filter(s => supervisorsRes.data.includes(s)));
          } else {
            setSelectedSupervisors(supervisorsRes.data);
          }
        }

        setFiltersInitialized(true);
      } catch (err) {
        console.error("Failed to load filters:", err);
        setFiltersInitialized(true);
      }
    };
    loadFilters();
  }, []);

  // Toggle functions
  const toggleJobType = (id: number) => {
    setSelectedJobTypeIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveSelection(STORAGE_KEY_TYPES, next);
      return next;
    });
  };

  const toggleStatus = (id: number) => {
    setSelectedStatusIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveSelection(STORAGE_KEY_STATUSES, next);
      return next;
    });
  };

  const toggleSupervisor = (name: string) => {
    setSelectedSupervisors(prev => {
      const next = prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name];
      saveSelection(STORAGE_KEY_SUPERVISORS, next);
      return next;
    });
  };

  const toggleSupervisorExpanded = (name: string) => {
    setExpandedSupervisors(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Load photos data
  const loadPhotos = useCallback(async () => {
    if (!filtersInitialized || selectedJobTypeIds.length === 0 || selectedStatusIds.length === 0) {
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
        // Filter by selected supervisors
        const filtered: SupervisorGroup = {};
        for (const [supervisor, jobs] of Object.entries(response.data.supervisors)) {
          if (selectedSupervisors.includes(supervisor)) {
            filtered[supervisor] = jobs;
          }
        }
        setData(filtered);
        setTotalJobs(Object.values(filtered).flat().length);
        // Expand all supervisors by default
        setExpandedSupervisors(new Set(Object.keys(filtered)));
      } else {
        setError("Failed to load photos");
      }
    } catch (err) {
      console.error("Failed to load job photos:", err);
      setError("Failed to load photos. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filtersInitialized, selectedJobTypeIds, selectedStatusIds, selectedSupervisors, photosPerJob]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const handlePhotoClick = (jobId: number) => {
    router.push(`/jobs/${jobId}/photo/site`);
  };

  const handlePhotoExpand = (photos: Photo[], index: number) => {
    const apiBase = getApiBaseUrl();
    setLightboxPhotos(photos.map(p => ({
      id: String(p.id),
      name: p.name,
      url: `${apiBase}${p.proxy_url}`,  // Use proxy URL for lightbox (always works)
      thumbnailUrl: p.thumbnail_url,
      modifiedAt: p.modified_at || undefined,
    })));
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  };

  const formatShortDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  };

  const supervisorNames = Object.keys(data);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b dark:border-border">
        <div className="flex items-center gap-2 p-3">
          <BackButton fallbackHref="/jobs" />
          <Camera className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-base font-semibold">Job Photos</h1>

          {/* Filters inline */}
          <div className="flex items-center gap-1.5 ml-3">
            {/* Job Type Dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                  Types ({selectedJobTypeIds.length})
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-2" align="start">
                <div className="space-y-1">
                  {allJobTypes.map(type => (
                    <label key={type.id} className="flex items-center gap-2 px-2 py-1 hover:bg-muted dark:hover:bg-muted rounded cursor-pointer">
                      <Checkbox
                        checked={selectedJobTypeIds.includes(type.id)}
                        onCheckedChange={() => toggleJobType(type.id)}
                      />
                      <span className="text-sm">{type.name}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Supervisor Dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                  Supers ({selectedSupervisors.length})
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2 max-h-64 overflow-y-auto" align="start">
                <div className="space-y-1">
                  {allSupervisors.map(name => (
                    <label key={name} className="flex items-center gap-2 px-2 py-1 hover:bg-muted dark:hover:bg-muted rounded cursor-pointer">
                      <Checkbox
                        checked={selectedSupervisors.includes(name)}
                        onCheckedChange={() => toggleSupervisor(name)}
                      />
                      <span className="text-sm truncate">{name}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Divider */}
            <div className="h-5 w-px bg-muted dark:bg-muted mx-1" />

            {/* Status Toggle Buttons */}
            {allStatuses.map(status => {
              const isSelected = selectedStatusIds.includes(status.id);
              return (
                <Badge
                  key={status.id}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-colors text-xs px-2 py-0.5",
                    isSelected
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "hover:bg-muted dark:hover:bg-muted"
                  )}
                  onClick={() => toggleStatus(status.id)}
                >
                  {status.name}
                </Badge>
              );
            })}
          </div>

          {/* Refresh button */}
          <Button variant="outline" size="sm" onClick={loadPhotos} disabled={loading} className="ml-auto h-7 text-xs px-2">
            <RefreshCw className={cn("h-3 w-3 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-2">
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
        ) : selectedJobTypeIds.length === 0 || selectedStatusIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Camera className="h-12 w-12 mb-4 opacity-50" />
            <p>Select filters to view photos</p>
          </div>
        ) : supervisorNames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Camera className="h-12 w-12 mb-4 opacity-50" />
            <p>No photos found for selected filters</p>
          </div>
        ) : (
          <div className="space-y-1">
            {supervisorNames.map((supervisor) => {
              const isExpanded = expandedSupervisors.has(supervisor);
              const jobs = data[supervisor];
              return (
                <div key={supervisor}>
                  <button
                    onClick={() => toggleSupervisorExpanded(supervisor)}
                    className="flex items-center gap-2 w-full py-1.5 px-2 hover:bg-muted dark:hover:bg-muted rounded text-left"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{supervisor}</span>
                    <span className="text-xs text-muted-foreground">({jobs.length})</span>
                  </button>
                  {isExpanded && (
                    <div className="ml-6 space-y-3 py-2">
                      {jobs.map((job) => (
                        <div key={job.job_id}>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <button
                              onClick={() => handlePhotoClick(job.job_id)}
                              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {job.job_number ? `${job.job_number} - ` : ""}{job.job_name}
                            </button>
                            <span className="text-[10px] text-muted-foreground">
                              {job.job_type} · {job.job_status} · {job.deposit ? "Deposit" : "No Dep"} · Start: {formatShortDate(job.start_date)} · PC: {formatShortDate(job.pc_date)}
                            </span>
                          </div>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {job.photos.map((photo, idx) => {
                              const isOld = photo.days_old !== null && photo.days_old > 3;
                              return (
                                <PhotoThumbnailWithFallback
                                  key={photo.id}
                                  photo={photo}
                                  onClick={() => handlePhotoExpand(job.photos, idx)}
                                  isOld={isOld}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
