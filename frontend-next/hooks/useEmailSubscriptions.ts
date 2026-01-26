/**
 * useEmailSubscriptions - API hook for PolarisMail reseller management
 *
 * Provides CRUD operations for email subscriptions, mailboxes, and migrations.
 * SSoT for all email reseller API calls.
 */

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import type {
  EmailSubscription,
  EmailMailbox,
  EmailMigration,
  EmailAlias,
  EmailSubscriptionInvoice,
  ProfitReport,
  EmailPricing,
  DiscoveredMailbox,
  EmailResellerDashboardStats,
  CreateSubscriptionData,
  AddMailboxData,
} from "@/lib/email-reseller-types";

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export function useEmailSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<EmailSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSubscriptions = useCallback(async (params?: {
    status?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.set("status", params.status);
      if (params?.search) queryParams.set("search", params.search);
      if (params?.page) queryParams.set("page", String(params.page));
      if (params?.per_page) queryParams.set("per_page", String(params.per_page));

      const url = `/api/v1/email_subscriptions${queryParams.toString() ? `?${queryParams}` : ""}`;
      const response = await api.get<{ success: boolean; data: EmailSubscription[] }>(url);

      if (response.success) {
        setSubscriptions(response.data || []);
        return response.data || [];
      } else {
        throw new Error("Failed to fetch subscriptions");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch subscriptions";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createSubscription = useCallback(async (data: CreateSubscriptionData) => {
    setLoading(true);
    try {
      const response = await api.post<{ success: boolean; data: EmailSubscription }>(
        "/api/v1/email_subscriptions",
        data
      );

      if (response && response.success) {
        toast({ title: "Success", description: "Subscription created successfully" });
        return response.data;
      } else {
        throw new Error("Failed to create subscription");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create subscription";
      toast({ title: "Error", description: message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getSubscription = useCallback(async (id: number) => {
    try {
      const response = await api.get<{
        success: boolean;
        data: EmailSubscription & {
          mailboxes: EmailMailbox[];
          aliases: EmailAlias[];
          migrations: EmailMigration[];
          invoices: EmailSubscriptionInvoice[];
        };
      }>(`/api/v1/email_subscriptions/${id}`);

      if (response.success) {
        return response.data;
      }
      throw new Error("Failed to fetch subscription");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch subscription";
      toast({ title: "Error", description: message, variant: "destructive" });
      throw err;
    }
  }, [toast]);

  const updateSubscription = useCallback(async (id: number, data: Partial<EmailSubscription>) => {
    try {
      const response = await api.put<{ success: boolean; data: EmailSubscription }>(
        `/api/v1/email_subscriptions/${id}`,
        data
      );

      if (response.success) {
        toast({ title: "Success", description: "Subscription updated" });
        return response.data;
      }
      throw new Error("Failed to update subscription");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update subscription";
      toast({ title: "Error", description: message, variant: "destructive" });
      throw err;
    }
  }, [toast]);

  const cancelSubscription = useCallback(async (id: number, atPeriodEnd = true) => {
    try {
      const response = await api.post<{ success: boolean }>(
        `/api/v1/email_subscriptions/${id}/cancel`,
        { at_period_end: atPeriodEnd }
      );

      if (response && response.success) {
        toast({ title: "Success", description: "Subscription cancelled" });
        return true;
      }
      throw new Error("Failed to cancel subscription");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel subscription";
      toast({ title: "Error", description: message, variant: "destructive" });
      throw err;
    }
  }, [toast]);

  const sendInvite = useCallback(async (id: number) => {
    try {
      const response = await api.post<{ success: boolean; invite_url: string }>(
        `/api/v1/email_subscriptions/${id}/send_invite`
      );

      if (response && response.success) {
        toast({ title: "Success", description: "Invite sent to customer" });
        return response.invite_url;
      }
      throw new Error("Failed to send invite");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send invite";
      toast({ title: "Error", description: message, variant: "destructive" });
      throw err;
    }
  }, [toast]);

  return {
    subscriptions,
    loading,
    error,
    fetchSubscriptions,
    createSubscription,
    getSubscription,
    updateSubscription,
    cancelSubscription,
    sendInvite,
  };
}

// ============================================================================
// MAILBOXES
// ============================================================================

export function useEmailMailboxes(subscriptionId: number) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const addMailbox = useCallback(async (data: AddMailboxData) => {
    setLoading(true);
    try {
      const response = await api.post<{ success: boolean; data: EmailMailbox }>(
        `/api/v1/email_subscriptions/${subscriptionId}/add_mailbox`,
        data
      );

      if (response && response.success) {
        toast({ title: "Success", description: "Mailbox added successfully" });
        return response.data;
      }
      throw new Error("Failed to add mailbox");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add mailbox";
      toast({ title: "Error", description: message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [subscriptionId, toast]);

  const removeMailbox = useCallback(async (mailboxId: number) => {
    setLoading(true);
    try {
      const response = await api.delete<{ success: boolean }>(
        `/api/v1/email_subscriptions/${subscriptionId}/remove_mailbox/${mailboxId}`
      );

      if (response && response.success) {
        toast({ title: "Success", description: "Mailbox removed" });
        return true;
      }
      throw new Error("Failed to remove mailbox");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove mailbox";
      toast({ title: "Error", description: message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [subscriptionId, toast]);

  const discoverMailboxes = useCallback(async (contactId: number) => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: DiscoveredMailbox[] }>(
        `/api/v1/email_subscriptions/discover_mailboxes?contact_id=${contactId}`
      );

      if (response.success) {
        return response.data || [];
      }
      throw new Error("Failed to discover mailboxes");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to discover O365 mailboxes";
      toast({ title: "Error", description: message, variant: "destructive" });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    addMailbox,
    removeMailbox,
    discoverMailboxes,
  };
}

// ============================================================================
// MIGRATIONS
// ============================================================================

export function useEmailMigrations() {
  const [migrations, setMigrations] = useState<EmailMigration[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchActiveMigrations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: EmailMigration[] }>(
        "/api/v1/email_subscriptions/active_migrations"
      );

      if (response.success) {
        setMigrations(response.data || []);
        return response.data || [];
      }
      throw new Error("Failed to fetch migrations");
    } catch (err) {
      console.error("Failed to fetch migrations:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const startMigration = useCallback(async (subscriptionId: number, mailboxId: number, options?: {
    migration_type?: string;
  }) => {
    setLoading(true);
    try {
      const response = await api.post<{ success: boolean; data: EmailMigration }>(
        `/api/v1/email_subscriptions/${subscriptionId}/start_migration`,
        { mailbox_id: mailboxId, ...options }
      );

      if (response && response.success) {
        toast({ title: "Success", description: "Migration started" });
        return response.data;
      }
      throw new Error("Failed to start migration");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start migration";
      toast({ title: "Error", description: message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const pauseMigration = useCallback(async (migrationId: number) => {
    try {
      const response = await api.post<{ success: boolean }>(
        `/api/v1/email_migrations/${migrationId}/pause`
      );

      if (response && response.success) {
        toast({ title: "Success", description: "Migration paused" });
        return true;
      }
      throw new Error("Failed to pause migration");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to pause migration";
      toast({ title: "Error", description: message, variant: "destructive" });
      throw err;
    }
  }, [toast]);

  const resumeMigration = useCallback(async (migrationId: number) => {
    try {
      const response = await api.post<{ success: boolean }>(
        `/api/v1/email_migrations/${migrationId}/resume`
      );

      if (response && response.success) {
        toast({ title: "Success", description: "Migration resumed" });
        return true;
      }
      throw new Error("Failed to resume migration");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resume migration";
      toast({ title: "Error", description: message, variant: "destructive" });
      throw err;
    }
  }, [toast]);

  const cancelMigration = useCallback(async (migrationId: number) => {
    try {
      const response = await api.post<{ success: boolean }>(
        `/api/v1/email_migrations/${migrationId}/cancel`
      );

      if (response && response.success) {
        toast({ title: "Success", description: "Migration cancelled" });
        return true;
      }
      throw new Error("Failed to cancel migration");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel migration";
      toast({ title: "Error", description: message, variant: "destructive" });
      throw err;
    }
  }, [toast]);

  return {
    migrations,
    loading,
    fetchActiveMigrations,
    startMigration,
    pauseMigration,
    resumeMigration,
    cancelMigration,
    setMigrations,
  };
}

// ============================================================================
// PROFIT REPORT
// ============================================================================

export function useProfitReport() {
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchReport = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: ProfitReport }>(
        `/api/v1/email_subscriptions/profit_report?start_date=${startDate}&end_date=${endDate}`
      );

      if (response.success) {
        setReport(response.data);
        return response.data;
      }
      throw new Error("Failed to fetch profit report");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch report";
      toast({ title: "Error", description: message, variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    report,
    loading,
    fetchReport,
  };
}

// ============================================================================
// PRICING
// ============================================================================

export function useEmailPricing() {
  const [pricing, setPricing] = useState<EmailPricing | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPricing = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: EmailPricing }>(
        "/api/v1/email_subscriptions/pricing"
      );

      if (response.success) {
        setPricing(response.data);
        return response.data;
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch pricing:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    pricing,
    loading,
    fetchPricing,
  };
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export function useDashboardStats() {
  const [stats, setStats] = useState<EmailResellerDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: EmailResellerDashboardStats }>(
        "/api/v1/email_subscriptions/dashboard_stats"
      );

      if (response.success) {
        setStats(response.data);
        return response.data;
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    stats,
    loading,
    fetchStats,
  };
}
