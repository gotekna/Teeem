"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ComboboxDropdown, ComboboxItem } from "@/components/ui/combobox-dropdown";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface CreatePropertyFromJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface JobForSelect {
  id: number;
  label: string;
  job_code: string;
  client_name?: string;
}

export function CreatePropertyFromJobDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreatePropertyFromJobDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [jobs, setJobs] = useState<ComboboxItem[]>([]);
  const [selectedJob, setSelectedJob] = useState<ComboboxItem | undefined>();
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tenantName, setTenantName] = useState("");

  // Fetch jobs for select
  useEffect(() => {
    if (!open) return;
    setLoadingJobs(true);
    api.get<{ success: boolean; jobs: JobForSelect[] }>("/api/v1/jobs/for_select")
      .then((res) => {
        if (res.success && res.jobs) {
          setJobs(
            res.jobs.map((j) => ({
              id: String(j.id),
              label: `${j.label}`,
              searchText: j.client_name || "",
            }))
          );
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
      const res = await api.post<{ success: boolean; data: { id: number } }>("/api/v1/properties/from_job", {
        job_id: selectedJob.id,
        tenant_name: tenantName || null,
      });

      if (res?.success && res.data) {
        toast({ title: "Success", description: "Property created from job" });
        setSelectedJob(undefined);
        setTenantName("");
        onSuccess?.();
        onOpenChange(false);
        router.push(`/properties/${res.data.id}`);
      }
    } catch {
      toast({ title: "Error", description: "Failed to create property", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [selectedJob, tenantName, toast, onSuccess, onOpenChange, router]);

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
              items={jobs}
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

          <div className="space-y-2">
            <Label>Tenant Name</Label>
            <Input
              placeholder="Name of the tenant (optional)"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              You can add the tenant after creating the property.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !selectedJob}>
            {saving && <Spinner className="mr-2 h-4 w-4" />}
            Create Property
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
