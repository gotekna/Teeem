"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/utils/formatters";
import { portalApi } from "@/lib/portal-api";
import { MAX_UPLOAD_SIZE } from "@/lib/constants/file-size-limits";

interface PurchaseOrder {
  id: number;
  purchase_order_number: string;
  construction_name: string;
  remaining_amount: number;
}

interface RequestPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  amount: string;
  discount_percentage: number;
  notes: string;
  requested_payment_date: string;
}

export default function RequestPaymentModal({
  isOpen,
  onClose,
  onSuccess,
}: RequestPaymentModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingPOs, setLoadingPOs] = useState(true);
  const [eligiblePOs, setEligiblePOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [formData, setFormData] = useState<FormData>({
    amount: "",
    discount_percentage: 5.0,
    notes: "",
    requested_payment_date: new Date().toISOString().split("T")[0],
  });
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [proofPhotos, setProofPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      loadEligiblePOs();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedPO) {
      setFormData((prev) => ({
        ...prev,
        amount: selectedPO.remaining_amount.toString(),
      }));
    }
  }, [selectedPO]);

  const loadEligiblePOs = async () => {
    try {
      const response = await portalApi.get(
        "/api/v1/portal/pay_now_requests/eligible_purchase_orders"
      );

      if (response?.data.success) {
        setEligiblePOs(response.data.data);
        if (response?.data.data.length > 0) {
          setSelectedPO(response.data.data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load eligible purchase orders:", error);
    } finally {
      setLoadingPOs(false);
    }
  };

  const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_UPLOAD_SIZE) {
        setErrors((prev) => ({
          ...prev,
          invoice_file: "File size must be less than 10MB",
        }));
        return;
      }
      setInvoiceFile(file);
      setErrors((prev) => ({ ...prev, invoice_file: "" }));
    }
  };

  const handleProofPhotosChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];

    if (files.length > 10) {
      setErrors((prev) => ({
        ...prev,
        proof_photos: "Maximum 10 photos allowed",
      }));
      return;
    }

    const oversizedFiles = files.filter((f) => f.size > MAX_UPLOAD_SIZE);
    if (oversizedFiles.length > 0) {
      setErrors((prev) => ({
        ...prev,
        proof_photos: "Each file must be less than 10MB",
      }));
      return;
    }

    setProofPhotos(files);
    setErrors((prev) => ({ ...prev, proof_photos: "" }));
  };

  const calculateDiscountAmount = () => {
    const amount = parseFloat(formData.amount) || 0;
    const percentage = parseFloat(formData.discount_percentage.toString()) || 0;
    return (amount * (percentage / 100)).toFixed(2);
  };

  const calculateDiscountedAmount = () => {
    const amount = parseFloat(formData.amount) || 0;
    const discount = parseFloat(calculateDiscountAmount()) || 0;
    return (amount - discount).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPO) {
      setErrors({ general: "Please select a purchase order" });
      return;
    }

    if (proofPhotos.length === 0) {
      setErrors({
        proof_photos: "At least one proof of completion photo is required",
      });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const submitData = new FormData();
      submitData.append("purchase_order_id", selectedPO.id.toString());
      submitData.append("amount", formData.amount);
      submitData.append(
        "discount_percentage",
        formData.discount_percentage.toString()
      );
      submitData.append("notes", formData.notes);
      submitData.append("requested_payment_date", formData.requested_payment_date);

      if (invoiceFile) {
        submitData.append("invoice_file", invoiceFile);
      }

      proofPhotos.forEach((photo) => {
        submitData.append("proof_photos[]", photo);
      });

      const response = await portalApi.post(
        "/api/v1/portal/pay_now_requests",
        submitData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response?.data.success) {
        toast({ title: "Success", description: response.data.message || "Payment request submitted successfully" });
        onSuccess();
      } else {
        setErrors({ general: response.data.error || "Failed to submit request" });
      }
    } catch (error: any) {
      console.error("Failed to submit payment request:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to submit payment request";
      const validationErrors = error.response?.data?.errors || [];

      if (validationErrors.length > 0) {
        setErrors({ general: validationErrors.join(", ") });
      } else {
        setErrors({ general: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader>
          <DialogTitle>Request Early Payment</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Get paid early with a 5% discount
          </p>
        </DialogHeader>

        {loadingPOs ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : eligiblePOs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              No eligible purchase orders found.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Purchase orders must be completed and not fully paid to be
              eligible.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Purchase Order Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Purchase Order
              </label>
              <Select
                value={selectedPO?.id.toString() || ""}
                onValueChange={(value) => {
                  const po = eligiblePOs.find((p) => p.id.toString() === value);
                  if (po) setSelectedPO(po);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a purchase order" />
                </SelectTrigger>
                <SelectContent>
                  {eligiblePOs.map((po) => (
                    <SelectItem key={po.id} value={po.id.toString()}>
                      PO #{po.purchase_order_number} - {po.construction_name} ({formatCurrency(po.remaining_amount)} remaining)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-foreground">
                Request Amount
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-muted-foreground sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="block w-full rounded-md border border-border pl-7 pr-12 py-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-background text-foreground"
                  placeholder="0.00"
                  required
                />
              </div>
              {selectedPO && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Maximum available:{" "}
                  {formatCurrency(selectedPO.remaining_amount)}
                </p>
              )}
            </div>

            {/* Discount Preview */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md p-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Original Amount</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(parseFloat(formData.amount) || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Discount (5%)</p>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                    -{formatCurrency(parseFloat(calculateDiscountAmount()))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">You&apos;ll Receive</p>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(parseFloat(calculateDiscountedAmount()))}
                  </p>
                </div>
              </div>
            </div>

            {/* Proof Photos */}
            <div>
              <label className="block text-sm font-medium text-foreground">
                Proof of Completion Photos{" "}
                <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-border border-dashed rounded-md hover:border-indigo-500">
                <div className="space-y-1 text-center">
                  <PhotoIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                  <div className="flex text-sm text-muted-foreground">
                    <label className="relative cursor-pointer rounded-md bg-background font-medium text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:text-indigo-500">
                      <span>Upload photos</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleProofPhotosChange}
                        className="sr-only"
                        required
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, GIF up to 10MB each (max 10 photos)
                  </p>
                  {proofPhotos.length > 0 && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {proofPhotos.length} photo(s) selected
                    </p>
                  )}
                </div>
              </div>
              {errors.proof_photos && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.proof_photos}
                </p>
              )}
            </div>

            {/* Invoice File (Optional) */}
            <div>
              <label className="block text-sm font-medium text-foreground">
                Invoice (Optional)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleInvoiceFileChange}
                className="mt-1 block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {invoiceFile && (
                <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                  {invoiceFile.name}
                </p>
              )}
              {errors.invoice_file && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.invoice_file}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground">
                Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-background text-foreground p-2"
                placeholder="Any additional information..."
              />
            </div>

            {/* Error Message */}
            {errors.general && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                <p className="text-sm text-red-800 dark:text-red-400">{errors.general}</p>
              </div>
            )}

            {/* Actions */}
            <div className="sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:col-start-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Submitting..." : "Submit Request"}
              </button>
              <button
                type="button"
                className="mt-3 inline-flex w-full justify-center rounded-md bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-border hover:bg-muted sm:col-start-1 sm:mt-0"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
