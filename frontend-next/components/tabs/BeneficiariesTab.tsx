"use client";

/**
 * BeneficiariesTab - Shows trust beneficiaries
 *
 * Extracted from corporate page for unified tab system.
 * Displays named, class, and default beneficiaries.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ExternalLink, Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { CorporateCompany, TrustRolesData, TrustRolesMember } from "@/lib/types/corporate";

interface BeneficiariesTabProps {
  company: CorporateCompany;
  companyId?: string;
  entityId?: string;
  onAddBeneficiary?: () => void;
}

export function BeneficiariesTab({ company, onAddBeneficiary }: BeneficiariesTabProps) {
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

  const beneficiaries = trustRoles?.beneficiaries || [];

  // Group beneficiaries by type
  const namedBeneficiaries = beneficiaries.filter(b => b.beneficiary_type === "named" || !b.beneficiary_type);
  const classBeneficiaries = beneficiaries.filter(b => b.beneficiary_type === "class");
  const defaultBeneficiary = beneficiaries.filter(b => b.beneficiary_type === "default");

  const renderBeneficiaryCard = (b: TrustRolesMember, colorClass: string) => (
    <Card key={b.membership_id}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{b.contact_name}</div>
            {b.class_description && (
              <div className="text-sm text-muted-foreground italic">{b.class_description}</div>
            )}
            {b.contact_email && (
              <div className="text-sm text-muted-foreground">{b.contact_email}</div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={colorClass}>
                {b.beneficiary_type === "class" ? "Class" :
                 b.beneficiary_type === "default" ? "Taker in Default" : "Named"}
              </Badge>
              {b.contact_entity_type && (
                <Badge variant="outline">{b.contact_entity_type}</Badge>
              )}
              {!b.is_active && (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/contacts/${b.contact_id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Beneficiaries ({beneficiaries.length})</h3>
        <Button variant="outline" size="sm" onClick={onAddBeneficiary}>
          <Plus className="h-4 w-4 mr-1" />
          Add Beneficiary
        </Button>
      </div>

      {beneficiaries.length > 0 ? (
        <>
          {/* Named Beneficiaries */}
          {namedBeneficiaries.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Named Beneficiaries ({namedBeneficiaries.length})
              </h4>
              <div className="space-y-2">
                {namedBeneficiaries.map((b) => renderBeneficiaryCard(b, "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/30 dark:text-green-300"))}
              </div>
            </div>
          )}

          {/* Class/Group Beneficiaries */}
          {classBeneficiaries.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Class Beneficiaries ({classBeneficiaries.length})
              </h4>
              <p className="text-xs text-muted-foreground">Groups or classes of beneficiaries (e.g., &quot;children of X&quot;, &quot;relatives&quot;)</p>
              <div className="space-y-2">
                {classBeneficiaries.map((b) => renderBeneficiaryCard(b, "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-300"))}
              </div>
            </div>
          )}

          {/* Taker in Default */}
          {defaultBeneficiary.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Taker in Default
              </h4>
              <p className="text-xs text-muted-foreground">Receives trust property if trustee fails to exercise discretion or trust winds up</p>
              <div className="space-y-2">
                {defaultBeneficiary.map((b) => renderBeneficiaryCard(b, "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 dark:bg-amber-900/30 dark:text-amber-300"))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-muted-foreground py-8 border rounded-lg">
          No beneficiaries recorded for this trust.
          <div className="text-sm mt-2">Add named beneficiaries, class beneficiaries, or a taker in default.</div>
        </div>
      )}
    </div>
  );
}

export default BeneficiariesTab;
