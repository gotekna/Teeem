"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Calendar, RefreshCw } from "lucide-react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

interface Job {
  id: number;
  name: string;
  title: string;
  status: string;
  stage: string;
}

export default function SchedulePage() {
  const params = useParams();
  const jobId = params.id as string;
  const router = useRouter();

  const [job, setJob] = React.useState<Job | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

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

    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  const triggerRefresh = React.useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mt-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between pb-1 shrink-0">
        <div className="flex items-center gap-2">
          <BackButton fallbackHref="/jobs" />
          <span className="text-sm font-medium">{job?.name || "Loading..."}</span>
          <div className="flex items-center gap-1 ml-2">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/plans`, '_blank')}>
              Plans
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/purchase-orders`, '_blank')}>
              PO
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/site`, '_blank')}>
              Site
            </Button>
          </div>
        </div>
      </div>

      {/* Table View - fills remaining space */}
      <div className="flex-1 -mx-4">
        <TeeemTableView
          key={refreshKey}
          foundationId="sm-tasks"
          autoFetchRecords={true}
          initialFilters={[
            { id: "job-filter", column: "job_id", operator: "=", value: String(jobId) }
          ]}
          inheritViewsFrom="sm_schedule_master"
          tableName="Schedule Tasks"
          leftActions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/system?tab=schedule-master`)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Master
              </Button>
            </div>
          }
          enableExport={true}
          onRefresh={triggerRefresh}
        />
      </div>
    </div>
  );
}
