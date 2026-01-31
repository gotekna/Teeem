"use client";

import React, { useEffect, useState, useMemo } from "react";
import { X, CheckCircle, XCircle, RefreshCw, Building2, AlertTriangle, ChevronDown, Users, Search, Filter } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CompanyLink {
  id: number;
  company_id: number;
  company: {
    id: number;
    name: string;
  };
  xero_tenant_id: string;
  xero_tenant_name: string;
  connection_status: string;
  connected?: boolean;
  display_status?: 'connected' | 'warning' | 'error' | 'disconnected';
  last_sync_at?: string;
  days_since_last_sync?: number;
}

interface XeroOrganization {
  id: number;
  tenant_id: string;
  tenant_name: string;
  connected: boolean;
  expired: boolean;
  expires_at: string;
  status?: string;
  degraded?: boolean;
  display_status?: 'connected' | 'warning' | 'error' | 'disconnected';
  message?: string;
  needs_attention?: boolean;
  action_required?: string;
  companies: CompanyLink[];
  teeem_tenant_id?: number;
  teeem_tenant_name?: string;
}

interface TeeemTenant {
  id: number;
  name: string;
  is_master: boolean;
}

interface Company {
  id: number;
  name: string;
  company_group_id?: number;
  entity_type?: string;
}

interface XeroConnectionsPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterType = 'all' | 'connected' | 'needs_reauth' | 'not_linked';

export function XeroConnectionsPopup({ isOpen, onClose }: XeroConnectionsPopupProps) {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<XeroOrganization[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [availableTenants, setAvailableTenants] = useState<TeeemTenant[]>([]);
  const [isMasterTenant, setIsMasterTenant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linkingTenantId, setLinkingTenantId] = useState<string | null>(null);
  const [assigningOrgId, setAssigningOrgId] = useState<number | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [openTenantDropdown, setOpenTenantDropdown] = useState<number | null>(null);
  const [openCompanyDropdown, setOpenCompanyDropdown] = useState<string | null>(null);
  const [companySearchTerms, setCompanySearchTerms] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      loadConnections();
      loadCompanies();
    }
  }, [isOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.dropdown-container')) {
        setOpenTenantDropdown(null);
        setOpenCompanyDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await api.get<{
        success: boolean;
        organizations: XeroOrganization[];
        total_organizations: number;
        connected_organizations: number;
        is_master_tenant: boolean;
        available_tenants: TeeemTenant[];
      }>("/api/v1/company_xero_connections");
      setOrganizations(response.organizations || []);
      setIsMasterTenant(response.is_master_tenant || false);
      setAvailableTenants(response.available_tenants || []);
    } catch (error) {
      console.error("Failed to load Xero connections:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTenant = async (credentialId: number, teeemTenantId: number) => {
    try {
      setAssigningOrgId(credentialId);
      const response = await api.patch<{ success: boolean; message: string }>(
        `/api/v1/company_xero_connections/${credentialId}/assign_tenant`,
        { teeem_tenant_id: teeemTenantId }
      );
      if (response?.success) {
        await loadConnections();
        toast({ title: "Success", description: response.message });
      }
    } catch (error) {
      console.error("Failed to assign tenant:", error);
      toast({ title: "Error", description: "Failed to assign tenant", variant: "destructive" });
    } finally {
      setAssigningOrgId(null);
      setOpenTenantDropdown(null);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get<{ success: boolean; companies: Company[] }>("/api/v1/companies");
      setCompanies(response.companies || []);
    } catch (error) {
      console.error("Failed to load companies:", error);
    }
  };

  const handleConnectToXero = async () => {
    try {
      const response = await api.xero.getAuthUrl();
      if (response.success && response.auth_url) {
        window.location.href = response.auth_url;
      }
    } catch (error) {
      console.error("Failed to get Xero auth URL:", error);
      toast({ title: "Error", description: "Failed to connect to Xero", variant: "destructive" });
    }
  };

  const handleLinkCompany = async (tenantId: string, companyId: number) => {
    try {
      setLinkingTenantId(tenantId);
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/companies/${companyId}/xero/link`,
        { tenant_id: tenantId }
      );
      if (response?.success) {
        await loadConnections();
        toast({ title: "Success", description: "Company linked to Xero" });
      }
    } catch (error) {
      console.error("Failed to link company:", error);
      toast({ title: "Error", description: "Failed to link company", variant: "destructive" });
    } finally {
      setLinkingTenantId(null);
      setOpenCompanyDropdown(null);
      setCompanySearchTerms({});
    }
  };

  // Get organization status
  const getOrgStatus = (org: XeroOrganization): 'connected' | 'warning' | 'error' => {
    if (org.display_status === 'connected' || (!org.display_status && org.connected && !org.degraded)) {
      return 'connected';
    }
    if (org.display_status === 'warning' || org.degraded || org.status === 'degraded') {
      return 'warning';
    }
    return 'error';
  };

  // Filter and search organizations
  const filteredOrganizations = useMemo(() => {
    let filtered = organizations;

    // Apply status filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(org => {
        const status = getOrgStatus(org);
        switch (activeFilter) {
          case 'connected': return status === 'connected';
          case 'needs_reauth': return status === 'warning' || status === 'error';
          case 'not_linked': return org.companies.length === 0;
          default: return true;
        }
      });
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(org =>
        org.tenant_name.toLowerCase().includes(query) ||
        org.teeem_tenant_name?.toLowerCase().includes(query) ||
        org.companies.some(c => c.company.name.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [organizations, activeFilter, searchQuery]);

  // Get linked company IDs
  const linkedCompanyIds = useMemo(() =>
    new Set(organizations.flatMap(org => org.companies.map(c => c.company_id))),
    [organizations]
  );

  // Available companies for linking
  const availableCompanies = useMemo(() =>
    companies.filter(c => {
      const belongsToGroup = c.company_group_id != null;
      const isCorporateEntity = ['Company', 'company', 'Trust', 'trust'].includes(c.entity_type || '');
      const hasNoConnection = !linkedCompanyIds.has(c.id);
      return belongsToGroup && isCorporateEntity && hasNoConnection;
    }),
    [companies, linkedCompanyIds]
  );

  // Stats
  const stats = useMemo(() => ({
    total: organizations.length,
    connected: organizations.filter(o => getOrgStatus(o) === 'connected').length,
    needsReauth: organizations.filter(o => getOrgStatus(o) !== 'connected').length,
    notLinked: organizations.filter(o => o.companies.length === 0).length,
  }), [organizations]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg bg-white shadow-xl dark:bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-semibold">Xero Connections</h2>
            <p className="text-sm text-muted-foreground">
              {stats.connected}/{stats.total} connected • {stats.notLinked} not linked
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="border-b p-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Xero orgs, tenants, or companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                activeFilter === 'all'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setActiveFilter('connected')}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                activeFilter === 'connected'
                  ? "bg-green-600 text-white"
                  : "bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              )}
            >
              Connected ({stats.connected})
            </button>
            <button
              onClick={() => setActiveFilter('needs_reauth')}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                activeFilter === 'needs_reauth'
                  ? "bg-orange-600 text-white"
                  : "bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
              )}
            >
              Needs Re-auth ({stats.needsReauth})
            </button>
            <button
              onClick={() => setActiveFilter('not_linked')}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                activeFilter === 'not_linked'
                  ? "bg-gray-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
              )}
            >
              Not Linked ({stats.notLinked})
            </button>
          </div>
        </div>

        {/* Compact Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                {searchQuery ? "No results found" : "No Xero connections"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Xero Organization</th>
                  <th className="text-left py-2 px-3 font-medium">TEEEM Tenant</th>
                  <th className="text-left py-2 px-3 font-medium">Linked Company</th>
                  <th className="text-right py-2 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOrganizations.map((org) => {
                  const status = getOrgStatus(org);
                  const linkedCompany = org.companies[0]; // Show first linked company

                  return (
                    <tr key={org.tenant_id} className="hover:bg-muted/30 text-sm">
                      {/* Status */}
                      <td className="py-2 px-3">
                        {status === 'connected' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : status === 'warning' ? (
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </td>

                      {/* Xero Org Name */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[200px]" title={org.tenant_name}>
                            {org.tenant_name}
                          </span>
                          {org.companies.length === 0 && (
                            <Badge variant="outline" className="text-xs">Not linked</Badge>
                          )}
                          {org.companies.length > 1 && (
                            <Badge variant="secondary" className="text-xs">+{org.companies.length - 1}</Badge>
                          )}
                        </div>
                        {status !== 'connected' && org.message && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 truncate max-w-[200px]" title={org.message}>
                            {org.message}
                          </p>
                        )}
                      </td>

                      {/* Tenant Selector */}
                      <td className="py-2 px-3">
                        {isMasterTenant ? (
                          <div className="relative dropdown-container">
                            <button
                              onClick={() => setOpenTenantDropdown(openTenantDropdown === org.id ? null : org.id)}
                              disabled={assigningOrgId === org.id}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted disabled:opacity-50 min-w-[100px]"
                            >
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[80px]">{org.teeem_tenant_name || "Unassigned"}</span>
                              {assigningOrgId === org.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                            {openTenantDropdown === org.id && (
                              <div className="absolute z-50 mt-1 w-40 rounded border bg-white shadow-lg dark:bg-card">
                                {availableTenants.map((tenant) => (
                                  <button
                                    key={tenant.id}
                                    onClick={() => handleAssignTenant(org.id, tenant.id)}
                                    className={cn(
                                      "w-full px-3 py-1.5 text-left text-xs hover:bg-muted",
                                      org.teeem_tenant_id === tenant.id && "bg-primary/10 text-primary"
                                    )}
                                  >
                                    {tenant.name} {tenant.is_master && "(Master)"}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {org.teeem_tenant_name || "—"}
                          </span>
                        )}
                      </td>

                      {/* Linked Company */}
                      <td className="py-2 px-3">
                        {linkedCompany ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs truncate max-w-[150px]" title={linkedCompany.company.name}>
                              {linkedCompany.company.name}
                            </span>
                          </div>
                        ) : availableCompanies.length > 0 ? (
                          <div className="relative dropdown-container">
                            <button
                              onClick={() => setOpenCompanyDropdown(openCompanyDropdown === org.tenant_id ? null : org.tenant_id)}
                              disabled={linkingTenantId === org.tenant_id}
                              className="text-xs text-primary hover:underline disabled:opacity-50"
                            >
                              {linkingTenantId === org.tenant_id ? "Linking..." : "+ Link company"}
                            </button>
                            {openCompanyDropdown === org.tenant_id && (
                              <div className="absolute z-50 mt-1 w-56 rounded border bg-white shadow-lg dark:bg-card">
                                <div className="p-2 border-b">
                                  <Input
                                    placeholder="Search companies..."
                                    value={companySearchTerms[org.tenant_id] || ""}
                                    onChange={(e) => setCompanySearchTerms({ ...companySearchTerms, [org.tenant_id]: e.target.value })}
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div className="max-h-40 overflow-y-auto">
                                  {availableCompanies
                                    .filter(c => c.name.toLowerCase().includes((companySearchTerms[org.tenant_id] || "").toLowerCase()))
                                    .slice(0, 20)
                                    .map((company) => (
                                      <button
                                        key={company.id}
                                        onClick={() => handleLinkCompany(org.tenant_id, company.id)}
                                        className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted truncate"
                                      >
                                        {company.name}
                                      </button>
                                    ))}
                                  {availableCompanies.filter(c =>
                                    c.name.toLowerCase().includes((companySearchTerms[org.tenant_id] || "").toLowerCase())
                                  ).length === 0 && (
                                    <p className="px-3 py-2 text-xs text-muted-foreground">No companies found</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">All linked</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-right">
                        {status !== 'connected' && (
                          <button
                            onClick={handleConnectToXero}
                            className="text-xs text-orange-600 hover:underline dark:text-orange-400"
                          >
                            Re-auth
                          </button>
                        )}
                        {linkedCompany && (
                          <button
                            onClick={() => {
                              window.location.href = `/corporate/companies/${linkedCompany.company_id}/xero`;
                              onClose();
                            }}
                            className="text-xs text-primary hover:underline ml-2"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {filteredOrganizations.length} of {organizations.length} organizations
          </span>
          <div className="flex gap-2">
            <button
              onClick={loadConnections}
              className="flex items-center gap-1 rounded border px-3 py-1.5 text-xs hover:bg-muted"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
            <button
              onClick={handleConnectToXero}
              className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
            >
              <Building2 className="h-3 w-3" />
              Connect New
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
