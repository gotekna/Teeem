"use client";

import { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { getApiBaseUrl } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";
import {
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
  BuildingOfficeIcon,
  ArrowPathIcon,
  InboxStackIcon,
} from "@heroicons/react/24/outline";

interface InviteData {
  token: string;
  status: string;
  expires_at: string | null;
  expired: boolean;
  can_pay: boolean;
  payment_complete: boolean;
  total_monthly: number;
}

interface SubscriptionData {
  id: number;
  domain: string;
  status: string;
}

interface ContactData {
  name: string;
  email: string;
  company: string | null;
}

interface MailboxData {
  email: string;
  display_name: string | null;
  type: string;
  price: number;
}

interface PricingData {
  price_list: {
    user_mailbox: { wholesale: number; retail: number; description: string };
    shared_mailbox: { wholesale: number; retail: number; description: string };
    resource_mailbox: { wholesale: number; retail: number; description: string };
  };
  monthly_total: number;
}

interface MigrationProgress {
  id: number;
  email: string;
  status: string;
  progress: number;
  processed: number;
  total: number;
  error: string | null;
}

interface OverallProgress {
  percent: number;
  status: string;
  total_mailboxes: number;
  completed_mailboxes: number;
}

interface PortalData {
  invite: InviteData;
  subscription: SubscriptionData;
  contact: ContactData;
  mailboxes: MailboxData[];
  pricing: PricingData;
}

interface ProgressData {
  invite_status: string;
  subscription_status: string;
  migrations: MigrationProgress[];
  overall: OverallProgress;
}

type PageStatus = "loading" | "ready" | "processing" | "migrating" | "success" | "error" | "expired";

export default function MigratePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<PortalData | null>(null);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasCancelled, setWasCancelled] = useState(false);

  useEffect(() => {
    // Check for cancelled payment
    if (searchParams.get("payment") === "cancelled") {
      setWasCancelled(true);
    }

    // Check for successful payment
    if (searchParams.get("payment") === "success") {
      // Refresh data to show updated status
      fetchPortalDetails();
      return;
    }

    fetchPortalDetails();
  }, [token, searchParams]);

  // Poll for migration progress when migrating
  useEffect(() => {
    if (status !== "migrating") return;

    const interval = setInterval(() => {
      fetchProgress();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [status, token]);

  const fetchPortalDetails = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/migrate/${token}`);
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setError("This migration link was not found or has expired.");
          setStatus("expired");
        } else {
          setError(result.error || "Failed to load migration details.");
          setStatus("error");
        }
        return;
      }

      if (result.success) {
        setData(result.data);

        // Determine page status based on invite status
        const inviteStatus = result.data.invite.status;
        if (result.data.invite.expired) {
          setStatus("expired");
        } else if (inviteStatus === "completed") {
          setStatus("success");
        } else if (inviteStatus === "migrating") {
          setStatus("migrating");
          fetchProgress();
        } else if (result.data.invite.payment_complete) {
          // Payment done, ready to confirm migration
          setStatus("ready");
        } else {
          setStatus("ready");
        }
      } else {
        setError(result.error || "Failed to load migration details.");
        setStatus("error");
      }
    } catch (err) {
      console.error("Error fetching portal details:", err);
      setError("Unable to connect. Please try again later.");
      setStatus("error");
    }
  };

  const fetchProgress = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/migrate/${token}/progress`);
      const result = await response.json();

      if (result.success) {
        setProgressData(result.data);

        // Update status based on progress
        if (result.data.overall.status === "completed") {
          setStatus("success");
        } else if (result.data.overall.status === "failed") {
          setError("Migration failed. Please contact support.");
          setStatus("error");
        }
      }
    } catch (err) {
      console.error("Error fetching progress:", err);
    }
  };

  const handleSetupPayment = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/migrate/${token}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();

      if (result.success && result.data.checkout_url) {
        window.location.href = result.data.checkout_url;
      } else {
        setError(result.error || "Failed to start payment setup.");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("Error creating checkout:", err);
      setError("Unable to start payment. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleConfirmMigration = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/migrate/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();

      if (result.success) {
        setStatus("migrating");
        fetchProgress();
      } else {
        setError(result.error || "Failed to start migration.");
      }
    } catch (err) {
      console.error("Error confirming migration:", err);
      setError("Unable to start migration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
              <p className="mt-4 text-sm text-muted-foreground">Loading migration details...</p>
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
              <p className="mt-4 text-sm text-muted-foreground">Processing...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Migration in progress
  if (status === "migrating" && progressData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              <ArrowPathIcon className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <CardTitle className="text-2xl">Migration In Progress</CardTitle>
            <CardDescription>
              Your emails are being migrated to your new mailbox
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{progressData.overall.percent}%</span>
              </div>
              <Progress value={progressData.overall.percent} className="h-3" />
              <p className="text-sm text-muted-foreground text-center">
                {progressData.overall.completed_mailboxes} of {progressData.overall.total_mailboxes} mailboxes complete
              </p>
            </div>

            {/* Per-mailbox progress */}
            <div className="space-y-3">
              {progressData.migrations.map((mig) => (
                <div key={mig.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{mig.email}</span>
                    <Badge variant={mig.status === "completed" ? "default" : mig.status === "failed" ? "destructive" : "secondary"}>
                      {mig.status}
                    </Badge>
                  </div>
                  <Progress value={mig.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {mig.processed} / {mig.total} items
                  </p>
                  {mig.error && (
                    <p className="text-xs text-destructive">{mig.error}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-xs text-muted-foreground text-center">
              This page will update automatically. You can close it and come back later.
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl text-green-600 dark:text-green-400">Migration Complete!</CardTitle>
            <CardDescription>Your email has been successfully migrated</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Domain</span>
                <span className="font-medium">{data?.subscription.domain}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mailboxes</span>
                <span className="font-medium">{data?.mailboxes.length}</span>
              </div>
            </div>
            <p className="text-sm text-center text-muted-foreground">
              You will receive an email with your new mailbox login details.
            </p>
          </CardContent>
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
            <CardTitle className="text-2xl">Link Expired</CardTitle>
            <CardDescription>
              This migration link has expired. Please contact us for a new link.
            </CardDescription>
          </CardHeader>
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
            <CardTitle className="text-2xl">Error</CardTitle>
            <CardDescription>{error || "An unexpected error occurred."}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => fetchPortalDetails()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ready state - show details and payment/confirm buttons
  if (!data) return null;

  const { invite, subscription, contact, mailboxes, pricing } = data;

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
              <EnvelopeIcon className="h-3 w-3 mr-1" />
              Email Migration
            </Badge>
          </div>
          <CardTitle className="text-xl pt-4">Migrate to Professional Email</CardTitle>
          <CardDescription>
            Set up your new email hosting for {subscription.domain}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Cancelled warning */}
          {wasCancelled && (
            <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Payment was cancelled. You can try again when you're ready.
              </p>
            </div>
          )}

          {/* Payment complete notice */}
          {invite.payment_complete && (
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-green-800 dark:text-green-200">
                Payment complete! Click "Start Migration" to begin.
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
            <h3 className="text-sm font-medium text-muted-foreground">Account</h3>
            <div className="flex items-start gap-3">
              <BuildingOfficeIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{contact.name}</p>
                {contact.company && (
                  <p className="text-sm text-muted-foreground">{contact.company}</p>
                )}
                <p className="text-sm text-muted-foreground">{contact.email}</p>
              </div>
            </div>
          </div>

          {/* Mailboxes */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <InboxStackIcon className="h-4 w-4" />
              Mailboxes ({mailboxes.length})
            </h3>
            <div className="border rounded-lg divide-y dark:divide-border">
              {mailboxes.map((mb, index) => (
                <div key={index} className="p-3 flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{mb.email}</p>
                    <p className="text-muted-foreground">
                      {mb.type === "user" ? "User Mailbox" : mb.type === "shared" ? "Shared Mailbox" : "Resource"}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(mb.price)}/mo</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing summary */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Monthly Subscription</h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-lg">{formatCurrency(pricing.monthly_total)}/month</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Billed monthly. Cancel anytime.
              </p>
            </div>
          </div>

          {/* Expiry notice */}
          {invite.expires_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClockIcon className="h-4 w-4" />
              <span>This link expires on {new Date(invite.expires_at).toLocaleDateString("en-AU")}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          {invite.payment_complete ? (
            <Button
              className="w-full"
              size="lg"
              onClick={handleConfirmMigration}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Starting...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Start Migration
                </>
              )}
            </Button>
          ) : invite.can_pay ? (
            <>
              <Button
                className="w-full"
                size="lg"
                onClick={handleSetupPayment}
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
                    Set Up Payment - {formatCurrency(pricing.monthly_total)}/mo
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
              <p>Unable to process payment at this time.</p>
              <p>Please contact us for assistance.</p>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
