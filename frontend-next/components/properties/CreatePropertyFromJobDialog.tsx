"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ComboboxDropdown, ComboboxItem } from "@/components/ui/combobox-dropdown";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { User } from "lucide-react";

interface CreatePropertyFromJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface JobForSelect {
  id: number;
  name: string;
  client_name?: string;
  client_names?: string[];
}

export function CreatePropertyFromJobDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreatePropertyFromJobDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [rawJobs, setRawJobs] = useState<JobForSelect[]>([]);
  const [selectedJob, setSelectedJob] = useState<ComboboxItem | undefined>();
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [saving, setSaving] = useState(false);

  const comboItems: ComboboxItem[] = useMemo(
    () =>
      rawJobs.map((j) => ({
        id: String(j.id),
        label: j.name,
        searchText: j.client_name || "",
      })),
    [rawJobs]
  );

  // Look up client/owner names for the selected job
  const selectedOwnerNames = useMemo(() => {
    if (!selectedJob) return [];
    const job = rawJobs.find((j) => String(j.id) === selectedJob.id);
    if (job?.client_names?.length) return job.client_names;
    if (job?.client_name) return [job.client_name];
    return [];
  }, [selectedJob, rawJobs]);

  // Fetch jobs for select
  useEffect(() => {
    if (!open) return;
    setLoadingJobs(true);
    api
      .get<{ success: boolean; jobs: JobForSelect[] }>("/api/v1/jobs/for_select")
      .then((res) => {
        if (res.success && res.jobs) {
          setRawJobs(res.jobs);
        }
      })
      .finally(() => setLoadingJobs(false));
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!selectedJob) {
      toast({ title: "Required", description: "Please select a job", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await api.post<{ success: boolean; data: { id: number } }>(
        "/api/v1/properties/from_job",
        { job_id: selectedJob.id }
      );

      if (res?.success && res.data) {
        toast({ title: "Success", description: "Property created from job" });
        setSelectedJob(undefined);
        onSuccess?.();
        onOpenChange(false);
        router.push(`/properties/${res.data.id}`);
      }
    } catch {
      toast({ title: "Error", description: "Failed to create property", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [selectedJob, toast, onSuccess, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Create Property from Job</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Job *</Label>
            <ComboboxDropdown
              items={comboItems}
              selectedItem={selectedJob}
              onSelect={setSelectedJob}
              placeholder="Search jobs..."
              searchPlaceholder="Type to search..."
              isLoading={loadingJobs}
              clearable
              onClear={() => setSelectedJob(undefined)}
            />
            <p className="text-xs text-muted-foreground">
              Address and client contact will be copied from the job.
            </p>
          </div>

          {/* Show owner(s) from selected job */}
          {selectedJob && (
            <div className="rounded-md border bg-muted/50 px-4 py-3">
              <div className="flex items-start gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-muted-foreground">
                    {selectedOwnerNames.length > 1 ? "Owners: " : "Owner: "}
                  </span>
                  {selectedOwnerNames.length > 0 ? (
                    <span className="font-medium">
                      {selectedOwnerNames.join(", ")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">No client on job</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !selectedJob}>
            {saving && <Spinner className="mr-2 h-4 w-4" />}
            Create Property
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
