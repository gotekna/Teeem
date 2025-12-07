"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Cloud, FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";
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
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect your external services to Teeem
          </p>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Microsoft 365 / OneDrive */}
        <Card className="hover:bg-accent/50 transition-colors">
          <Link href="/settings/integrations/microsoft">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Cloud className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Microsoft 365</CardTitle>
                    <CardDescription>OneDrive & SharePoint</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Connect to OneDrive for document storage and SharePoint for file sharing.
              </p>
            </CardContent>
          </Link>
        </Card>

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
