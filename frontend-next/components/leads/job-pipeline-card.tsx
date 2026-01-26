"use client";

import { PipelineJob } from "@/types/leads";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, DollarSign, Building2 } from "lucide-react";
import { formatCurrencyWhole } from "@/utils/formatters";

interface JobPipelineCardProps {
  job: PipelineJob;
  onClick?: () => void;
  isDragging?: boolean;
}

export function JobPipelineCard({ job, onClick, isDragging }: JobPipelineCardProps) {

  // Extract suburb from location (usually "Street, Suburb, State Postcode")
  const getSuburb = (location?: string) => {
    if (!location) return "No location";
    const parts = location.split(",");
    if (parts.length >= 2) {
      return parts[1].trim();
    }
    return location;
  };

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow w-full ${
        isDragging ? "opacity-50 rotate-2 shadow-lg" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm line-clamp-2">{job.title}</h3>
        </div>

        {job.client_name && (
          <p className="text-xs text-muted-foreground">{job.client_name}</p>
        )}

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{getSuburb(job.location)}</span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
            <DollarSign className="h-3 w-3" />
            {formatCurrencyWhole(Number(job.contract_value) || 0)}
          </div>
          {job.job_type && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span>{job.job_type}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
