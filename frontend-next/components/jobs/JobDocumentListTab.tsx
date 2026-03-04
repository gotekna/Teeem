"use client";

/**
 * JobDocumentListTab - Thin wrapper around EntityDocumentListTab for jobs
 *
 * THE ONE document tab component for job document folders (tab_type='document').
 * Delegates to EntityDocumentListTab with job-specific defaults.
 *
 * Photo tabs continue using JobDocumentsTab (gallery view + camera capture).
 */

import EntityDocumentListTab from "@/components/documents/EntityDocumentListTab";
import type { WarehouseFolder } from "@/lib/types/warehouse-folders";

interface JobDocumentListTabProps {
  jobId: number | string;
  warehouseFolder: WarehouseFolder;
  jobName?: string;
  jobCode?: string;
}

export default function JobDocumentListTab({ jobId, warehouseFolder, jobName, jobCode }: JobDocumentListTabProps) {
  return (
    <EntityDocumentListTab
      entityId={jobId}
      entityType="Job"
      sourceType="job"
      uploadScope="job_documents"
      warehouseFolder={warehouseFolder}
      entityName={jobName}
      entityCode={jobCode}
    />
  );
}
