"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  User,
  X,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface QualityReview {
  id: number;
  contact_id: number;
  contact: {
    id: number;
    display_name: string;
    email: string | null;
    entity_type: string;
    abn: string | null;
  };
  suggested_company: {
    id: number;
    display_name: string;
    email: string | null;
    entity_type: string;
  } | null;
  issue_type: string;
  issue_type_label: string;
  status: string;
  recommended_action: string;
  recommended_action_label: string;
  confidence_score: number;
  email_domain: string | null;
  derived_company_name: string | null;
  abr_data: Record<string, unknown> | null;
  analysis_data: Record<string, unknown>;
  review_notes: string | null;
  reviewed_by_id: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface QualityReviewsResponse {
  success: boolean;
  data: QualityReview[];
  total_count: number;
  page: number;
  per_page: number;
  by_issue_type: Record<string, number>;
  by_status: Record<string, number>;
}

interface ScanResponse {
  success: boolean;
  message: string;
  results: {
    scanned: number;
    issues_found: number;
    by_issue_type: Record<string, number>;
  };
}

const ISSUE_TYPE_COLORS: Record<string, string> = {
  misclassified_person: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  misclassified_company: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  abn_mismatch: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  needs_company_link: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  multiple_xero_links: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  admin_email_pattern: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  convert_to_company: <Building2 className="h-4 w-4" />,
  convert_to_person: <User className="h-4 w-4" />,
  link_to_existing_company: <ChevronRight className="h-4 w-4" />,
  create_new_company_and_link: <Zap className="h-4 w-4" />,
  no_action: <Check className="h-4 w-4" />,
};

function ConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      : score >= 50
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
        : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";

  return <Badge className={cn("font-mono", color)}>{score}%</Badge>;
}

function ReviewCard({
  review,
  onApprove,
  onReject,
  onSkip,
  isProcessing,
}: {
  review: QualityReview;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onSkip: (id: number) => void;
  isProcessing: boolean;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Contact Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href={`/contacts/${review.contact.id}`}
                className="font-medium hover:underline truncate"
              >
                {review.contact.display_name}
              </Link>
              <Badge variant="outline" className="text-xs">
                {review.contact.entity_type}
              </Badge>
              <ConfidenceBadge score={review.confidence_score} />
            </div>

            <p className="text-sm text-muted-foreground truncate">{review.contact.email || "No email"}</p>

            {review.contact.abn && (
              <p className="text-xs text-muted-foreground mt-1">
                ABN: {review.contact.abn}
              </p>
            )}
          </div>

          {/* Middle: Issue & Action */}
          <div className="flex-shrink-0 text-right">
            <Badge className={cn("mb-2", ISSUE_TYPE_COLORS[review.issue_type] || "")}>
              {review.issue_type_label}
            </Badge>

            <div className="flex items-center gap-1 text-sm text-muted-foreground justify-end">
              {ACTION_ICONS[review.recommended_action]}
              <span>{review.recommended_action_label}</span>
            </div>

            {review.suggested_company && (
              <p className="text-xs text-muted-foreground mt-1">
                → {review.suggested_company.display_name}
              </p>
            )}

            {review.derived_company_name && !review.suggested_company && (
              <p className="text-xs text-muted-foreground mt-1">
                Create: {review.derived_company_name}
              </p>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="default"
              onClick={() => onApprove(review.id)}
              disabled={isProcessing}
              className="w-20"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {isProcessing ? "" : "Fix"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSkip(review.id)}
              disabled={isProcessing}
              className="w-20"
            >
              Skip
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReject(review.id)}
              disabled={isProcessing}
              className="w-20 text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4 mr-1" />
              Wrong
            </Button>
          </div>
        </div>

        {/* ABR Data Preview */}
        {review.abr_data && (
          <div className="mt-3 pt-3 border-t text-xs">
            <span className="text-muted-foreground">ABR: </span>
            <span className="font-medium">
              {String(review.abr_data.entity_name || "")}
            </span>
            {Boolean(review.abr_data.entity_type_description) && (
              <span className="text-muted-foreground"> ({String(review.abr_data.entity_type_description)})</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ContactQualityReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");

  const [reviews, setReviews] = React.useState<QualityReview[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<number | null>(null);
  const [stats, setStats] = React.useState<{
    by_issue_type: Record<string, number>;
    by_status: Record<string, number>;
    total_count: number;
  } | null>(null);
  const activeTab = filterParam || "all";

  const handleTabChange = React.useCallback((tabId: string) => {
    const url = tabId === "all" ? "/contacts/quality-review" : `/contacts/quality-review?filter=${tabId}`;
    router.push(url, { scroll: false });
  }, [router]);

  const fetchReviews = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", "pending");
      if (activeTab !== "all") {
        params.set("issue_type", activeTab);
      }

      const data = await api.get<QualityReviewsResponse>(
        `/api/v1/contacts/quality_reviews?${params.toString()}`
      );

      setReviews(data.data);
      setStats({
        by_issue_type: data.by_issue_type,
        by_status: data.by_status,
        total_count: data.total_count,
      });
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  React.useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await api.post<ScanResponse>("/api/v1/contacts/quality_scan", {});
      console.log("Scan result:", result);
      await fetchReviews();
    } catch (error) {
      console.error("Scan failed:", error);
    } finally {
      setScanning(false);
    }
  };

  const handleApprove = async (reviewId: number) => {
    setProcessingId(reviewId);
    try {
      await api.post(`/api/v1/contact_quality_reviews/${reviewId}/approve`, {});
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      if (stats) {
        setStats({
          ...stats,
          total_count: stats.total_count - 1,
        });
      }
    } catch (error) {
      console.error("Approve failed:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (reviewId: number) => {
    setProcessingId(reviewId);
    try {
      await api.post(`/api/v1/contact_quality_reviews/${reviewId}/reject`, {});
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      if (stats) {
        setStats({
          ...stats,
          total_count: stats.total_count - 1,
        });
      }
    } catch (error) {
      console.error("Reject failed:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSkip = async (reviewId: number) => {
    setProcessingId(reviewId);
    try {
      await api.post(`/api/v1/contact_quality_reviews/${reviewId}/skip`, {});
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      if (stats) {
        setStats({
          ...stats,
          total_count: stats.total_count - 1,
        });
      }
    } catch (error) {
      console.error("Skip failed:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApprove = async () => {
    const highConfidenceReviews = reviews.filter((r) => r.confidence_score >= 80);
    if (highConfidenceReviews.length === 0) return;

    if (!confirm(`Approve ${highConfidenceReviews.length} high-confidence reviews?`)) {
      return;
    }

    setProcessingId(-1); // Indicate bulk processing
    try {
      await api.post("/api/v1/contact_quality_reviews/bulk_approve", {
        review_ids: highConfidenceReviews.map((r) => r.id),
        min_confidence: 80,
      });
      await fetchReviews();
    } catch (error) {
      console.error("Bulk approve failed:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = stats?.by_status?.pending || 0;
  const highConfidenceCount = reviews.filter((r) => r.confidence_score >= 80).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif flex items-center gap-2">
              <Search className="h-6 w-6 text-indigo-500" />
              Contact Quality Review
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and fix data quality issues in your contacts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {highConfidenceCount > 0 && (
            <Button
              variant="default"
              onClick={handleBulkApprove}
              disabled={processingId !== null}
            >
              <Zap className="h-4 w-4 mr-2" />
              Fix {highConfidenceCount} High-Confidence
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleScan}
            disabled={scanning}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", scanning && "animate-spin")} />
            {scanning ? "Scanning..." : "Scan for Issues"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Reviews</CardDescription>
            <CardTitle className="text-3xl font-mono">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High Confidence (80%+)</CardDescription>
            <CardTitle className="text-3xl font-mono text-green-600">
              {highConfidenceCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-3xl font-mono text-blue-600">
              {stats?.by_status?.approved || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rejected</CardDescription>
            <CardTitle className="text-3xl font-mono text-gray-500">
              {stats?.by_status?.rejected || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs by Issue Type */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">
            All ({pendingCount})
          </TabsTrigger>
          {stats?.by_issue_type &&
            Object.entries(stats.by_issue_type)
              .filter(([, count]) => count > 0)
              .map(([type, count]) => (
                <TabsTrigger key={type} value={type}>
                  {type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} ({count})
                </TabsTrigger>
              ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-lg">No pending reviews</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click &quot;Scan for Issues&quot; to detect new quality issues
                </p>
                <Button variant="outline" className="mt-4" onClick={handleScan} disabled={scanning}>
                  <RefreshCw className={cn("h-4 w-4 mr-2", scanning && "animate-spin")} />
                  Scan Now
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onSkip={handleSkip}
                  isProcessing={processingId === review.id || processingId === -1}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
