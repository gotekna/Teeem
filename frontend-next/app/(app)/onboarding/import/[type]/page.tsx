"use client";

import { useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { BackButton } from "@/components/ui/back-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  downloadTemplate,
  previewImport,
  executeImport,
  ImportPreviewResult,
  ImportResult,
  useOnboardingStatus,
} from "@/lib/hooks/useOnboardingStatus";
import { useDropzone } from "react-dropzone";

const importTypeConfig: Record<string, { title: string; description: string }> = {
  contacts: {
    title: "Import Contacts",
    description: "Import your clients, suppliers, and other contacts",
  },
  jobs: {
    title: "Import Jobs",
    description: "Import your existing projects and jobs",
  },
  pricebook_items: {
    title: "Import Pricebook Items",
    description: "Import your product and service catalog",
  },
  price_histories: {
    title: "Import Price History",
    description: "Import historical pricing for trend analysis",
  },
};

type Step = "upload" | "preview" | "options" | "importing" | "complete";

export default function ImportWizardPage() {
  useSetLayoutMode("full-height");
  const router = useRouter();
  const params = useParams();
  const importType = params.type as string;
  const { refresh: refreshOnboarding } = useOnboardingStatus();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState({
    skip_invalid: true,
    update_existing: false,
    auto_create_lookups: true,
  });

  const config = importTypeConfig[importType];

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const uploadedFile = acceptedFiles[0];
    setFile(uploadedFile);
    setIsLoading(true);

    try {
      const previewResult = await previewImport(importType, uploadedFile, options);
      setPreview(previewResult);
      setStep("preview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to preview file");
    } finally {
      setIsLoading(false);
    }
  }, [importType, options]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplate(importType);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${importType}_import_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Template downloaded");
    } catch (error) {
      toast.error("Failed to download template");
    }
  };

  const handleExecuteImport = async () => {
    if (!file) return;

    setStep("importing");
    setIsLoading(true);

    try {
      const importResult = await executeImport(importType, file, options);
      setResult(importResult);
      setStep("complete");
      refreshOnboarding();
      toast.success("Import completed successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === "preview") {
      setStep("upload");
      setFile(null);
      setPreview(null);
    } else if (step === "options") {
      setStep("preview");
    } else {
      router.push("/onboarding");
    }
  };

  if (!config) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <p>Unknown import type: {importType}</p>
        <Button onClick={() => router.push("/onboarding")}>Back to Onboarding</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <BackButton href="/onboarding" />
        <div>
          <h1 className="text-2xl font-bold">{config.title}</h1>
          <p className="text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {["upload", "preview", "complete"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step === s || (step === "options" && s === "preview") || (step === "importing" && s === "preview")
                  ? "bg-primary text-primary-foreground"
                  : step === "complete" || (i < ["upload", "preview", "complete"].indexOf(step))
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"}
              `}
            >
              {step === "complete" || (i < ["upload", "preview", "complete"].indexOf(step)) ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                i + 1
              )}
            </div>
            <span className="text-sm capitalize hidden sm:inline">{s}</span>
            {i < 2 && <div className="w-8 h-0.5 bg-muted" />}
          </div>
        ))}
      </div>

      {/* Upload Step */}
      {step === "upload" && (
        <div className="space-y-6">
          {/* Download Template */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Step 1: Download Template
              </CardTitle>
              <CardDescription>
                Start with our template to ensure your data is formatted correctly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleDownloadTemplate} variant="outline" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Download {importType.replace("_", " ")} Template
              </Button>
            </CardContent>
          </Card>

          {/* Upload File */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Step 2: Upload Your Data
              </CardTitle>
              <CardDescription>
                Fill in the template and upload it here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-colors
                  ${isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/50"}
                `}
              >
                <input {...getInputProps()} />
                {isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p>Processing file...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-1">
                      {isDragActive ? "Drop file here" : "Drag and drop your file here"}
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Accepts .xlsx or .csv files
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview Step */}
      {(step === "preview" || step === "options") && preview && (
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Preview Results</CardTitle>
              <CardDescription>
                Review the data before importing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{preview.total_rows}</p>
                  <p className="text-sm text-muted-foreground">Total Rows</p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {preview.preview.filter((r) => r.status === "valid").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Valid</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">
                    {preview.warnings.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">
                    {preview.errors.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Errors</p>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.slice(0, 10).map((row) => (
                      <TableRow key={row.row}>
                        <TableCell>{row.row}</TableCell>
                        <TableCell>
                          {row.status === "valid" && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Valid
                            </Badge>
                          )}
                          {row.status === "warning" && (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Warning
                            </Badge>
                          )}
                          {row.status === "error" && (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.errors.map((e, i) => (
                            <span key={i} className="text-red-600 block">{e.message}</span>
                          ))}
                          {row.warnings.map((w, i) => (
                            <span key={i} className="text-yellow-600 block">{w.message}</span>
                          ))}
                          {row.status === "valid" && "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.total_rows > 10 && (
                  <div className="p-2 text-center text-sm text-muted-foreground bg-muted">
                    Showing first 10 of {preview.total_rows} rows
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Import Options */}
          <Card>
            <CardHeader>
              <CardTitle>Import Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skip_invalid"
                  checked={options.skip_invalid}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, skip_invalid: !!checked }))
                  }
                />
                <label htmlFor="skip_invalid" className="text-sm">
                  Skip invalid rows (recommended)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="update_existing"
                  checked={options.update_existing}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, update_existing: !!checked }))
                  }
                />
                <label htmlFor="update_existing" className="text-sm">
                  Update existing records if found
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto_create_lookups"
                  checked={options.auto_create_lookups}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, auto_create_lookups: !!checked }))
                  }
                />
                <label htmlFor="auto_create_lookups" className="text-sm">
                  Automatically create missing lookup values
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleExecuteImport}
              disabled={!preview.valid && !options.skip_invalid}
            >
              Import {preview.valid ? "All" : "Valid"} Rows
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Importing Step */}
      {step === "importing" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Importing Data...</h3>
            <p className="text-muted-foreground">
              Please wait while we process your data
            </p>
          </CardContent>
        </Card>
      )}

      {/* Complete Step */}
      {step === "complete" && result && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-2xl font-bold mb-2">Import Complete!</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-md mx-auto mt-6 mb-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{result.rows_created}</p>
                <p className="text-sm text-muted-foreground">Created</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{result.rows_updated}</p>
                <p className="text-sm text-muted-foreground">Updated</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">{result.rows_skipped}</p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{result.errors_count}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => router.push("/onboarding")}>
                Back to Onboarding
              </Button>
              <Button onClick={() => router.push(`/${importType.replace("_", "-")}`)}>
                View Imported Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
