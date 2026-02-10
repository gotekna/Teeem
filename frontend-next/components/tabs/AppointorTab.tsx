"use client";

/**
 * AppointorTab - Shows the trust appointor
 *
 * Extracted from corporate page for unified tab system.
 * The appointor has the power to remove and appoint trustees.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { ExternalLink, Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { Corporate, TrustRolesData } from "@/lib/types/corporate";

interface AppointorTabProps {
  company: Corporate;
  companyId?: string;
  entityId?: string;
  onSetAppointor?: () => void;
}

export function AppointorTab({ company, onSetAppointor }: AppointorTabProps) {
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

  const appointors = trustRoles?.appointors || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Appointor</h3>
        {appointors.length === 0 && (
          <Button variant="outline" size="sm" onClick={onSetAppointor}>
            <Plus className="h-4 w-4 mr-1" />
            Set Appointor
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        The appointor has the power to remove and appoint trustees.
      </p>
      {appointors.length > 0 ? (
        <div className="space-y-2">
          {appointors.map((a) => (
            <Card key={a.membership_id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.contact_name}</div>
                    {a.contact_email && (
                      <div className="text-sm text-muted-foreground">{a.contact_email}</div>
                    )}
                    <Badge variant="outline" className="mt-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                      Appointor
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/contacts/${a.contact_id}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-8 border rounded-lg">
          No appointor recorded for this trust.
          <div className="text-sm mt-2">Check the trust deed for appointor details.</div>
        </div>
      )}
    </div>
  );
}

export default AppointorTab;
