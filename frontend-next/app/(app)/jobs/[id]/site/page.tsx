"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { JobSitePresenceTab } from "@/components/jobs/JobSitePresenceTab";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";


interface Job {
  id: number;
  name: string;
  title: string;
}

export default function SiteFullscreenPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = React.useState<Job | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchJob = async () => {
      try {
        const jobData = await api.get<Job>(`/api/v1/jobs/${jobId}`);
        setJob(jobData);
      } catch (error) {
        console.error("Failed to fetch job:", error);
      } finally {
        setLoading(false);
      }
    };
    if (jobId) fetchJob();
  }, [jobId]);

  if (loading) {
    return (
      <LoadingOverlay height="h-96" />
    );
  }

  return (
    <div className="flex flex-col h-full -mt-4">
      <div className="flex items-center gap-2 pb-1 shrink-0">
        <BackButton fallbackHref={`/jobs/${jobId}`} />
        <span className="text-sm font-medium">{job?.name || "Loading..."}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <JobSitePresenceTab jobId={jobId} />
      </div>
    </div>
  );
}
