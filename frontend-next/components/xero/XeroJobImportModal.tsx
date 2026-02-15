"use client";

import * as React from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Briefcase,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Heart,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ---------------------------------------------------
// Types
// ---------------------------------------------------

interface TrackingOption {
  id: string;
  name: string;
  variant: string | null;
  status: string;
}

interface ParsedAddress {
  job_code: string | null;
  street_number: string | null;
  street_name: string | null;
  street_type: string | null;
  suburb: string | null;
  title: string | null;
}

interface ClientInfo {
  name: string;
  is_couple: boolean;
  person1: { first: string; last: string | null } | null;
  person2: { first: string; last: string | null } | null;
}

interface ExistingJob {
  id: number;
  name: string;
  job_code: string;
}

interface PreviewItem {
  code: string;
  tracking_options: TrackingOption[];
  parsed: ParsedAddress;
  client: ClientInfo | null;
  existing_job: ExistingJob | null;
  status: "new" | "exists";
}

interface PreviewResponse {
  success: boolean;
  tracking_category: string;
  total_options: number;
  total_jobs: number;
  items: PreviewItem[];
}

interface ImportStats {
  created: number;
  skipped: number;
  linked: number;
  contacts_split: number;
  clients_linked: number;
  errors: string[];
}

interface ImportResponse {
  success: boolean;
  stats: ImportStats;
  tracking_category: string;
}

// ---------------------------------------------------
// Component
// ---------------------------------------------------

interface XeroJobImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type Step = "preview" | "importing" | "results";

export function XeroJobImportModal({ isOpen, onClose, onImportComplete }: XeroJobImportModalProps) {
  const { toast } = useToast();
  const [step, setStep] = React.useState<Step>("preview");
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [importResult, setImportResult] = React.useState<ImportResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch preview when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep("preview");
      setError(null);
      setImportResult(null);
      fetchPreview();
    }
  }, [isOpen]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<PreviewResponse>("/api/v1/xero/tracking_categories_preview");
      if (response?.success) {
        setPreview(response);
        // Select all new items by default
        const newIds = new Set<string>();
        response.items.forEach((item) => {
          if (item.status === "new") {
            item.tracking_options.forEach((opt) => newIds.add(opt.id));
          }
        });
        setSelectedIds(newIds);
      } else {
        setError("Failed to load preview");
      }
    } catch (err) {
      console.error("Preview fetch failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setStep("importing");
    setError(null);
    try {
      const optionIds = Array.from(selectedIds);
      const response = await api.post<ImportResponse>("/api/v1/xero/import_jobs", {
        option_ids: optionIds,
      });

      if (response?.success) {
        setImportResult(response);
        setStep("results");
        onImportComplete?.();
        toast({
          title: "Import Complete",
          description: `Created ${response.stats.created} jobs, linked ${response.stats.clients_linked} clients`,
        });
      } else {
        setError("Import failed");
        setStep("preview");
      }
    } catch (err) {
      console.error("Import failed:", err);
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  };

  const toggleAll = () => {
    if (!preview) return;
    const allNewIds = new Set<string>();
    preview.items.forEach((item) => {
      if (item.status === "new") {
        item.tracking_options.forEach((opt) => allNewIds.add(opt.id));
      }
    });

    if (selectedIds.size === allNewIds.size) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(allNewIds);
    }
  };

  const toggleItem = (item: PreviewItem) => {
    const next = new Set(selectedIds);
    const itemIds = item.tracking_options.map((o) => o.id);
    const allSelected = itemIds.every((id) => next.has(id));

    if (allSelected) {
      itemIds.forEach((id) => next.delete(id));
    } else {
      itemIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  const isItemSelected = (item: PreviewItem) => {
    return item.tracking_options.some((opt) => selectedIds.has(opt.id));
  };

  // Computed stats
  const newItems = preview?.items.filter((i) => i.status === "new") ?? [];
  const existingItems = preview?.items.filter((i) => i.status === "exists") ?? [];
  const couplesCount = newItems.filter((i) => isItemSelected(i) && i.client?.is_couple).length;
  const selectedNewCount = newItems.filter((i) => isItemSelected(i)).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Import Jobs from Xero Tracking Categories
          </DialogTitle>
          <DialogDescription>
            {step === "preview" && "Review and select tracking categories to import as jobs."}
            {step === "importing" && "Importing jobs..."}
            {step === "results" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Preview */}
        {step === "preview" && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size={24} className="mr-3" />
                <span className="text-muted-foreground">Loading tracking categories from Xero...</span>
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 p-4 rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            ) : preview ? (
              <div className="flex-1 overflow-hidden flex flex-col gap-4">
                {/* Summary */}
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="outline">{preview.tracking_category}</Badge>
                  <span className="text-muted-foreground">
                    {preview.total_options} tracking options → {preview.total_jobs} unique jobs
                  </span>
                  {newItems.length > 0 && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      {newItems.length} new
                    </Badge>
                  )}
                  {existingItems.length > 0 && (
                    <Badge variant="secondary">{existingItems.length} already exist</Badge>
                  )}
                  {couplesCount > 0 && (
                    <Badge className="bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300">
                      <Heart className="h-3 w-3 mr-1" />
                      {couplesCount} couples to split
                    </Badge>
                  )}
                </div>

                {/* Select all */}
                {newItems.length > 0 && (
                  <div className="flex items-center gap-2 px-1">
                    <Checkbox
                      checked={selectedIds.size > 0 && selectedIds.size === newItems.reduce((acc, i) => acc + i.tracking_options.length, 0)}
                      onCheckedChange={toggleAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      Select all new ({newItems.length})
                    </span>
                  </div>
                )}

                {/* Items list */}
                <div className="flex-1 overflow-y-auto border rounded-md divide-y">
                  {preview.items.map((item) => (
                    <PreviewRow
                      key={item.code}
                      item={item}
                      selected={isItemSelected(item)}
                      onToggle={() => toggleItem(item)}
                    />
                  ))}
                  {preview.items.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No tracking categories found under &quot;{preview.tracking_category}&quot;
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={selectedIds.size === 0 || loading}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Import {selectedNewCount} Job{selectedNewCount !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Spinner size={32} />
            <p className="text-muted-foreground">
              Importing {selectedNewCount} job{selectedNewCount !== 1 ? "s" : ""} from Xero...
            </p>
            <p className="text-xs text-muted-foreground">
              This may take a moment. Parsing addresses, finding clients, splitting couples...
            </p>
          </div>
        )}

        {/* Step 3: Results */}
        {step === "results" && importResult && (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Import completed successfully</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Jobs Created" value={importResult.stats.created} color="green" />
                <StatCard label="Jobs Linked" value={importResult.stats.linked} color="blue" />
                <StatCard label="Clients Linked" value={importResult.stats.clients_linked} color="purple" />
                <StatCard label="Couples Split" value={importResult.stats.contacts_split} color="pink" />
              </div>

              {importResult.stats.skipped > 0 && (
                <p className="text-sm text-muted-foreground">
                  {importResult.stats.skipped} tracking option{importResult.stats.skipped !== 1 ? "s" : ""} skipped (already linked to existing jobs)
                </p>
              )}

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

function PreviewRow({
  item,
  selected,
  onToggle,
}: {
  item: PreviewItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const isNew = item.status === "new";

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 text-sm",
        isNew ? "hover:bg-accent/50 cursor-pointer" : "opacity-60 bg-muted/30"
      )}
      onClick={isNew ? onToggle : undefined}
    >
      {/* Checkbox */}
      <div className="pt-0.5">
        {isNew ? (
          <Checkbox checked={selected} onCheckedChange={onToggle} />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Job code + address */}
        <div className="flex items-center gap-2">
          {item.parsed.job_code && (
            <span className="font-mono font-medium text-xs bg-muted px-1.5 py-0.5 rounded">
              {item.parsed.job_code}
            </span>
          )}
          <span className="font-medium truncate">
            {item.parsed.title || item.tracking_options[0]?.name}
          </span>
        </div>

        {/* Tracking options (show variants) */}
        {item.tracking_options.length > 1 && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-muted-foreground">Tracking options:</span>
            {item.tracking_options.map((opt) => (
              <Badge key={opt.id} variant="outline" className="text-xs h-5">
                {opt.variant ? `${opt.variant}-` : ""}
                {opt.name.length > 40 ? opt.name.slice(0, 37) + "..." : opt.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Address details */}
        {item.parsed.suburb && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {[item.parsed.street_number, item.parsed.street_name, item.parsed.street_type].filter(Boolean).join(" ")}
            {item.parsed.suburb && `, ${item.parsed.suburb}`}
          </div>
        )}

        {/* Client info */}
        {item.client && (
          <div className="flex items-center gap-1 mt-1 text-xs">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Client:</span>
            <span>{item.client.name}</span>
            {item.client.is_couple && (
              <Badge className="h-4 text-[10px] bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                <Heart className="h-2.5 w-2.5 mr-0.5" />
                will split
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        {isNew ? (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
            New
          </Badge>
        ) : (
          <div className="text-xs text-muted-foreground text-right">
            <div>Exists</div>
            {item.existing_job && (
              <div className="font-mono">{item.existing_job.job_code}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    pink: "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800",
  };

  return (
    <div className={cn("rounded-md border p-3 text-center", colorClasses[color])}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
