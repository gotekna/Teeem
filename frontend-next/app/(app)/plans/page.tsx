"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  RefreshCw,
  Play,
  SkipForward,
  Trash2,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Scan,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PlanFolderScan {
  id: number;
  job_id: number;
  job_name: string;
  sharepoint_file_id: string;
  file_name: string;
  file_modified_at: string;
  file_size: number;
  status: "pending" | "processing" | "processed" | "skipped" | "error";
  job_plan_id: number | null;
  job_plan_name: string | null;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
}

interface ScansResponse {
  success: boolean;
  data: PlanFolderScan[];
  meta: {
    pending_count: number;
    processing_count: number;
    processed_count: number;
  };
}

export default function PlansPage() {
  const [scans, setScans] = useState<PlanFolderScan[]>([]);
  const [meta, setMeta] = useState({ pending_count: 0, processing_count: 0, processed_count: 0 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();

  const fetchScans = useCallback(async () => {
    try {
      const response = await api.get<ScansResponse>("/api/v1/plan_folder_scans");
      if (response.success) {
        setScans(response.data);
        setMeta(response.meta);
      }
    } catch (error) {
      console.error("Failed to fetch scans:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  const handleScanFolders = async () => {
    setScanning(true);
    try {
      const response = await api.post<{ success: boolean; message: string; scanned_count?: number }>(
        "/api/v1/plan_folder_scans/scan_all"
      );
      if (response?.success) {
        toast({
          title: "Scan Started",
          description: response.message || "Scanning folders for new plans...",
        });
        // Refresh after a delay to show results
        setTimeout(fetchScans, 3000);
      }
    } catch (error) {
      toast({
        title: "Scan Failed",
        description: "Failed to scan folders",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  const handleProcess = async (id: number) => {
    try {
      await api.post(`/api/v1/plan_folder_scans/${id}/process_scan`);
      toast({ title: "Processing", description: "File queued for processing" });
      fetchScans();
    } catch (error) {
      toast({ title: "Error", description: "Failed to process", variant: "destructive" });
    }
  };

  const handleSkip = async (id: number) => {
    try {
      await api.post(`/api/v1/plan_folder_scans/${id}/skip`);
      toast({ title: "Skipped", description: "File marked as skipped" });
      fetchScans();
    } catch (error) {
      toast({ title: "Error", description: "Failed to skip", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/v1/plan_folder_scans/${id}`);
      toast({ title: "Deleted", description: "Scan record removed" });
      fetchScans();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case "processed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Processed</Badge>;
      case "skipped":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200"><SkipForward className="h-3 w-3 mr-1" />Skipped</Badge>;
      case "error":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "-";
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plans</h1>
          <p className="text-muted-foreground">
            Scan SharePoint folders for new plans from Revit
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchScans}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleScanFolders} disabled={scanning}>
            {scanning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Scan className="h-4 w-4 mr-2" />
            )}
            Scan Folders
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{meta.pending_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{meta.processing_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{meta.processed_count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Scans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scanned Files</CardTitle>
          <CardDescription>
            Files found in job plan folders. Process to add to job plans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No scanned files yet</p>
              <p className="text-sm">Click "Scan Folders" to scan SharePoint for new plans</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linked Plan</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell className="font-medium max-w-[200px] truncate" title={scan.file_name}>
                      {scan.file_name}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={scan.job_name}>
                      {scan.job_name}
                    </TableCell>
                    <TableCell>{formatDate(scan.file_modified_at)}</TableCell>
                    <TableCell>{formatFileSize(scan.file_size)}</TableCell>
                    <TableCell>{getStatusBadge(scan.status)}</TableCell>
                    <TableCell>
                      {scan.job_plan_name || (scan.error_message && (
                        <span className="text-xs text-red-500" title={scan.error_message}>
                          {scan.error_message.substring(0, 30)}...
                        </span>
                      )) || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {(scan.status === "pending" || scan.status === "error") && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleProcess(scan.id)}
                              title="Process this file"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSkip(scan.id)}
                              title="Skip (not a plan)"
                            >
                              <SkipForward className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(scan.id)}
                          title="Delete record"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
