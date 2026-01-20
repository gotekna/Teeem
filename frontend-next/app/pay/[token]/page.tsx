"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { getApiBaseUrl } from "@/lib/api";
import {
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  CalendarIcon,
  BanknotesIcon,
  ReceiptRefundIcon,
} from "@heroicons/react/24/outline";

interface PaymentLinkData {
  token: string;
  amount: number;
  surcharge: number;
  surcharge_percentage: number;
  total: number;
  currency: string;
  status: string;
  expires_at: string | null;
}

interface InvoiceData {
  id: number;
  invoice_number: string;
  reference: string | null;
  description: string | null;
  date: string;
  due_date: string | null;
  total: number;
  amount_paid: number;
  amount_due: number;
  status: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_amount: number;
    line_amount: number;
  }>;
}

interface ContactData {
  name: string;
  company: string | null;
  email: string;
}

interface PaymentMethods {
  card: boolean;
  bank_transfer: boolean;
}

interface PaymentData {
  payment_link: PaymentLinkData;
  invoice: InvoiceData;
  contact: ContactData;
  payment_methods: PaymentMethods;
  can_pay: boolean;
}

interface SuccessData {
  status: string;
  message: string;
  invoice_number: string;
  amount: number;
  receipt_url: string | null;
}

type PageStatus = "loading" | "ready" | "processing" | "success" | "error" | "expired" | "paid";

export default function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<PaymentData | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasCancelled, setWasCancelled] = useState(false);

  useEffect(() => {
    // Check for cancelled query param
    if (searchParams.get("cancelled") === "true") {
      setWasCancelled(true);
    }

    // Check for success with session_id
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      handleSuccess(sessionId);
      return;
    }

    // Otherwise fetch payment link details
    fetchPaymentDetails();
  }, [token, searchParams]);

  const fetchPaymentDetails = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pay/${token}`);
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setError("This payment link was not found or has expired.");
          setStatus("expired");
        } else {
          setError(result.error || "Failed to load payment details.");
          setStatus("error");
        }
        return;
      }

      if (result.success) {
        setData(result.data);

        // Check payment link status
        const paymentStatus = result.data.payment_link.status;
        if (paymentStatus === "paid") {
          setStatus("paid");
        } else if (paymentStatus === "expired") {
          setStatus("expired");
        } else {
          setStatus("ready");
        }
      } else {
        setError(result.error || "Failed to load payment details.");
        setStatus("error");
      }
    } catch (err) {
      console.error("Error fetching payment details:", err);
      setError("Unable to connect to payment service. Please try again later.");
      setStatus("error");
    }
  };

  const handleSuccess = async (sessionId: string) => {
    setStatus("processing");

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pay/${token}/success?session_id=${sessionId}`);
      const result = await response.json();

      if (result.success) {
        setSuccessData(result.data);
        setStatus("success");
      } else {
        setError(result.error || "Failed to verify payment.");
        setStatus("error");
      }
    } catch (err) {
      console.error("Error verifying payment:", err);
      setError("Unable to verify payment. Please contact support if you were charged.");
      setStatus("error");
    }
  };

  const handlePayNow = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pay/${token}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const result = await response.json();

      if (result.success && result.data.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = result.data.checkout_url;
      } else {
        setError(result.error || "Failed to create checkout session.");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("Error creating checkout:", err);
      setError("Unable to start payment. Please try again.");
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = "AUD"): string => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
              <p className="mt-4 text-sm text-muted-foreground">Loading payment details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Processing state
  if (status === "processing") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
              <p className="mt-4 text-sm text-muted-foreground">Processing your payment...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (status === "success" && successData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl text-green-600 dark:text-green-400">Payment Successful!</CardTitle>
            <CardDescription>{successData.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-medium">{successData.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium">{formatCurrency(successData.amount)}</span>
              </div>
            </div>
            {successData.receipt_url && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(successData.receipt_url!, "_blank")}
              >
                <ReceiptRefundIcon className="h-4 w-4 mr-2" />
                View Receipt
              </Button>
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-xs text-muted-foreground text-center">
              A receipt has been sent to your email address.
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Already paid state
  if (status === "paid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Invoice Already Paid</CardTitle>
            <CardDescription>This invoice has already been paid. Thank you!</CardDescription>
          </CardHeader>
          {data && (
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-medium">{data.invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{formatCurrency(data.invoice.total)}</span>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  // Expired state
  if (status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
              <ClockIcon className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
            </div>
            <CardTitle className="text-2xl">Payment Link Expired</CardTitle>
            <CardDescription>
              This payment link has expired. Please contact us for a new link.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <XCircleIcon className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-2xl">Payment Error</CardTitle>
            <CardDescription>{error || "An unexpected error occurred."}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => fetchPaymentDetails()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ready state - show payment form
  if (!data) return null;

  const { payment_link, invoice, contact, payment_methods, can_pay } = data;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold rounded">
                t
              </div>
              <span className="font-semibold">Teeem</span>
            </div>
            <Badge variant="outline" className="text-xs">
              <DocumentTextIcon className="h-3 w-3 mr-1" />
              {invoice.invoice_number}
            </Badge>
          </div>
          <CardTitle className="text-xl pt-4">Pay Invoice</CardTitle>
          <CardDescription>
            {invoice.description || `Payment for invoice ${invoice.invoice_number}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Cancelled warning */}
          {wasCancelled && (
            <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Your payment was cancelled. You can try again when you're ready.
              </p>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Contact info */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Bill To</h3>
            <div className="flex items-start gap-3">
              <BuildingOfficeIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{contact.name}</p>
                {contact.company && (
                  <p className="text-sm text-muted-foreground">{contact.company}</p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <EnvelopeIcon className="h-3 w-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{contact.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice details */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Invoice Details</h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Invoice Date</span>
                </div>
                <span>{formatDate(invoice.date)}</span>
              </div>
              {invoice.due_date && (
                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Due Date</span>
                  </div>
                  <span>{formatDate(invoice.due_date)}</span>
                </div>
              )}
              {invoice.reference && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reference</span>
                  <span>{invoice.reference}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line items (if available) */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Items</h3>
              <div className="border rounded-lg divide-y dark:divide-border">
                {invoice.line_items.map((item, index) => (
                  <div key={index} className="p-3 flex justify-between text-sm">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-muted-foreground">
                        {item.quantity} x {formatCurrency(item.unit_amount)}
                      </p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.line_amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment summary */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Payment Summary</h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice Total</span>
                <span>{formatCurrency(invoice.total, payment_link.currency)}</span>
              </div>
              {invoice.amount_paid > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="text-green-600 dark:text-green-400">-{formatCurrency(invoice.amount_paid, payment_link.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Due</span>
                <span>{formatCurrency(payment_link.amount, payment_link.currency)}</span>
              </div>
              {payment_link.surcharge > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Card Processing Fee ({payment_link.surcharge_percentage}%)
                  </span>
                  <span>{formatCurrency(payment_link.surcharge, payment_link.currency)}</span>
                </div>
              )}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span>Total to Pay</span>
                  <span className="text-lg">{formatCurrency(payment_link.total, payment_link.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Expiry warning */}
          {payment_link.expires_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClockIcon className="h-4 w-4" />
              <span>This link expires on {formatDate(payment_link.expires_at)}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          {can_pay ? (
            <>
              <Button
                className="w-full"
                size="lg"
                onClick={handlePayNow}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCardIcon className="h-5 w-5 mr-2" />
                    Pay {formatCurrency(payment_link.total, payment_link.currency)}
                  </>
                )}
              </Button>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <svg className="h-4 w-4" viewBox="0 0 32 32" fill="none">
                    <rect width="32" height="32" rx="4" fill="#635BFF"/>
                    <path d="M14.6 13.5c0-.7.6-1 1.5-1 1.3 0 2.9.4 4.2 1.1V9.8c-1.4-.6-2.8-.8-4.2-.8-3.4 0-5.7 1.8-5.7 4.8 0 4.7 6.5 3.9 6.5 6 0 .8-.7 1.1-1.7 1.1-1.5 0-3.4-.6-4.9-1.4v3.8c1.7.7 3.3 1 4.9 1 3.5 0 5.9-1.7 5.9-4.8-.1-5-6.5-4.2-6.5-6z" fill="#fff"/>
                  </svg>
                  <span>Powered by Stripe</span>
                </div>
                <span>|</span>
                <span>Secure Payment</span>
              </div>
            </>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <p>This invoice cannot be paid online at this time.</p>
              <p>Please contact us for assistance.</p>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
