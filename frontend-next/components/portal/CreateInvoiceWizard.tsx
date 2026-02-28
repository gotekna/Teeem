"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DocumentArrowUpIcon,
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  DocumentIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/utils/formatters";
import { portalApi } from "@/lib/portal-api";
import { MAX_UPLOAD_SIZE } from "@/lib/constants/file-size-limits";

interface PurchaseOrderResult {
  id: number;
  po_number: string;
  job_name: string;
  job_code: string;
  total: number;
  already_invoiced: number;
  remaining_amount: number;
  payment_terms_days: number;
  status: string;
}

interface CreateInvoiceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const STEPS = [
  { label: "Upload", icon: DocumentArrowUpIcon },
  { label: "Select PO", icon: MagnifyingGlassIcon },
  { label: "Amount", icon: CurrencyDollarIcon },
  { label: "Completion", icon: ClipboardDocumentCheckIcon },
  { label: "Review", icon: CheckCircleIcon },
];

export default function CreateInvoiceWizard({
  isOpen,
  onClose,
  onSuccess,
}: CreateInvoiceWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Upload
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: PO Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PurchaseOrderResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderResult | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Step 3: Amount
  const [amount, setAmount] = useState("");

  // Step 4: Completion
  const [isFullCompletion, setIsFullCompletion] = useState(true);
  const [completionPercentage, setCompletionPercentage] = useState(80);
  const [remainingWorkDescription, setRemainingWorkDescription] = useState("");

  // Error state
  const [error, setError] = useState("");

  // Reset when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setInvoiceFile(null);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedPO(null);
      setAmount("");
      setIsFullCompletion(true);
      setCompletionPercentage(80);
      setRemainingWorkDescription("");
      setError("");
      setSubmitting(false);
    }
  }, [isOpen]);

  // Load initial PO list when reaching step 2
  useEffect(() => {
    if (step === 1 && searchResults.length === 0 && !selectedPO) {
      searchPurchaseOrders("");
    }
  }, [step]);

  // Debounced PO search
  const searchPurchaseOrders = useCallback(async (query: string) => {
    setSearching(true);
    try {
      const response = await portalApi.get(
        "/api/v1/portal/invoices/search_purchase_orders",
        { params: { q: query } }
      );
      if (response?.data.success) {
        setSearchResults(response.data.data);
      }
    } catch (err) {
      console.error("Failed to search POs:", err);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchPurchaseOrders(value);
    }, 300);
  };

  // File handling
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const validateAndSetFile = (file: File) => {
    if (file.size > MAX_UPLOAD_SIZE) {
      setError("File size must be less than 10MB");
      return;
    }
    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      setError("Only PDF and image files are accepted");
      return;
    }
    setError("");
    setInvoiceFile(file);
  };

  // Navigation
  const canProceed = (): boolean => {
    switch (step) {
      case 0: return invoiceFile !== null;
      case 1: return selectedPO !== null;
      case 2: {
        const amt = parseFloat(amount);
        return !isNaN(amt) && amt > 0 && amt <= (selectedPO?.remaining_amount || 0);
      }
      case 3: {
        if (isFullCompletion) return true;
        return completionPercentage >= 1 && completionPercentage < 100 && remainingWorkDescription.trim().length > 0;
      }
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1 && canProceed()) {
      setError("");
      // Pre-fill amount when moving to step 3
      if (step === 1 && selectedPO && !amount) {
        setAmount(selectedPO.remaining_amount.toFixed(2));
      }
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setError("");
      setStep(step - 1);
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (!selectedPO) return;
    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("purchase_order_id", selectedPO.id.toString());
      formData.append("amount", amount);
      formData.append("completion_percentage", isFullCompletion ? "100" : completionPercentage.toString());

      if (!isFullCompletion && remainingWorkDescription.trim()) {
        formData.append("remaining_work_description", remainingWorkDescription.trim());
      }

      if (invoiceFile) {
        formData.append("invoice_file", invoiceFile);
      }

      const response = await portalApi.post(
        "/api/v1/portal/invoices",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (response?.data.success) {
        toast({
          title: "Invoice Created",
          description: response.data.data?.sm_task_created
            ? "Invoice submitted. A task has been created for the supervisor to verify remaining work."
            : "Invoice submitted successfully.",
        });
        onSuccess();
      } else {
        setError(response.data.error || "Failed to create invoice");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.errors?.join(", ") || "Failed to create invoice";
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedDueDate = () => {
    if (!selectedPO) return "";
    const days = selectedPO.payment_terms_days;
    const due = new Date();
    due.setDate(due.getDate() + days);
    return due.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>

        {/* Step Indicators */}
        <div className="flex items-center justify-between px-2 mb-6">
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isComplete = i < step;
            return (
              <div key={s.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                      ${isActive ? "bg-indigo-600 text-white" : ""}
                      ${isComplete ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400" : ""}
                      ${!isActive && !isComplete ? "bg-muted text-muted-foreground" : ""}
                    `}
                  >
                    {isComplete ? (
                      <CheckCircleIcon className="w-5 h-5" />
                    ) : (
                      <s.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? "text-indigo-600 dark:text-indigo-400 font-medium" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-full mx-1 mt-[-16px] ${i < step ? "bg-indigo-400" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[280px]">
          {/* Step 1: Upload */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload your invoice PDF or image to proceed.
              </p>
              <div
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                  ${dragOver ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-border hover:border-indigo-400"}
                `}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {invoiceFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <DocumentIcon className="h-10 w-10 text-indigo-500" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{invoiceFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(invoiceFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInvoiceFile(null);
                      }}
                      className="ml-4 p-1 rounded-full hover:bg-muted"
                    >
                      <XMarkIcon className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium text-foreground">
                      Drop your invoice file here
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      or click to browse — PDF or image, max 10MB
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileSelect}
                  className="sr-only"
                />
              </div>
            </div>
          )}

          {/* Step 2: Select PO */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by PO number or job name..."
                  className="w-full pl-10 pr-4 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {searching ? (
                <div className="flex justify-center py-8">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No purchase orders found.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {searchResults.map((po) => {
                    const isSelected = selectedPO?.id === po.id;
                    const hasRemaining = po.remaining_amount > 0;
                    return (
                      <button
                        key={po.id}
                        type="button"
                        disabled={!hasRemaining}
                        onClick={() => setSelectedPO(po)}
                        className={`
                          w-full text-left p-3 rounded-lg border transition-colors
                          ${isSelected ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-border hover:border-indigo-300 dark:hover:border-indigo-700"}
                          ${!hasRemaining ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{po.po_number}</p>
                            <p className="text-xs text-muted-foreground">{po.job_code} — {po.job_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">{formatCurrency(po.remaining_amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              of {formatCurrency(po.total)} remaining
                            </p>
                          </div>
                        </div>
                        {po.already_invoiced > 0 && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                            {formatCurrency(po.already_invoiced)} already invoiced
                          </p>
                        )}
                        {!hasRemaining && (
                          <p className="text-xs text-red-500 mt-1">Fully invoiced</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Amount */}
          {step === 2 && selectedPO && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Invoice Amount
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-muted-foreground text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedPO.remaining_amount}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="block w-full rounded-md border border-border pl-7 pr-4 py-2.5 text-lg font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-background text-foreground"
                    placeholder="0.00"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Maximum: {formatCurrency(selectedPO.remaining_amount)}
                </p>
                {parseFloat(amount) > selectedPO.remaining_amount && (
                  <p className="mt-1 text-xs text-red-500">
                    Amount exceeds remaining PO balance
                  </p>
                )}
              </div>

              {/* Payment Terms Info */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CurrencyDollarIcon className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                      Payment Terms: {selectedPO.payment_terms_days} days
                    </p>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-0.5">
                      Estimated payment by {estimatedDueDate()}
                    </p>
                  </div>
                </div>
              </div>

              {/* PO Summary */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">PO Total</p>
                    <p className="font-semibold text-foreground">{formatCurrency(selectedPO.total)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Already Invoiced</p>
                    <p className="font-semibold text-foreground">{formatCurrency(selectedPO.already_invoiced)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">This Invoice</p>
                    <p className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(parseFloat(amount) || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Completion */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Has the work for this purchase order been fully completed?
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setIsFullCompletion(true)}
                  className={`
                    w-full text-left p-4 rounded-lg border-2 transition-colors
                    ${isFullCompletion ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-border hover:border-indigo-300"}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isFullCompletion ? "border-indigo-500" : "border-border"}`}>
                      {isFullCompletion && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Yes, 100% complete</p>
                      <p className="text-xs text-muted-foreground">All work has been finished</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFullCompletion(false)}
                  className={`
                    w-full text-left p-4 rounded-lg border-2 transition-colors
                    ${!isFullCompletion ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-border hover:border-indigo-300"}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!isFullCompletion ? "border-indigo-500" : "border-border"}`}>
                      {!isFullCompletion && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Partially complete</p>
                      <p className="text-xs text-muted-foreground">Some work remains to be done</p>
                    </div>
                  </div>
                </button>
              </div>

              {!isFullCompletion && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Completion: {completionPercentage}%
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="99"
                      value={completionPercentage}
                      onChange={(e) => setCompletionPercentage(parseInt(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>1%</span>
                      <span>99%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      What work remains? <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={remainingWorkDescription}
                      onChange={(e) => setRemainingWorkDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-border p-2 text-sm bg-background text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      placeholder="Describe the remaining work to be completed..."
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      A task will be created for the supervisor to verify the remaining work (photo required).
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {step === 4 && selectedPO && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Review your invoice details before submitting.
              </p>

              <div className="bg-muted/50 rounded-lg divide-y divide-border">
                {invoiceFile && (
                  <div className="flex items-center justify-between p-3">
                    <span className="text-sm text-muted-foreground">Invoice File</span>
                    <span className="text-sm font-medium text-foreground">{invoiceFile.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Purchase Order</span>
                  <span className="text-sm font-medium text-foreground">{selectedPO.po_number}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Job</span>
                  <span className="text-sm font-medium text-foreground">{selectedPO.job_code} — {selectedPO.job_name}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Invoice Amount</span>
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(parseFloat(amount) || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Payment Terms</span>
                  <span className="text-sm font-medium text-foreground">
                    {selectedPO.payment_terms_days} days (est. {estimatedDueDate()})
                  </span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Completion</span>
                  <span className="text-sm font-medium text-foreground">
                    {isFullCompletion ? "100%" : `${completionPercentage}%`}
                  </span>
                </div>
                {!isFullCompletion && remainingWorkDescription && (
                  <div className="p-3">
                    <span className="text-sm text-muted-foreground block mb-1">Remaining Work</span>
                    <p className="text-sm text-foreground">{remainingWorkDescription}</p>
                  </div>
                )}
              </div>

              {!isFullCompletion && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    A supervisor task will be created for the remaining work. Photo verification will be required.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <button
            type="button"
            onClick={step === 0 ? onClose : handleBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-muted"
          >
            {step === 0 ? (
              "Cancel"
            ) : (
              <>
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </>
            )}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Submitting...
                </>
              ) : (
                "Submit Invoice"
              )}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
