"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  XCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  BanknotesIcon,
  CalendarIcon,
  DocumentTextIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";

interface PurchaseOrder {
  construction_name?: string;
}

interface Payment {
  amount: number;
  payment_date: string;
  reference_number: string;
}

interface PayNowRequest {
  id: number;
  purchase_order_number: string;
  status: string;
  status_display: string;
  original_amount: string;
  discount_percentage: number;
  discount_amount: string;
  discounted_amount: string;
  requested_at: string;
  reviewed_at?: string;
  paid_at?: string;
  reviewed_by?: string;
  supervisor_notes?: string;
  supplier_notes?: string;
  rejection_reason?: string;
  invoice_file_url?: string;
  proof_photos?: string[];
  purchase_order?: PurchaseOrder;
  payment?: Payment;
}

interface PayNowRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: PayNowRequest | null;
}

export default function PayNowRequestDetailModal({
  isOpen,
  onClose,
  request,
}: PayNowRequestDetailModalProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <ClockIcon className="h-6 w-6 text-yellow-500 dark:text-yellow-400" />;
      case "approved":
      case "paid":
        return <CheckCircleIcon className="h-6 w-6 text-green-500 dark:text-green-400" />;
      case "rejected":
      case "cancelled":
        return <XCircleIcon className="h-6 w-6 text-red-500 dark:text-red-400" />;
      default:
        return <ClockIcon className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      pending: "bg-status-warning text-status-warning-foreground",
      approved: "bg-status-success text-status-success-foreground",
      paid: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
      rejected: "bg-status-error text-status-error-foreground",
      cancelled: "bg-muted text-foreground",
    };
    return classes[status] || "bg-muted text-foreground";
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: string | number): string => {
    if (typeof amount === "string" && amount.startsWith("$")) {
      return amount;
    }
    return `$${Number(amount).toLocaleString("en-AU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              {getStatusIcon(request.status)}
            </div>
            <div>
              <DialogTitle>Payment Request Details</DialogTitle>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium ${getStatusBadgeClass(
                    request.status
                  )}`}
                >
                  {request.status_display}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-6">
          {/* Purchase Order Info */}
          <div className="bg-muted rounded-lg p-4">
            <h4 className="text-sm font-medium text-foreground mb-3">
              Purchase Order
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">PO Number:</span>
                <span className="font-medium text-foreground">
                  {request.purchase_order_number}
                </span>
              </div>
              {request.purchase_order?.construction_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Job:</span>
                  <span className="font-medium text-foreground">
                    {request.purchase_order.construction_name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Financial Details */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-indigo-900 dark:text-indigo-300 mb-3 flex items-center">
              <BanknotesIcon className="h-5 w-5 mr-2" />
              Financial Details
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">Original Amount</p>
                <p className="text-lg font-semibold text-foreground">
                  {request.original_amount}
                </p>
              </div>
              <div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  Discount ({request.discount_percentage}%)
                </p>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                  -{request.discount_amount}
                </p>
              </div>
              <div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">Final Payment</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {request.discounted_amount}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-800">
              <p className="text-xs text-indigo-600 dark:text-indigo-400">Your Savings</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {request.discount_amount}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              Timeline
            </h4>
            <div className="flow-root">
              <ul className="-mb-8">
                {/* Requested */}
                <li>
                  <div className="relative pb-8">
                    <span
                      className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-muted"
                      aria-hidden="true"
                    />
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-background">
                          <ClockIcon className="h-5 w-5 text-white" />
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Request Submitted
                          </p>
                        </div>
                        <div className="whitespace-nowrap text-right text-sm text-muted-foreground">
                          {formatDate(request.requested_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>

                {/* Reviewed */}
                {request.reviewed_at && (
                  <li>
                    <div className="relative pb-8">
                      <span
                        className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-muted"
                        aria-hidden="true"
                      />
                      <div className="relative flex space-x-3">
                        <div>
                          <span
                            className={`h-8 w-8 rounded-full ${
                              request.status === "rejected"
                                ? "bg-red-500"
                                : "bg-green-500"
                            } flex items-center justify-center ring-8 ring-background`}
                          >
                            {request.status === "rejected" ? (
                              <XCircleIcon className="h-5 w-5 text-white" />
                            ) : (
                              <CheckCircleIcon className="h-5 w-5 text-white" />
                            )}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {request.status === "rejected"
                                ? "Rejected"
                                : "Approved"}{" "}
                              by {request.reviewed_by || "Supervisor"}
                            </p>
                            {request.supervisor_notes && (
                              <p className="mt-1 text-sm text-foreground">
                                {request.supervisor_notes}
                              </p>
                            )}
                          </div>
                          <div className="whitespace-nowrap text-right text-sm text-muted-foreground">
                            {formatDate(request.reviewed_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                )}

                {/* Paid */}
                {request.paid_at && (
                  <li>
                    <div className="relative pb-8">
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-background">
                            <BanknotesIcon className="h-5 w-5 text-white" />
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Payment Processed
                            </p>
                            {request.payment?.reference_number && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Ref: {request.payment.reference_number}
                              </p>
                            )}
                          </div>
                          <div className="whitespace-nowrap text-right text-sm text-muted-foreground">
                            {formatDate(request.paid_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Rejection Reason */}
          {request.rejection_reason && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-900 dark:text-red-300 mb-2">
                Rejection Reason
              </h4>
              <p className="text-sm text-red-800 dark:text-red-400">
                {request.rejection_reason}
              </p>
            </div>
          )}

          {/* Supplier Notes */}
          {request.supplier_notes && (
            <div className="bg-muted rounded-lg p-4">
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                Your Notes
              </h4>
              <p className="text-sm text-foreground">
                {request.supplier_notes}
              </p>
            </div>
          )}

          {/* Attachments */}
          {(request.invoice_file_url ||
            (request.proof_photos && request.proof_photos.length > 0)) && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center">
                <PhotoIcon className="h-5 w-5 mr-2" />
                Attachments
              </h4>

              {request.invoice_file_url && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">Invoice File</p>
                  <a
                    href={request.invoice_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <DocumentTextIcon className="h-4 w-4 mr-1" />
                    View Invoice
                  </a>
                </div>
              )}

              {request.proof_photos && request.proof_photos.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Proof of Completion ({request.proof_photos.length} photos)
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {request.proof_photos.map((photo, index) => (
                      <a
                        key={index}
                        href={photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-75 transition"
                      >
                        <img
                          src={photo}
                          alt={`Proof ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Details */}
          {request.payment && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-900 dark:text-green-300 mb-3">
                Payment Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700 dark:text-green-400">Amount Paid:</span>
                  <span className="font-medium text-green-900 dark:text-green-300">
                    {formatCurrency(request.payment.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700 dark:text-green-400">Payment Date:</span>
                  <span className="font-medium text-green-900 dark:text-green-300">
                    {formatDate(request.payment.payment_date)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700 dark:text-green-400">Reference:</span>
                  <span className="font-medium text-green-900 dark:text-green-300">
                    {request.payment.reference_number}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-2">
          <button
            type="button"
            className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
