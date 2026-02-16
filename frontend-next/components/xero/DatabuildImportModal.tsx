"use client";

import * as React from "react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  ListOrdered,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ---------------------------------------------------
// Types
// ---------------------------------------------------

interface Job {
  id: number;
  name: string;
  job_code: string | null;
}

interface PreviewItem {
  code?: string;
  name?: string;
  bill_amount?: number;
  budget?: number;
  status?: string;
  // Load fields
  load_name?: string;
  po_number?: string;
  amount?: number;
  supplier?: string;
  order_date?: string;
  comments?: string;
  // Line item fields
  description?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  total_price?: number;
  load?: string;
  // BOQ fields
  cost_centre_code?: string;
  cost_centre_name?: string;
}

interface BoqCostCentre {
  code: string;
  name: string;
  item_count: number;
  total_amount: number;
  status: string;
}

interface PreviewSummary {
  total: number;
  new?: number;
  existing?: number;
  total_bill_amount?: number;
  total_budget?: number;
  total_amount?: number;
  // BOQ summary fields
  total_cost_centres?: number;
  new_cost_centres?: number;
  existing_cost_centres?: number;
  total_items?: number;
}

interface PreviewResponse {
  success: boolean;
  format: "cost_centre_summary" | "load_summary" | "line_item_detail" | "boq_detail";
  job: { id: number; name: string; job_code: string };
  items: PreviewItem[];
  cost_centres?: BoqCostCentre[];
  summary: PreviewSummary;
  error?: string;
}

interface ImportStats {
  cost_centres_created: number;
  cost_centres_skipped: number;
  purchase_orders_created: number;
  purchase_orders_skipped: number;
  line_items_created: number;
  budgets_created: number;
  sm_tasks_created: number;
  sm_tasks_skipped: number;
  errors: string[];
}

interface ImportResponse {
  success: boolean;
  stats: ImportStats;
  error?: string;
}

// ---------------------------------------------------
// Component
// ---------------------------------------------------

interface DatabuildImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
  preSelectedJobId?: number | string;
}

type Step = "select" | "preview" | "importing" | "results";

const FORMAT_LABELS: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  cost_centre_summary: {
    label: "Cost Centres",
    icon: <Layers className="h-4 w-4" />,
    description: "Cost centre codes with bill amounts and budgets",
  },
  load_summary: {
    label: "Loads (Purchase Orders)",
    icon: <Package className="h-4 w-4" />,
    description: "Subcontractor loads with amounts and suppliers",
  },
  line_item_detail: {
    label: "Line Items",
    icon: <ListOrdered className="h-4 w-4" />,
    description: "Detailed line items with quantities and prices",
  },
  boq_detail: {
    label: "BOQ (Bill of Quantities)",
    icon: <Layers className="h-4 w-4" />,
    description: "Cost centre sections with line items → SM Tasks",
  },
};

export function DatabuildImportModal({ isOpen, onClose, onImportComplete, preSelectedJobId }: DatabuildImportModalProps) {
  const { toast } = useToast();
  const [step, setStep] = React.useState<Step>("select");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Job selection
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(false);
  const [selectedJobId, setSelectedJobId] = React.useState<string>("");

  // File upload
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

  // Preview
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);

  // Results
  const [importResult, setImportResult] = React.useState<ImportResponse | null>(null);

  // Load jobs when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep("select");
      setError(null);
      setSelectedFile(null);
      setPreview(null);
      setImportResult(null);
      setSelectedJobId(preSelectedJobId ? String(preSelectedJobId) : "");
      if (!preSelectedJobId) {
        fetchJobs();
      }
    }
  }, [isOpen, preSelectedJobId]);

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const response = await api.get<{ jobs?: Job[] }>("/api/v1/jobs/for_select");
      setJobs(response?.jobs || []);
    } catch (err) {
      console.error("Failed to load jobs:", err);
    } finally {
      setLoadingJobs(false);
    }
  };

  // File drop handler
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handlePreview = async () => {
    if (!selectedFile || !selectedJobId) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("csv_file", selectedFile);
      formData.append("job_id", selectedJobId);

      const result = await api.postFormData<PreviewResponse>(
        "/api/v1/csv_imports/databuild_preview",
        formData
      );

      if (result?.success) {
        setPreview(result);
        setStep("preview");
      } else {
        setError(result?.error || "Preview failed");
      }
    } catch (err) {
      console.error("Preview failed:", err);
      setError(err instanceof Error ? err.message : "Failed to preview CSV");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedJobId) return;
    setStep("importing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("csv_file", selectedFile);
      formData.append("job_id", selectedJobId);

      const result = await api.postFormData<ImportResponse>(
        "/api/v1/csv_imports/databuild_import",
        formData
      );

      if (result?.success) {
        setImportResult(result);
        setStep("results");
        onImportComplete?.();

        const s = result.stats;
        const parts = [];
        if (s.cost_centres_created > 0) parts.push(`${s.cost_centres_created} cost centres`);
        if (s.purchase_orders_created > 0) parts.push(`${s.purchase_orders_created} POs`);
        if (s.line_items_created > 0) parts.push(`${s.line_items_created} line items`);
        if (s.sm_tasks_created > 0) parts.push(`${s.sm_tasks_created} SM tasks`);

        toast({
          title: "Databuild Import Complete",
          description: parts.length > 0 ? `Created ${parts.join(", ")}` : "Nothing new to import",
        });
      } else {
        setError(result?.error || "Import failed");
        setStep("preview");
      }
    } catch (err) {
      console.error("Import failed:", err);
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  };

  const formatMoney = (val: number | undefined | null) => {
    if (val == null) return "-";
    return `$${val.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const selectedJob = jobs.find((j) => String(j.id) === selectedJobId);
  const formatInfo = preview ? FORMAT_LABELS[preview.format] : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import from Databuild
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Upload a Databuild CSV export to import cost centres, loads, or line items."}
            {step === "preview" && "Review what will be imported."}
            {step === "importing" && "Importing data..."}
            {step === "results" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select job + upload file */}
        {step === "select" && (
          <>
            <div className="space-y-4">
              {/* Job selector - hidden when pre-selected from job page */}
              {!preSelectedJobId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Job</label>
                  {loadingJobs ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner size={14} />
                      Loading jobs...
                    </div>
                  ) : (
                    <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a job..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {jobs.map((job) => (
                          <SelectItem key={job.id} value={String(job.id)}>
                            <span className="flex items-center gap-2">
                              {job.job_code && (
                                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                  {job.job_code}
                                </span>
                              )}
                              <span className="truncate">{job.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* File upload drop zone */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Databuild CSV File</label>
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : selectedFile
                        ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  )}
                >
                  <input {...getInputProps()} />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {(selectedFile.size / 1024).toFixed(0)} KB
                      </Badge>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {isDragActive
                          ? "Drop CSV file here..."
                          : "Drag and drop a Databuild CSV, or click to browse"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports: Cost Centre Summary, Load Summary, Line Item Detail
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Format help */}
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground text-sm">Databuild Export Guide</p>
                <p>In Databuild: Reports &rarr; Export to CSV. Three formats are auto-detected:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><span className="font-medium">Cost Centre Summary</span> &mdash; Code, Cost Centre, Bill Amount, Budget</li>
                  <li><span className="font-medium">Load Summary</span> &mdash; Load, Amount, Supplier, Order Date</li>
                  <li><span className="font-medium">Line Item Detail / BOQ</span> &mdash; Code/Item, Description, Quantity, Rate/Price, Amount, Load/Ld</li>
                </ul>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handlePreview}
                disabled={!selectedFile || !selectedJobId || loading}
              >
                {loading ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Preview Import
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && preview && (
          <>
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              {/* Format detected + job info */}
              <div className="flex items-center gap-3 flex-wrap">
                {formatInfo && (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 gap-1">
                    {formatInfo.icon}
                    {formatInfo.label}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {preview.format === "boq_detail" ? (
                    <>
                      {preview.summary.total_cost_centres} cost centre{preview.summary.total_cost_centres !== 1 ? "s" : ""}
                      {", "}
                      {preview.summary.total_items} SM task{preview.summary.total_items !== 1 ? "s" : ""}
                    </>
                  ) : (
                    <>{preview.summary.total} item{preview.summary.total !== 1 ? "s" : ""}</>
                  )}
                  {" "}for job{" "}
                  <span className="font-mono font-medium text-foreground">
                    {preview.job.job_code || preview.job.name}
                  </span>
                </span>
                {preview.format === "boq_detail" ? (
                  <>
                    {(preview.summary.new_cost_centres ?? 0) > 0 && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {preview.summary.new_cost_centres} new CC
                      </Badge>
                    )}
                    {(preview.summary.existing_cost_centres ?? 0) > 0 && (
                      <Badge variant="secondary">{preview.summary.existing_cost_centres} CC exist</Badge>
                    )}
                  </>
                ) : (
                  <>
                    {preview.summary.new != null && preview.summary.new > 0 && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {preview.summary.new} new
                      </Badge>
                    )}
                    {preview.summary.existing != null && preview.summary.existing > 0 && (
                      <Badge variant="secondary">{preview.summary.existing} already exist</Badge>
                    )}
                  </>
                )}
              </div>

              {/* Totals */}
              <div className="flex items-center gap-4 text-sm">
                {preview.summary.total_bill_amount != null && (
                  <span>Bill Total: <span className="font-medium">{formatMoney(preview.summary.total_bill_amount)}</span></span>
                )}
                {preview.summary.total_budget != null && (
                  <span>Budget: <span className="font-medium">{formatMoney(preview.summary.total_budget)}</span></span>
                )}
                {preview.summary.total_amount != null && (
                  <span>Total: <span className="font-medium">{formatMoney(preview.summary.total_amount)}</span></span>
                )}
              </div>

              {/* BOQ: Cost Centres summary table */}
              {preview.format === "boq_detail" && preview.cost_centres && preview.cost_centres.length > 0 && (
                <div className="border rounded-md">
                  <div className="px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                    Cost Centres
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium text-xs">Code</th>
                        <th className="px-3 py-1.5 text-left font-medium text-xs">Name</th>
                        <th className="px-3 py-1.5 text-right font-medium text-xs">Items</th>
                        <th className="px-3 py-1.5 text-right font-medium text-xs">Amount</th>
                        <th className="px-3 py-1.5 text-center font-medium text-xs">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.cost_centres.map((cc, idx) => (
                        <tr key={idx} className="hover:bg-accent/50">
                          <td className="px-3 py-1.5 font-mono text-xs">{cc.code}</td>
                          <td className="px-3 py-1.5 text-xs">{cc.name}</td>
                          <td className="px-3 py-1.5 text-right text-xs tabular-nums">{cc.item_count}</td>
                          <td className="px-3 py-1.5 text-right text-xs tabular-nums">{formatMoney(cc.total_amount)}</td>
                          <td className="px-3 py-1.5 text-center">
                            <StatusBadge status={cc.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Items table */}
              {preview.format === "boq_detail" && (
                <div className="px-1 text-xs font-medium text-muted-foreground">
                  SM Tasks (Line Items)
                </div>
              )}
              <div className="flex-1 overflow-y-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <PreviewTableHeader format={preview.format} />
                  </thead>
                  <tbody className="divide-y">
                    {preview.items.map((item, idx) => (
                      <PreviewTableRow key={idx} item={item} format={preview.format} formatMoney={formatMoney} />
                    ))}
                    {preview.items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No items found in CSV
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setStep("select"); setPreview(null); }}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={preview.items.length === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {preview.format === "boq_detail"
                  ? `Import ${preview.summary.total_cost_centres ?? 0} Cost Centres + ${preview.summary.total_items ?? 0} Tasks`
                  : `Import ${preview.summary.total} Item${preview.summary.total !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Spinner size={32} />
            <p className="text-muted-foreground">
              Importing Databuild data into {selectedJob?.name || "job"}...
            </p>
            <p className="text-xs text-muted-foreground">
              Creating cost centres, purchase orders, and line items...
            </p>
          </div>
        )}

        {/* Step 4: Results */}
        {step === "results" && importResult && (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Import completed successfully</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {importResult.stats.cost_centres_created > 0 && (
                  <ResultCard label="Cost Centres Created" value={importResult.stats.cost_centres_created} color="green" />
                )}
                {importResult.stats.cost_centres_skipped > 0 && (
                  <ResultCard label="Cost Centres Skipped" value={importResult.stats.cost_centres_skipped} color="gray" />
                )}
                {importResult.stats.purchase_orders_created > 0 && (
                  <ResultCard label="POs Created" value={importResult.stats.purchase_orders_created} color="blue" />
                )}
                {importResult.stats.purchase_orders_skipped > 0 && (
                  <ResultCard label="POs Skipped" value={importResult.stats.purchase_orders_skipped} color="gray" />
                )}
                {importResult.stats.line_items_created > 0 && (
                  <ResultCard label="Line Items Created" value={importResult.stats.line_items_created} color="purple" />
                )}
                {importResult.stats.sm_tasks_created > 0 && (
                  <ResultCard label="SM Tasks Created" value={importResult.stats.sm_tasks_created} color="purple" />
                )}
                {importResult.stats.sm_tasks_skipped > 0 && (
                  <ResultCard label="SM Tasks Skipped" value={importResult.stats.sm_tasks_skipped} color="gray" />
                )}
                {importResult.stats.budgets_created > 0 && (
                  <ResultCard label="Budgets Linked" value={importResult.stats.budgets_created} color="amber" />
                )}
              </div>

              {importResult.stats.errors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive mb-2">
                    {importResult.stats.errors.length} error{importResult.stats.errors.length !== 1 ? "s" : ""}:
                  </p>
                  <ul className="text-xs text-destructive space-y-1">
                    {importResult.stats.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importResult.stats.errors.length > 10 && (
                      <li>...and {importResult.stats.errors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setStep("select"); setPreview(null); setImportResult(null); setSelectedFile(null); }}>
                Import Another
              </Button>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------
// Sub-components
// ---------------------------------------------------

function PreviewTableHeader({ format }: { format: string }) {
  if (format === "cost_centre_summary") {
    return (
      <tr>
        <th className="px-3 py-2 text-left font-medium">Code</th>
        <th className="px-3 py-2 text-left font-medium">Name</th>
        <th className="px-3 py-2 text-right font-medium">Bill Amount</th>
        <th className="px-3 py-2 text-right font-medium">Budget</th>
        <th className="px-3 py-2 text-center font-medium">Status</th>
      </tr>
    );
  }
  if (format === "load_summary") {
    return (
      <tr>
        <th className="px-3 py-2 text-left font-medium">Load</th>
        <th className="px-3 py-2 text-left font-medium">PO #</th>
        <th className="px-3 py-2 text-left font-medium">Supplier</th>
        <th className="px-3 py-2 text-right font-medium">Amount</th>
        <th className="px-3 py-2 text-left font-medium">Date</th>
        <th className="px-3 py-2 text-center font-medium">Status</th>
      </tr>
    );
  }
  if (format === "boq_detail") {
    return (
      <tr>
        <th className="px-3 py-2 text-left font-medium">Cost Centre</th>
        <th className="px-3 py-2 text-left font-medium">Code</th>
        <th className="px-3 py-2 text-left font-medium">Description</th>
        <th className="px-3 py-2 text-right font-medium">Qty</th>
        <th className="px-3 py-2 text-right font-medium">Rate</th>
        <th className="px-3 py-2 text-right font-medium">Amount</th>
      </tr>
    );
  }
  // line_item_detail
  return (
    <tr>
      <th className="px-3 py-2 text-left font-medium">Code</th>
      <th className="px-3 py-2 text-left font-medium">Description</th>
      <th className="px-3 py-2 text-right font-medium">Qty</th>
      <th className="px-3 py-2 text-right font-medium">Unit Price</th>
      <th className="px-3 py-2 text-right font-medium">Total</th>
      <th className="px-3 py-2 text-center font-medium">Load</th>
    </tr>
  );
}

function PreviewTableRow({
  item,
  format,
  formatMoney,
}: {
  item: PreviewItem;
  format: string;
  formatMoney: (val: number | undefined | null) => string;
}) {
  if (format === "cost_centre_summary") {
    return (
      <tr className="hover:bg-accent/50">
        <td className="px-3 py-2 font-mono text-xs">{item.code}</td>
        <td className="px-3 py-2">{item.name}</td>
        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.bill_amount)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.budget)}</td>
        <td className="px-3 py-2 text-center">
          <StatusBadge status={item.status} />
        </td>
      </tr>
    );
  }
  if (format === "load_summary") {
    return (
      <tr className="hover:bg-accent/50">
        <td className="px-3 py-2">{item.load_name}</td>
        <td className="px-3 py-2 font-mono text-xs">{item.po_number}</td>
        <td className="px-3 py-2 truncate max-w-[200px]">{item.supplier}</td>
        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.amount)}</td>
        <td className="px-3 py-2 text-xs">{item.order_date || "-"}</td>
        <td className="px-3 py-2 text-center">
          <StatusBadge status={item.status} />
        </td>
      </tr>
    );
  }
  if (format === "boq_detail") {
    return (
      <tr className="hover:bg-accent/50">
        <td className="px-3 py-2">
          {item.cost_centre_code && (
            <Badge variant="outline" className="text-xs font-mono">{item.cost_centre_code}</Badge>
          )}
        </td>
        <td className="px-3 py-2 font-mono text-xs">{item.code}</td>
        <td className="px-3 py-2 truncate max-w-[250px]">{item.description}</td>
        <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.unit_price)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.total_price)}</td>
      </tr>
    );
  }
  // line_item_detail
  return (
    <tr className="hover:bg-accent/50">
      <td className="px-3 py-2 font-mono text-xs">{item.code}</td>
      <td className="px-3 py-2 truncate max-w-[250px]">{item.description}</td>
      <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.unit_price)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.total_price)}</td>
      <td className="px-3 py-2 text-center">
        {item.load && (
          <Badge variant="outline" className="text-xs">{item.load}</Badge>
        )}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string | undefined }) {
  if (!status) return null;
  if (status === "new") {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
        New
      </Badge>
    );
  }
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

function ResultCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    gray: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className={cn("rounded-md border p-3 text-center", colorClasses[color] || colorClasses.gray)}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
