"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  Check,
  X,
  Users,
  Percent,
  Clock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface Contact {
  id: number;
  display_name: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  abn?: string;
  email?: string;
  mobile_phone?: string;
  xero_contact_status?: string;
  last_synced_at?: string;
  xero_links_count: number;
  xero_orgs: Array<{
    tenant_id: string;
    external_contact_id: string;
    last_synced_at?: string;
  }>;
  invoices_count: number;
  created_at: string;
  updated_at: string;
}

interface DuplicateItem {
  id: number;
  contact_id: number;
  is_merge_target: boolean;
  contact: Contact;
  data_snapshot: any;
}

interface DuplicateGroup {
  id: number;
  group_key: string;
  match_type: string;
  confidence_score: number;
  status: string;
  merge_target_id?: number;
  reviewed_at?: string;
  reviewed_by?: string;
  contacts: DuplicateItem[];
  created_at: string;
  updated_at: string;
}

interface XeroDuplicateReviewPanelProps {
  contactId?: number; // Optional: show duplicates for specific contact
  batchSize?: number;
  onReviewComplete?: () => void;
}

export function XeroDuplicateReviewPanel({
  contactId,
  batchSize = 5,
  onReviewComplete,
}: XeroDuplicateReviewPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<Record<number, number>>({});

  useEffect(() => {
    loadDuplicates();
  }, [offset, contactId]);

  const loadDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = contactId
        ? `/api/v1/xero_duplicates/for_contact/${contactId}`
        : `/api/v1/xero_duplicates/pending?limit=${batchSize}&offset=${offset}`;

      const response = await api.get<{
        success: boolean;
        groups: DuplicateGroup[];
        total_pending?: number;
        showing?: number;
        offset?: number;
        has_more?: boolean;
        count?: number;
      }>(endpoint);

      if (response?.success) {
        const loadedGroups = response.groups || [];
        setGroups(loadedGroups);
        setTotalPending(response.total_pending || response.count || 0);
        setHasMore(response.has_more || false);

        // Set initial selected targets (default from backend)
        const targets: Record<number, number> = {};
        loadedGroups.forEach((group) => {
          const targetItem = group.contacts.find((item) => item.is_merge_target);
          if (targetItem) {
            targets[group.id] = targetItem.contact_id;
          }
        });
        setSelectedTargets(targets);
      }
    } catch (err) {
      console.error("Failed to load duplicates:", err);
      setError(err instanceof Error ? err.message : "Failed to load duplicates");
    } finally {
      setLoading(false);
    }
  };

  const handleTargetSelect = async (groupId: number, contactId: number) => {
    setSelectedTargets((prev) => ({ ...prev, [groupId]: contactId }));

    // Update backend
    try {
      await api.post(`/api/v1/xero_duplicates/${groupId}/select_target`, {
        merge_target_id: contactId,
      });
    } catch (err) {
      console.error("Failed to update merge target:", err);
    }
  };

  const handleApprove = async (group: DuplicateGroup) => {
    const targetId = selectedTargets[group.id];
    if (!targetId) {
      setError("Please select a merge target");
      return;
    }

    if (!confirm(`Merge ${group.contacts.length} contacts? This will keep the selected contact and merge all others into it.`)) {
      return;
    }

    setProcessingId(group.id);
    setError(null);
    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        result?: any;
      }>(`/api/v1/xero_duplicates/${group.id}/approve`, {
        merge_target_id: targetId,
      });

      if (response?.success) {
        // Remove from local state
        setGroups((prev) => prev.filter((g) => g.id !== group.id));
        setTotalPending((prev) => Math.max(0, prev - 1));
        onReviewComplete?.();

        // Auto-load next batch if current is empty
        if (groups.length === 1 && hasMore) {
          loadDuplicates();
        }
      }
    } catch (err) {
      console.error("Failed to approve merge:", err);
      setError(err instanceof Error ? err.message : "Failed to merge contacts");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (group: DuplicateGroup) => {
    if (!confirm("Mark these contacts as NOT duplicates? They will not be suggested again.")) {
      return;
    }

    setProcessingId(group.id);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/xero_duplicates/${group.id}/reject`
      );

      if (response?.success) {
        // Remove from local state
        setGroups((prev) => prev.filter((g) => g.id !== group.id));
        setTotalPending((prev) => Math.max(0, prev - 1));
        onReviewComplete?.();

        // Auto-load next batch if current is empty
        if (groups.length === 1 && hasMore) {
          loadDuplicates();
        }
      }
    } catch (err) {
      console.error("Failed to reject group:", err);
      setError(err instanceof Error ? err.message : "Failed to reject group");
    } finally {
      setProcessingId(null);
    }
  };

  const getMatchTypeBadge = (matchType: string) => {
    const colors: Record<string, string> = {
      abn: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      display_name: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      ato_asic: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    };

    const labels: Record<string, string> = {
      abn: "ABN Match",
      display_name: "Name Match",
      ato_asic: "ATO/ASIC Match",
    };

    return (
      <Badge className={colors[matchType] || colors.display_name}>
        {labels[matchType] || matchType}
      </Badge>
    );
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (groups.length === 0) {
    return null; // Don't show anything if no pending groups
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Duplicate Contacts for Review
        </CardTitle>
        <CardDescription>
          {contactId
            ? "Potential duplicates for this contact"
            : `Showing ${groups.length} groups • ${totalPending} total pending`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {groups.map((group) => (
          <div
            key={group.id}
            className="p-4 rounded-lg border bg-background space-y-4"
          >
            {/* Header with match type and confidence */}
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                {getMatchTypeBadge(group.match_type)}
                <div className={`flex items-center gap-1 text-sm font-medium ${getConfidenceColor(group.confidence_score)}`}>
                  <Percent className="h-3 w-3" />
                  {group.confidence_score}% confidence
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {group.contacts.length} contacts
              </div>
            </div>

            {/* Contact list with radio selection */}
            <RadioGroup
              value={selectedTargets[group.id]?.toString()}
              onValueChange={(value) => handleTargetSelect(group.id, parseInt(value))}
            >
              <div className="space-y-3">
                {group.contacts.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      selectedTargets[group.id] === item.contact_id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem value={item.contact_id.toString()} id={`contact-${item.id}`} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`contact-${item.id}`} className="cursor-pointer">
                        <div className="font-medium">{item.contact.display_name}</div>
                        {item.contact.abn && (
                          <div className="text-xs text-muted-foreground font-mono mt-1">
                            ABN: {item.contact.abn}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Synced: {formatDate(item.contact.last_synced_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {item.contact.invoices_count} invoices
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {item.contact.xero_links_count} Xero org{item.contact.xero_links_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReject(group)}
                disabled={processingId === group.id}
                className="text-destructive hover:text-destructive"
              >
                {processingId === group.id ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Skip
              </Button>
              <Button
                size="sm"
                onClick={() => handleApprove(group)}
                disabled={processingId === group.id}
              >
                {processingId === group.id ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Merge
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
