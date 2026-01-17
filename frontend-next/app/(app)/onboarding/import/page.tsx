"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";

interface OnboardingStatus {
  tenant_name: string;
  has_contacts: boolean;
  has_jobs: boolean;
  has_pricebook: boolean;
  has_trades: boolean;
  contacts_count: number;
  jobs_count: number;
  pricebook_count: number;
  trades_count: number;
  onboarding_complete: boolean;
}

interface UploadedFile {
  file: File;
  type: string;
  status: "pending" | "validating" | "valid" | "invalid" | "importing" | "imported" | "error";
  rowCount?: number;
  errors?: string[];
}

const TEMPLATE_TYPES = [
  { type: "contacts", label: "Contacts", description: "Clients, suppliers, and staff contacts" },
  { type: "companies", label: "Companies", description: "Company records" },
  { type: "jobs", label: "Jobs", description: "Your projects and job sites" },
  { type: "pricebook_items", label: "Pricebook", description: "Materials and pricing" },
  { type: "trades", label: "Trades", description: "Subcontractors and trades" },
];

export default function DataImportPage() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    counts?: Record<string, number>;
  } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; status: OnboardingStatus }>("/api/v1/onboarding/status");
      if (response?.success) {
        setStatus(response.status);
      }
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleDownloadTemplates = async () => {
    setIsDownloading(true);
    try {
      const blob = await api.getBlob("/api/v1/onboarding/templates");

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "teeem_import_templates.zip");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Handle error
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadTemplate = async (type: string) => {
    try {
      const blob = await api.getBlob(`/api/v1/onboarding/template/${type}`);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${type}_import_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Handle error
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];

    Array.from(files).forEach((file) => {
      // Try to determine type from filename
      const filename = file.name.toLowerCase();
      let type = "unknown";

      for (const template of TEMPLATE_TYPES) {
        if (filename.includes(template.type)) {
          type = template.type;
          break;
        }
      }

      newFiles.push({
        file,
        type,
        status: "pending",
      });
    });

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = ""; // Reset input
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleValidate = async () => {
    if (uploadedFiles.length === 0) return;

    const formData = new FormData();

    uploadedFiles.forEach((uf) => {
      if (uf.type !== "unknown") {
        formData.append(`${uf.type}_file`, uf.file);
      }
    });

    // Update status to validating
    setUploadedFiles((prev) =>
      prev.map((f) => ({ ...f, status: "validating" as const }))
    );

    try {
      const response = await api.postFormData<{
        valid: boolean;
        would_import?: Record<string, number>;
        errors?: string[];
      }>("/api/v1/onboarding/validate", formData);

      // Update files with validation results
      setUploadedFiles((prev) =>
        prev.map((f) => {
          const count = response.would_import?.[f.type];
          return {
            ...f,
            status: response.valid ? "valid" : "invalid",
            rowCount: count,
            errors: response.errors?.filter((e: string) =>
              e.toLowerCase().includes(f.type)
            ),
          };
        })
      );
    } catch {
      setUploadedFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as const }))
      );
    }
  };

  const handleImport = async () => {
    if (uploadedFiles.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);

    const formData = new FormData();

    uploadedFiles.forEach((uf) => {
      if (uf.type !== "unknown") {
        formData.append(`${uf.type}_file`, uf.file);
      }
    });

    // Update status to importing
    setUploadedFiles((prev) =>
      prev.map((f) => ({ ...f, status: "importing" as const }))
    );

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const response = await api.postFormData<{
        success: boolean;
        counts?: Record<string, number>;
        error?: string;
        errors?: string[];
      }>("/api/v1/onboarding/import", formData);

      clearInterval(progressInterval);
      setImportProgress(100);

      if (response.success) {
        setImportResult({
          success: true,
          message: "Data imported successfully!",
          counts: response.counts,
        });
        setUploadedFiles((prev) =>
          prev.map((f) => ({ ...f, status: "imported" as const }))
        );
        // Refresh status
        loadStatus();
      } else {
        setImportResult({
          success: false,
          message: response.error || "Import failed",
          counts: response.counts,
        });
        setUploadedFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: "error" as const,
            errors: response.errors,
          }))
        );
      }
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : "Import failed",
      });
      setUploadedFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as const }))
      );
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Import Your Data</h1>
        <p className="text-muted-foreground">
          Use our Excel templates to import your existing data into TEEEM.
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Current Data
          </CardTitle>
          <CardDescription>Your current data in TEEEM</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusItem
              label="Contacts"
              count={status?.contacts_count || 0}
              hasData={status?.has_contacts || false}
            />
            <StatusItem
              label="Jobs"
              count={status?.jobs_count || 0}
              hasData={status?.has_jobs || false}
            />
            <StatusItem
              label="Pricebook"
              count={status?.pricebook_count || 0}
              hasData={status?.has_pricebook || false}
            />
            <StatusItem
              label="Trades"
              count={status?.trades_count || 0}
              hasData={status?.has_trades || false}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Download Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Step 1: Download Templates
          </CardTitle>
          <CardDescription>
            Download Excel templates, fill in your data, then upload them back
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleDownloadTemplates}
            disabled={isDownloading}
            className="w-full sm:w-auto"
          >
            {isDownloading ? (
              <Spinner size={16} className="mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download All Templates (ZIP)
          </Button>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-4">
            {TEMPLATE_TYPES.map((template) => (
              <Button
                key={template.type}
                variant="outline"
                size="sm"
                onClick={() => handleDownloadTemplate(template.type)}
                className="justify-start"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {template.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Upload Files */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Step 2: Upload Completed Files
          </CardTitle>
          <CardDescription>
            Select your filled-in Excel files to import
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Zone */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              multiple
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-medium">Click to upload files</p>
              <p className="text-sm text-muted-foreground">
                or drag and drop Excel files here
              </p>
            </label>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Files to Import</h4>
              {uploadedFiles.map((uf, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">{uf.file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Type: {uf.type} {uf.rowCount && `(${uf.rowCount} rows)`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileStatus status={uf.status} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isImporting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Errors */}
              {uploadedFiles.some((f) => f.errors?.length) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {uploadedFiles
                        .flatMap((f) => f.errors || [])
                        .slice(0, 5)
                        .map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleValidate}
                  disabled={isImporting || uploadedFiles.length === 0}
                >
                  Validate Files
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isImporting || uploadedFiles.length === 0}
                >
                  {isImporting ? (
                    <>
                      <Spinner size={16} className="mr-2" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Data
                    </>
                  )}
                </Button>
              </div>

              {/* Import Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    Importing data... {importProgress}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <Alert variant={importResult.success ? "default" : "destructive"}>
              {importResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                <p className="font-medium">{importResult.message}</p>
                {importResult.counts && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(importResult.counts).map(([type, count]) => (
                      <Badge key={type} variant="secondary">
                        {type}: {count}
                      </Badge>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusItem({
  label,
  count,
  hasData,
}: {
  label: string;
  count: number;
  hasData: boolean;
}) {
  return (
    <div className="text-center p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center justify-center gap-2 mb-1">
        {hasData ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{count}</p>
    </div>
  );
}

function FileStatus({ status }: { status: UploadedFile["status"] }) {
  switch (status) {
    case "validating":
    case "importing":
      return <Spinner size={16} />;
    case "valid":
    case "imported":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "invalid":
    case "error":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
}
