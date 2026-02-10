"use client";

/**
 * TrusteeTab - Shows the corporate trustee of a trust
 *
 * Extracted from corporate page for unified tab system.
 * Displays trustee information with link to trustee company.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import type { Corporate, TrustRolesData } from "@/lib/types/corporate";

interface TrusteeTabProps {
  company: Corporate;
  companyId?: string;
  entityId?: string;
}

export function TrusteeTab({ company }: TrusteeTabProps) {
  const router = useRouter();
  const [trustRoles, setTrustRoles] = React.useState<TrustRolesData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadTrustRoles = async () => {
      try {
        const response = await api.get<{ success: boolean; data: TrustRolesData }>(
          `/api/v1/companies/${company.id}/trust_roles`
        );
        setTrustRoles(response.data);
      } catch (error) {
        console.error("Failed to load trust roles:", error);
      } finally {
        setLoading(false);
      }
    };
    loadTrustRoles();
  }, [company.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  const trustee = trustRoles?.corporate_trustee;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Trustee</h3>
      {trustee ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{trustee.name}</div>
                {trustee.acn && (
                  <div className="text-sm text-muted-foreground">ACN: {trustee.acn}</div>
                )}
                <Badge variant="outline" className="mt-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 dark:bg-purple-900/30 dark:text-purple-300">
                  Corporate Trustee
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/corporate/companies/${trustee.id}`)}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center text-muted-foreground py-8 border rounded-lg">
          No trustee assigned to this trust
        </div>
      )}
    </div>
  );
}

export default TrusteeTab;
