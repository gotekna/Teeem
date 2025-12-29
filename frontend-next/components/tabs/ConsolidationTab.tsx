"use client";

/**
 * ConsolidationTab - Shows company consolidation hierarchy
 *
 * Extracted from corporate page for unified tab system.
 * Manages parent/child company relationships for financial consolidation.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, X, Building2, GitMerge, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { CorporateCompany } from "@/lib/types/corporate";

interface CompanyGroup {
  id: number;
  name: string;
}

interface ConsolidatedCompany {
  id: number;
  name: string;
  code?: string;
  acn?: string;
  entity_type?: string;
  status?: string;
}

interface OrgChartNodeData {
  id: number;
  name: string;
  code?: string;
  entity_type?: string;
  is_trustee?: boolean;
  trust_name?: string;
  is_trust_of_trustee?: boolean;
  children: OrgChartNodeData[];
}

// Recursive component to render org chart nodes
function OrgChartNode({
  node,
  currentCompanyId,
  onNavigate,
  level,
}: {
  node: OrgChartNodeData;
  currentCompanyId: number;
  onNavigate: (id: number) => void;
  level: number;
}) {
  const isCurrentCompany = node.id === currentCompanyId;
  const isTrust = node.entity_type === "Trust" || node.entity_type === "Superfund";
  const hasChildren = node.children && node.children.length > 0;

  // Get icon based on entity type
  const getEntityIcon = () => {
    if (node.is_trust_of_trustee) return "🔐"; // Trust managed by trustee
    if (isTrust) return "📜"; // Trust/Superfund
    if (node.is_trustee) return "🏛️"; // Corporate trustee
    return "🏢"; // Regular company
  };

  return (
    <div className="relative">
      {/* Node box */}
      <div className="flex items-start gap-2 mb-2">
        {/* Indent based on level with connecting line */}
        {level > 0 && (
          <div className="flex items-center" style={{ width: `${level * 24}px` }}>
            <div className="flex items-center justify-end w-full">
              <div className="w-4 h-px bg-border" />
              <ChevronRight className="h-3 w-3 text-muted-foreground -ml-1" />
            </div>
          </div>
        )}

        <button
          onClick={() => onNavigate(node.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all hover:shadow-md",
            isCurrentCompany
              ? "bg-primary/10 border-primary ring-2 ring-primary/20"
              : isTrust
              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30"
              : "bg-background border-border hover:bg-muted"
          )}
        >
          <span className="text-lg">{getEntityIcon()}</span>
          <div>
            <div className={cn(
              "text-sm font-medium",
              isCurrentCompany && "text-primary"
            )}>
              {node.name}
              {node.code && <span className="ml-1 text-xs text-muted-foreground">({node.code})</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              {node.is_trust_of_trustee ? "Trust" : node.entity_type || "Company"}
              {node.is_trustee && node.trust_name && (
                <span className="ml-1">(Trustee for {node.trust_name})</span>
              )}
            </div>
          </div>
          {isCurrentCompany && (
            <Badge variant="outline" className="ml-2 text-xs bg-primary/10 text-primary border-primary/30">
              Current
            </Badge>
          )}
        </button>
      </div>

      {/* Render children recursively */}
      {hasChildren && (
        <div className="ml-0">
          {node.children.map((child) => (
            <OrgChartNode
              key={child.id}
              node={child}
              currentCompanyId={currentCompanyId}
              onNavigate={onNavigate}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ConsolidationTabProps {
  company: CorporateCompany;
  companyId?: string;
  entityId?: string;
  onUpdate?: () => void;
}

export function ConsolidationTab({ company, onUpdate }: ConsolidationTabProps) {
  const router = useRouter();
  const [consolidatedCompanies, setConsolidatedCompanies] = React.useState<ConsolidatedCompany[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [availableCompanies, setAvailableCompanies] = React.useState<ConsolidatedCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [companyGroups, setCompanyGroups] = React.useState<CompanyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState(String(company.company_group_id || ""));
  const [savingGroup, setSavingGroup] = React.useState(false);
  // Parent company state - SSoT: Use consolidation_parent_id for hierarchy
  const [parentCompanyOptions, setParentCompanyOptions] = React.useState<{ id: number; name: string }[]>([]);
  const [selectedParentId, setSelectedParentId] = React.useState(String(company.consolidation_parent_id || ""));
  const [savingParent, setSavingParent] = React.useState(false);
  // Trustee state
  const [availableTrusts, setAvailableTrusts] = React.useState<{ id: number; name: string; entity_type?: string }[]>([]);
  const [selectedTrustName, setSelectedTrustName] = React.useState(company.trust_name || "");
  const [savingTrustee, setSavingTrustee] = React.useState(false);
  // Group structure for org chart
  const [groupStructure, setGroupStructure] = React.useState<{
    group: { id: number; name: string };
    companies: OrgChartNodeData[];
  } | null>(null);

  React.useEffect(() => {
    loadConsolidatedCompanies();
    loadCompanyGroups();
    loadParentCompanyOptions();
    loadAvailableTrusts();
    loadGroupStructure();
  }, [company.id]);

  const loadConsolidatedCompanies = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ companies: ConsolidatedCompany[] }>("/api/v1/companies", {
        params: { consolidation_parent_id: company.id },
      });
      setConsolidatedCompanies(response.companies || []);
    } catch (error) {
      console.error("Failed to load consolidated companies:", error);
      setConsolidatedCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableCompanies = async () => {
    try {
      const response = await api.get<{ companies: ConsolidatedCompany[] }>("/api/v1/companies");
      const available = (response.companies || []).filter(
        (c) => c.id !== company.id && !consolidatedCompanies.find((cc) => cc.id === c.id)
      );
      setAvailableCompanies(available);
    } catch (error) {
      console.error("Failed to load available companies:", error);
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

  const loadParentCompanyOptions = async () => {
    try {
      const params: Record<string, string | number> = {};
      if (company.company_group_id) {
        params.company_group_id = company.company_group_id;
      }
      const response = await api.get<{ companies: { id: number; name: string }[] }>("/api/v1/companies", { params });
      // Exclude current company from parent options
      const filtered = (response.companies || []).filter((c) => c.id !== company.id);
      setParentCompanyOptions(filtered);
    } catch (error) {
      console.error("Failed to load parent company options:", error);
    }
  };

  const handleParentChange = async (newParentId: string) => {
    if (newParentId === selectedParentId) return;
    try {
      setSavingParent(true);
      // SSoT: Use consolidation_parent_id for hierarchy (single source of truth)
      await api.put(`/api/v1/companies/${company.id}`, {
        company: { consolidation_parent_id: newParentId || null },
      });
      setSelectedParentId(newParentId);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update parent company:", error);
    } finally {
      setSavingParent(false);
    }
  };

  const loadAvailableTrusts = async () => {
    try {
      const params: Record<string, string | number> = {};
      if (company.company_group_id) {
        params.company_group_id = company.company_group_id;
      }
      const response = await api.get<{ companies: { id: number; name: string; entity_type?: string }[] }>("/api/v1/companies", { params });
      // Filter to only trusts and superfunds
      const trusts = (response.companies || []).filter((c) =>
        ["Trust", "Superfund"].includes(c.entity_type || "")
      );
      setAvailableTrusts(trusts);
    } catch (error) {
      console.error("Failed to load available trusts:", error);
    }
  };

  const loadGroupStructure = async () => {
    if (!company.company_group_id) {
      setGroupStructure(null);
      return;
    }
    try {
      const response = await api.get<{ success: boolean; data: { group: { id: number; name: string }; companies: OrgChartNodeData[] } }>(
        `/api/v1/company_groups/${company.company_group_id}/structure`
      );
      if (response.success) {
        setGroupStructure(response.data);
      }
    } catch (error) {
      console.error("Failed to load group structure:", error);
    }
  };

  const handleTrusteeChange = async (trustName: string) => {
    if (trustName === selectedTrustName) return;
    try {
      setSavingTrustee(true);
      await api.put(`/api/v1/companies/${company.id}`, {
        company: {
          is_trustee: trustName ? true : false,
          trust_name: trustName || null,
        },
      });
      setSelectedTrustName(trustName);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update trustee:", error);
    } finally {
      setSavingTrustee(false);
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
      // Reload structure after group change
      if (newGroupId) {
        setTimeout(() => loadGroupStructure(), 500);
      } else {
        setGroupStructure(null);
      }
    } catch (error) {
      console.error("Failed to update company group:", error);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleAddCompany = () => {
    loadAvailableCompanies();
    setShowAddForm(true);
  };

  const handleSaveConsolidation = async () => {
    if (!selectedCompanyId) return;
    try {
      setSaving(true);
      // SSoT: Only use consolidation_parent_id for hierarchy (single source of truth)
      await api.put(`/api/v1/companies/${selectedCompanyId}`, {
        company: {
          consolidation_parent_id: company.id,
          company_group_id: company.company_group_id
        },
      });
      setShowAddForm(false);
      setSelectedCompanyId("");
      loadConsolidatedCompanies();
      loadGroupStructure(); // Refresh org chart
      onUpdate?.();
    } catch (error) {
      console.error("Failed to add to consolidation:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveConsolidation = async (companyId: number) => {
    if (!confirm("Remove this company from consolidation?")) return;
    try {
      // SSoT: Only clear consolidation_parent_id (single source of truth)
      await api.put(`/api/v1/companies/${companyId}`, {
        company: { consolidation_parent_id: null },
      });
      loadConsolidatedCompanies();
      loadGroupStructure(); // Refresh org chart
      onUpdate?.();
    } catch (error) {
      console.error("Failed to remove from consolidation:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Group & Parent Company Selectors */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap w-32">Company Group:</Label>
            <select
              value={selectedGroupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              disabled={savingGroup}
              className="block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Select a group...</option>
              {companyGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            {savingGroup && <span className="text-sm text-muted-foreground">Saving...</span>}
          </div>
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap w-32">Parent Company:</Label>
            <select
              value={selectedParentId}
              onChange={(e) => handleParentChange(e.target.value)}
              disabled={savingParent}
              className="block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">None (Top-level entity)</option>
              {parentCompanyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {savingParent && <span className="text-sm text-muted-foreground">Saving...</span>}
          </div>
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap w-32">Trustee For:</Label>
            <select
              value={selectedTrustName}
              onChange={(e) => handleTrusteeChange(e.target.value)}
              disabled={savingTrustee}
              className="block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Not a trustee</option>
              {availableTrusts.map((trust) => (
                <option key={trust.id} value={trust.name}>
                  {trust.name}
                </option>
              ))}
            </select>
            {savingTrustee && <span className="text-sm text-muted-foreground">Saving...</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            Set relationships: Parent Company for hierarchy, Trustee For if this company acts as trustee for a trust
          </p>
        </CardContent>
      </Card>

      {/* Consolidated Under Banner */}
      {company.consolidation_parent && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <GitMerge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  This entity is consolidated under{" "}
                  <button
                    onClick={() => router.push(`/corporate/companies/${company.consolidation_parent!.id}`)}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    {company.consolidation_parent.name}
                  </button>
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Financial results are reported through the consolidation parent
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Group Structure Chart */}
      {groupStructure && groupStructure.companies.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">{groupStructure.group.name} Structure</h4>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-fit">
                {groupStructure.companies.map((node) => (
                  <OrgChartNode
                    key={node.id}
                    node={node}
                    currentCompanyId={company.id}
                    onNavigate={(id) => router.push(`/corporate/companies/${id}`)}
                    level={0}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Consolidation</h3>
          <p className="text-sm text-muted-foreground">Companies included in this entity&apos;s financial consolidation</p>
        </div>
        {!showAddForm && (
          <Button onClick={handleAddCompany}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        )}
      </div>

      {/* Add Company Form */}
      {showAddForm && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3">Add Company to Consolidation</h4>
            <div className="space-y-4">
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a company...</option>
                {availableCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setShowAddForm(false); setSelectedCompanyId(""); }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveConsolidation} disabled={!selectedCompanyId || saving}>
                  {saving ? "Adding..." : "Add to Consolidation"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consolidated Companies List */}
      {consolidatedCompanies.length === 0 && !showAddForm ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg border-2 border-dashed">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold">No consolidated companies</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add subsidiaries that are included in this company&apos;s financial consolidation.
          </p>
          <Button className="mt-4" onClick={handleAddCompany}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>
      ) : (
        <Card>
          <div className="overflow-hidden">
            <Table className="min-w-full">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">ACN</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</TableHead>
                  <TableHead className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {consolidatedCompanies.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/50">
                    <TableCell className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/corporate/companies/${c.id}`)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {c.name}
                      </button>
                      {c.code && <span className="ml-2 text-xs text-muted-foreground">({c.code})</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">{c.acn || "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">{c.entity_type || "Company"}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant={c.status === "active" ? "default" : "secondary"} className={c.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : ""}>
                        {c.status || "active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveConsolidation(c.id)} title="Remove from consolidation">
                        <X className="h-5 w-5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Info box */}
      {consolidatedCompanies.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Consolidation Summary:</strong> {consolidatedCompanies.length}{" "}
            {consolidatedCompanies.length === 1 ? "company" : "companies"} consolidated under {company.name}
          </p>
        </div>
      )}
    </div>
  );
}

export default ConsolidationTab;
