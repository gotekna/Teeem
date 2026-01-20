"use client";

/**
 * TrustsTab - Shows trusts linked to a company (as trustee)
 *
 * Extracted from corporate page for unified tab system.
 * Allows a company to be linked as trustee for trust entities.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import type { CorporateCompany } from "@/lib/types/corporate";

// Trust icon SVG component
function TrustIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3L22 20H2L12 3Z" strokeLinejoin="round" />
    </svg>
  );
}

interface CompanyGroup {
  id: number;
  name: string;
}

interface TrustCompany {
  id: number;
  name: string;
  abn?: string;
  entity_type?: string;
}

interface TrustsTabProps {
  company: CorporateCompany;
  companyId?: string;
  entityId?: string;
  onUpdate?: () => void;
}

export function TrustsTab({ company, onUpdate }: TrustsTabProps) {
  const router = useRouter();
  const [trusts, setTrusts] = React.useState<TrustCompany[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [availableTrusts, setAvailableTrusts] = React.useState<TrustCompany[]>([]);
  const [selectedTrustId, setSelectedTrustId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [companyGroups, setCompanyGroups] = React.useState<CompanyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState(String(company.company_group_id || ""));
  const [savingGroup, setSavingGroup] = React.useState(false);

  React.useEffect(() => {
    loadTrusts();
    loadCompanyGroups();
  }, [company.id]);

  const loadTrusts = async () => {
    try {
      setLoading(true);
      if (company.is_trustee && company.trust_name) {
        const params: Record<string, string | number | boolean> = { search: company.trust_name };
        if (company.company_group_id) {
          params.company_group_id = company.company_group_id;
        }
        const response = await api.get<{ companies: TrustCompany[] }>("/api/v1/companies", { params });
        const matchingTrust = (response.companies || []).find(
          (t) => t.name === company.trust_name && ["Trust", "Superfund"].includes(t.entity_type || "")
        );
        setTrusts(matchingTrust ? [matchingTrust] : []);
      } else {
        setTrusts([]);
      }
    } catch (error) {
      console.error("Failed to load trusts:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTrusts = async () => {
    try {
      const params: Record<string, string | number | boolean> = {};
      if (company.company_group_id) {
        params.company_group_id = company.company_group_id;
      }
      const response = await api.get<{ companies: TrustCompany[] }>("/api/v1/companies", { params });
      const trustsAndSuperfunds = (response.companies || []).filter((c) =>
        ["Trust", "Superfund"].includes(c.entity_type || "")
      );
      setAvailableTrusts(trustsAndSuperfunds);
    } catch (error) {
      console.error("Failed to load available trusts:", error);
    }
  };

  const loadCompanyGroups = async () => {
    try {
      const response = await api.get<{ data: CompanyGroup[] }>("/api/v1/company_groups");
      setCompanyGroups(response.data || []);
    } catch (error) {
      console.error("Failed to load company groups:", error);
    }
  };

  const handleGroupChange = async (newGroupId: string) => {
    if (newGroupId === selectedGroupId) return;
    try {
      setSavingGroup(true);
      await api.put(`/api/v1/companies/${company.id}`, {
        company: { company_group_id: newGroupId || null },
      });
      setSelectedGroupId(newGroupId);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update company group:", error);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleAddTrust = () => {
    loadAvailableTrusts();
    setShowAddForm(true);
  };

  const handleSaveTrust = async () => {
    if (!selectedTrustId) return;
    try {
      setSaving(true);
      const selectedTrust = availableTrusts.find((t) => t.id === parseInt(selectedTrustId));
      await api.put(`/api/v1/companies/${company.id}`, {
        company: { is_trustee: true, trust_name: selectedTrust?.name },
      });
      setShowAddForm(false);
      setSelectedTrustId("");
      onUpdate?.();
      loadTrusts();
    } catch (error) {
      console.error("Failed to save trust link:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTrust = async () => {
    if (!confirm("Remove this company as trustee for this trust?")) return;
    try {
      await api.put(`/api/v1/companies/${company.id}`, {
        company: { is_trustee: false, trust_name: "" },
      });
      onUpdate?.();
      loadTrusts();
    } catch (error) {
      console.error("Failed to remove trust link:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Group Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap">Company Group:</Label>
            <Select
              value={selectedGroupId || "__none__"}
              onValueChange={(v) => handleGroupChange(v === "__none__" ? "" : v)}
              disabled={savingGroup}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a group..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select a group...</SelectItem>
                {companyGroups.map((group) => (
                  <SelectItem key={group.id} value={String(group.id)}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingGroup && <span className="text-sm text-muted-foreground">Saving...</span>}
          </div>
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Trusts</h3>
          <p className="text-sm text-muted-foreground">
            {company.is_trustee
              ? "This company acts as trustee for the following trust(s)"
              : "Make this company a trustee for a trust"}
          </p>
        </div>
        {!company.is_trustee && !showAddForm && (
          <Button onClick={handleAddTrust}>
            <Plus className="h-4 w-4 mr-2" />
            Link Trust
          </Button>
        )}
      </div>

      {/* Add Trust Form */}
      {showAddForm && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3">Select Trust to Link</h4>
            <div className="space-y-4">
              <Select
                value={selectedTrustId || "__none__"}
                onValueChange={(v) => setSelectedTrustId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a trust..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select a trust...</SelectItem>
                  {availableTrusts.map((trust) => (
                    <SelectItem key={trust.id} value={String(trust.id)}>
                      {trust.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setShowAddForm(false); setSelectedTrustId(""); }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTrust} disabled={!selectedTrustId || saving}>
                  {saving ? "Saving..." : "Link Trust"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trusts List */}
      {trusts.length === 0 && !showAddForm ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg border-2 border-dashed">
          <TrustIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold">No trusts linked</h3>
          <p className="mt-1 text-sm text-muted-foreground">This company is not a trustee for any trust.</p>
          <Button className="mt-4" onClick={handleAddTrust}>
            <Plus className="h-4 w-4 mr-2" />
            Link Trust
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {trusts.map((trust) => (
            <Card key={trust.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-purple-600 dark:text-purple-400">
                      <TrustIcon className="h-8 w-8" />
                    </div>
                    <div>
                      <button
                        onClick={() => router.push(`/corporate/companies/${trust.id}`)}
                        className="text-lg font-medium hover:text-primary"
                      >
                        {trust.name}
                      </button>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {trust.abn && <span>ABN: {trust.abn}</span>}
                        <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 dark:bg-purple-900/30 dark:text-purple-300">
                          Trust
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {company.name} acts as trustee for this trust
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleRemoveTrust} title="Remove trust link">
                    <X className="h-5 w-5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info box */}
      {company.is_trustee && trusts.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Note:</strong> In the Company Groups hierarchy view, this company will display as
            &quot;{company.name} ATF {company.trust_name}&quot; and the trust will appear as a child when expanded.
          </p>
        </div>
      )}
    </div>
  );
}

export default TrustsTab;
