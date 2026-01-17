"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  DollarSign,
  FileText,
  AlertTriangle,
  ExternalLink,
  Building2,
  RefreshCw,
  Inbox,
  CreditCard,
  Settings,
  TrendingUp,
  TrendingDown,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";

interface XeroStatus {
  connected: boolean;
  tenant_name: string | null;
  last_sync: string | null;
  sync_in_progress: boolean;
}

interface BillStats {
  total: number;
  pending: number;
  extracting: number;
  awaiting_approval: number;
  approved: number;
  paid: number;
  rejected: number;
  errors: number;
  with_variance: number;
  total_amount_pending: number;
}

export default function FinancePage() {
  useSetLayoutMode("full-height");
  const [xeroStatus, setXeroStatus] = useState<XeroStatus | null>(null);
  const [billStats, setBillStats] = useState<BillStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [statusRes, statsRes] = await Promise.all([
          api.get<{ success: boolean; data: XeroStatus }>("/api/v1/xero/status").catch(() => null),
          api.get<BillStats>("/api/v1/bill_inbox/stats").catch(() => null),
        ]);

        if (statusRes?.data) {
          setXeroStatus(statusRes.data);
        }
        if (statsRes) {
          setBillStats(statsRes);
        }
      } catch (error) {
        console.error("Failed to load finance data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleConnect = async () => {
    try {
      const response = await api.get<{ success: boolean; auth_url: string; url?: string }>("/api/v1/xero/auth_url");
      const authUrl = response.auth_url || response.url;
      if (authUrl) {
        window.location.href = authUrl;
      }
    } catch (error) {
      console.error("Failed to get auth URL:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Finance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Accounts payable, bill processing, and Xero integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/finance/settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Xero Connection Status */}
      {xeroStatus?.connected ? (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Connected to Xero: <strong>{xeroStatus.tenant_name}</strong>
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/xero">View Xero Dashboard</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>Xero not connected. Connect to sync invoices and payments.</span>
            <Button variant="outline" size="sm" onClick={handleConnect}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Xero
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bill Inbox */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Bill Inbox
            </CardTitle>
            <CardDescription>
              Incoming invoices from Pay@teeem.com.au. AI-powered extraction and PO matching.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processing</span>
                <span className="font-mono">{billStats?.extracting ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">With Variance</span>
                <span className="font-mono text-yellow-600">{billStats?.with_variance ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Errors</span>
                <span className="font-mono text-red-600">{billStats?.errors ?? 0}</span>
              </div>
              <Button className="w-full mt-4" asChild>
                <Link href="/finance/bills">
                  <FileText className="h-4 w-4 mr-2" />
                  View Bill Inbox
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Batches */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Batches
            </CardTitle>
            <CardDescription>
              Create ABA payment files for approved bills. Bank-ready batch processing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bills Ready</span>
                <span className="font-mono">{billStats?.approved ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ready Amount</span>
                <span className="font-mono">${(billStats?.total_amount_pending ?? 0).toLocaleString()}</span>
              </div>
              <Button className="w-full mt-4" asChild>
                <Link href="/finance/payments">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Manage Payments
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Xero Integration */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Xero Integration
            </CardTitle>
            <CardDescription>
              View invoices, payments, and sync contacts with Xero.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={xeroStatus?.connected ? "text-green-600" : "text-yellow-600"}>
                  {xeroStatus?.connected ? "Connected" : "Not Connected"}
                </span>
              </div>
              {xeroStatus?.last_sync && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Sync</span>
                  <span className="font-mono text-xs">
                    {new Date(xeroStatus.last_sync).toLocaleDateString()}
                  </span>
                </div>
              )}
              <Button className="w-full mt-4" variant="outline" asChild>
                <Link href="/xero">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Xero Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
