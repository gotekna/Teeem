"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  Check,
  X,
  User,
  Building2,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface PendingXeroLink {
  id: number;
  contact_id: number;
  contact_name: string;
  contact_email?: string;
  contact_abn?: string;
  tenant_id: string;
  tenant_name: string;
  external_contact_id: string;
  match_type: string;
  match_confidence: number;
  match_confidence_percent: number;
  created_at: string;
}

interface PendingXeroReviewPanelProps {
  onReviewComplete?: () => void;
}

export function PendingXeroReviewPanel({ onReviewComplete }: PendingXeroReviewPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingLinks, setPendingLinks] = useState<PendingXeroLink[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    loadPendingReviews();
  }, []);

  const loadPendingReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{
        success: boolean;
        pending_count: number;
        links: PendingXeroLink[];
      }>("/api/v1/xero_links/pending_review");

      if (response?.success) {
        setPendingLinks(response.links || []);
      }
    } catch (err) {
      console.error("Failed to load pending reviews:", err);
      setError(err instanceof Error ? err.message : "Failed to load pending reviews");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (link: PendingXeroLink) => {
    setProcessingId(link.id);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/contacts/${link.contact_id}/xero_links/${link.id}/approve`
      );

      if (response?.success) {
        // Remove from local state
        setPendingLinks((prev) => prev.filter((l) => l.id !== link.id));
        onReviewComplete?.();
      }
    } catch (err) {
      console.error("Failed to approve link:", err);
      setError(err instanceof Error ? err.message : "Failed to approve link");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (link: PendingXeroLink) => {
    if (!confirm(`Reject this match? This will unlink ${link.contact_name} from ${link.tenant_name} and create a new TEEEM contact on the next sync.`)) {
      return;
    }

    setProcessingId(link.id);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/contacts/${link.contact_id}/xero_links/${link.id}/reject`
      );

      if (response?.success) {
        // Remove from local state
        setPendingLinks((prev) => prev.filter((l) => l.id !== link.id));
        onReviewComplete?.();
      }
    } catch (err) {
      console.error("Failed to reject link:", err);
      setError(err instanceof Error ? err.message : "Failed to reject link");
    } finally {
      setProcessingId(null);
    }
  };

  const getMatchTypeBadge = (matchType: string) => {
    const colors: Record<string, string> = {
      fuzzy_name: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300",
      exact_abn: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/30 dark:text-green-300",
      exact_email: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-300",
      manual: "bg-muted text-foreground dark:bg-card dark:text-muted-foreground",
    };

    const labels: Record<string, string> = {
      fuzzy_name: "Fuzzy Name Match",
      exact_abn: "ABN Match",
      exact_email: "Email Match",
      manual: "Manual",
    };

    return (
      <Badge className={colors[matchType] || colors.manual}>
        {labels[matchType] || matchType}
      </Badge>
    );
  };

  const getConfidenceColor = (percent: number) => {
    if (percent >= 95) return "text-green-600 dark:text-green-400";
    if (percent >= 85) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (pendingLinks.length === 0) {
    return null; // Don't show anything if no pending reviews
  }

  return (
    <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          Pending Xero Link Reviews
        </CardTitle>
        <CardDescription>
          These contacts were matched by name similarity and need your confirmation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {pendingLinks.map((link) => (
          <div
            key={link.id}
            className="p-4 rounded-lg border bg-background space-y-3"
          >
            {/* Header with contact info and match badge */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{link.contact_name}</p>
                  {link.contact_email && (
                    <p className="text-sm text-muted-foreground">{link.contact_email}</p>
                  )}
                  {link.contact_abn && (
                    <p className="text-xs text-muted-foreground font-mono">
                      ABN: {link.contact_abn}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {getMatchTypeBadge(link.match_type)}
                <div className={`flex items-center gap-1 text-sm font-medium ${getConfidenceColor(link.match_confidence_percent)}`}>
                  <Percent className="h-3 w-3" />
                  {link.match_confidence_percent}% confidence
                </div>
              </div>
            </div>

            {/* Xero organization info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              <Building2 className="h-4 w-4" />
              <span>
                Proposed link to <span className="font-medium">{link.tenant_name}</span>
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReject(link)}
                disabled={processingId === link.id}
                className="text-destructive hover:text-destructive"
              >
                {processingId === link.id ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleApprove(link)}
                disabled={processingId === link.id}
              >
                {processingId === link.id ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Approve Link
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
