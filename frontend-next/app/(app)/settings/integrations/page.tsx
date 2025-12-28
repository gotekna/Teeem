"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/ui/back-button";
import { FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";

interface XeroStatus {
  connected: boolean;
  organization_name?: string;
  tenant_name?: string;
}

export default function IntegrationsPage() {
  const [xeroStatus, setXeroStatus] = React.useState<XeroStatus | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchXeroStatus = async () => {
      try {
        const response = await api.xero.getStatus();
        setXeroStatus(response.data || { connected: false });
      } catch (error) {
        console.error("Failed to fetch Xero status:", error);
        setXeroStatus({ connected: false });
      } finally {
        setLoading(false);
      }
    };
    fetchXeroStatus();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/settings" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect your external services to Teeem
          </p>
        </div>
      </div>

      {/* Integration Cards */}
      {/* Microsoft 365 org-wide access is managed in Admin System → Connections */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Xero */}
        <Card className="hover:bg-accent/50 transition-colors">
          <Link href="/settings/integrations/xero">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 dark:bg-cyan-900 rounded-lg">
                    <FileSpreadsheet className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Xero</CardTitle>
                    <CardDescription>Accounting Software</CardDescription>
                  </div>
                </div>
                {!loading && (
                  xeroStatus?.connected ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" />
                      Not Connected
                    </Badge>
                  )
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sync invoices, bills, and contacts with your Xero accounting system.
              </p>
              {!loading && xeroStatus?.connected && xeroStatus.tenant_name && (
                <p className="text-sm font-medium mt-2 text-cyan-700 dark:text-cyan-400">
                  {xeroStatus.tenant_name}
                </p>
              )}
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
