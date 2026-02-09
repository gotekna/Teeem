"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FileSpreadsheet, Plus, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface Spreadsheet {
  id: number;
  name: string;
  description?: string;
  sheetCount: number;
  updatedAt: string;
  createdAt: string;
}

interface JobSpreadsheetsSectionProps {
  jobId: number;
  jobName?: string;
}

export function JobSpreadsheetsSection({ jobId, jobName }: JobSpreadsheetsSectionProps) {
  const [spreadsheets, setSpreadsheets] = React.useState<Spreadsheet[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchSpreadsheets = async () => {
      setLoading(true);
      try {
        const response = await api.get<{ success: boolean; data: Spreadsheet[] }>(
          `/api/v1/teeem_spreadsheets?job_id=${jobId}`
        );
        if (response?.success && response.data) {
          setSpreadsheets(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch spreadsheets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSpreadsheets();
  }, [jobId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Spreadsheets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Spinner size={20} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Spreadsheets
            {spreadsheets.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({spreadsheets.length})
              </span>
            )}
          </CardTitle>
          <Link href={`/admin/system/teeem-xl?job_id=${jobId}&job_name=${encodeURIComponent(jobName || "")}`}>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {spreadsheets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No spreadsheets attached to this job
          </p>
        ) : (
          <div className="space-y-2">
            {spreadsheets.map((spreadsheet) => (
              <Link
                key={spreadsheet.id}
                href={`/admin/system/teeem-xl/${spreadsheet.id}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <FileSpreadsheet className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{spreadsheet.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {spreadsheet.sheetCount} sheet{spreadsheet.sheetCount !== 1 ? "s" : ""} · Updated{" "}
                      {formatDistanceToNow(new Date(spreadsheet.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
