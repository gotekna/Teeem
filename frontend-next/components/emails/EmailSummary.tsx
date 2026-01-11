"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  User,
  Building2,
  Calendar,
  DollarSign,
  Briefcase,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ActionItem {
  task: string;
  assignee_hint?: string;
  deadline_hint?: string;
}

interface ContactEntity {
  name: string;
  email?: string;
  role?: string;
}

interface DateEntity {
  date: string;
  context: string;
}

interface MoneyEntity {
  amount: string;
  context: string;
}

interface Entities {
  job_references?: string[];
  contacts?: ContactEntity[];
  companies?: string[];
  key_dates?: DateEntity[];
  monetary_values?: MoneyEntity[];
}

interface SummaryData {
  summary: string;
  action_items: ActionItem[];
  entities: Entities;
  sentiment?: "positive" | "negative" | "neutral" | "urgent";
  category?: string;
  cached: boolean;
}

interface EmailSummaryProps {
  emailId: number;
  existingSummary?: string | null;
  className?: string;
}

const SENTIMENT_CONFIG = {
  positive: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "Positive" },
  negative: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", label: "Negative" },
  neutral: { color: "bg-muted text-foreground dark:bg-gray-800 dark:text-muted-foreground", label: "Neutral" },
  urgent: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", label: "Urgent" },
};

const CATEGORY_LABELS: Record<string, string> = {
  business: "Business",
  inquiry: "Inquiry",
  quote_request: "Quote Request",
  approval: "Approval",
  complaint: "Complaint",
  information: "Information",
  follow_up: "Follow Up",
  other: "Other",
};

export function EmailSummary({ emailId, existingSummary, className }: EmailSummaryProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [generated, setGenerated] = useState(false);

  const generateSummary = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: SummaryData; error?: string }>(
        `/api/v1/email_warehouse/${emailId}/summarize`,
        { refresh }
      );

      if (response?.success && response.data) {
        setSummary(response.data);
        setGenerated(true);
      } else {
        setError(response?.error || "Failed to generate summary");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  }, [emailId]);

  // Check if we have an existing summary on first render
  React.useEffect(() => {
    if (existingSummary) {
      // If email already has a summary, fetch the full data
      generateSummary(false);
    }
  }, [existingSummary, generateSummary]);

  // If not generated yet and no existing summary, show generate button
  if (!generated && !existingSummary && !loading) {
    return (
      <div className={cn("px-6 py-3 border-b", className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateSummary(false)}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Generate AI Summary
        </Button>
      </div>
    );
  }

  // Loading state
  if (loading && !summary) {
    return (
      <div className={cn("px-6 py-4 border-b bg-muted/30", className)}>
        <div className="flex items-center gap-3">
          <Spinner className="h-4 w-4" />
          <span className="text-sm text-muted-foreground">Generating AI summary...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !summary) {
    return (
      <div className={cn("px-6 py-3 border-b", className)}>
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => generateSummary(false)}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Summary display
  if (!summary) return null;

  const hasEntities = summary.entities && (
    (summary.entities.job_references?.length || 0) > 0 ||
    (summary.entities.contacts?.length || 0) > 0 ||
    (summary.entities.companies?.length || 0) > 0 ||
    (summary.entities.key_dates?.length || 0) > 0 ||
    (summary.entities.monetary_values?.length || 0) > 0
  );

  const hasActionItems = summary.action_items && summary.action_items.length > 0;

  return (
    <div className={cn("border-b bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20", className)}>
      {/* Header */}
      <div
        className="px-6 py-3 flex items-center justify-between cursor-pointer hover:bg-white/50 dark:hover:bg-white/5"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-medium">AI Summary</span>
          {summary.cached && (
            <Badge variant="secondary" className="text-xs">Cached</Badge>
          )}
          {summary.sentiment && (
            <Badge className={cn("text-xs", SENTIMENT_CONFIG[summary.sentiment]?.color)}>
              {SENTIMENT_CONFIG[summary.sentiment]?.label}
            </Badge>
          )}
          {summary.category && (
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[summary.category] || summary.category}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              generateSummary(true);
            }}
            disabled={loading}
            title="Regenerate summary"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-6 pb-4 space-y-4">
          {/* Summary Text */}
          <p className="text-sm leading-relaxed">{summary.summary}</p>

          {/* Action Items */}
          {hasActionItems && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Action Items
              </h4>
              <ul className="space-y-1.5">
                {summary.action_items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <span>{item.task}</span>
                      {item.assignee_hint && (
                        <span className="text-muted-foreground ml-1">
                          ({item.assignee_hint})
                        </span>
                      )}
                      {item.deadline_hint && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {item.deadline_hint}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Entities */}
          {hasEntities && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Extracted Information
              </h4>
              <div className="flex flex-wrap gap-2">
                {/* Job References */}
                {summary.entities.job_references?.map((job, idx) => (
                  <Badge key={`job-${idx}`} variant="secondary" className="gap-1">
                    <Briefcase className="h-3 w-3" />
                    {job}
                  </Badge>
                ))}

                {/* Contacts */}
                {summary.entities.contacts?.map((contact, idx) => (
                  <Badge key={`contact-${idx}`} variant="secondary" className="gap-1">
                    <User className="h-3 w-3" />
                    {contact.name}
                    {contact.role && <span className="text-muted-foreground">({contact.role})</span>}
                  </Badge>
                ))}

                {/* Companies */}
                {summary.entities.companies?.map((company, idx) => (
                  <Badge key={`company-${idx}`} variant="secondary" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {company}
                  </Badge>
                ))}

                {/* Key Dates */}
                {summary.entities.key_dates?.map((date, idx) => (
                  <Badge key={`date-${idx}`} variant="secondary" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {date.date}
                    <span className="text-muted-foreground">({date.context})</span>
                  </Badge>
                ))}

                {/* Monetary Values */}
                {summary.entities.monetary_values?.map((money, idx) => (
                  <Badge key={`money-${idx}`} variant="secondary" className="gap-1">
                    <DollarSign className="h-3 w-3" />
                    {money.amount}
                    <span className="text-muted-foreground">({money.context})</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { SummaryData, ActionItem, Entities };
