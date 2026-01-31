"use client";

import React, { useEffect, useState } from "react";
import { X, CheckCircle, XCircle, RefreshCw, Building2, Calendar, ArrowRight, AlertTriangle, ChevronDown, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

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
  // SSoT: Unified status from XeroConnectionHealth service
  display_status?: 'connected' | 'warning' | 'error' | 'disconnected';
  last_sync_at?: string;
  days_since_last_sync?: number;
}

interface XeroOrganization {
  id: number;  // Credential ID for updating
  tenant_id: string;
  tenant_name: string;
  connected: boolean;
  expired: boolean;
  expires_at: string;
  status?: string; // 'connected' | 'degraded' | 'disconnected'
  degraded?: boolean;
  // SSoT: Unified status from XeroConnectionHealth service
  display_status?: 'connected' | 'warning' | 'error' | 'disconnected';
  message?: string;
  needs_attention?: boolean;
  action_required?: string;
  companies: CompanyLink[];
  // Multi-tenancy: Which TEEEM tenant owns this Xero org
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

export function XeroConnectionsPopup({ isOpen, onClose }: XeroConnectionsPopupProps) {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<XeroOrganization[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [availableTenants, setAvailableTenants] = useState<TeeemTenant[]>([]);
  const [isMasterTenant, setIsMasterTenant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linkingTenantId, setLinkingTenantId] = useState<string | null>(null);
  const [assigningOrgId, setAssigningOrgId] = useState<number | null>(null);
  const [openDropdownTenantId, setOpenDropdownTenantId] = useState<string | null>(null);
  const [openTenantDropdownId, setOpenTenantDropdownId] = useState<number | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      loadConnections();
      loadCompanies();
    }
  }, [isOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.combobox-container')) {
        if (openDropdownTenantId) setOpenDropdownTenantId(null);
        if (openTenantDropdownId) setOpenTenantDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownTenantId, openTenantDropdownId]);

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
      }>(
        "/api/v1/company_xero_connections"
      );
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

      if (response && response.success) {
        await loadConnections();
        toast({ title: "Success", description: response.message });
      }
    } catch (error) {
      console.error("Failed to assign tenant:", error);
      toast({ title: "Error", description: "Failed to assign tenant. Please try again.", variant: "destructive" });
    } finally {
      setAssigningOrgId(null);
      setOpenTenantDropdownId(null);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get<{ success: boolean; companies: Company[] }>(
        "/api/v1/companies"
      );
      setCompanies(response.companies || []);
    } catch (error) {
      console.error("Failed to load companies:", error);
    }
  };

  const handleConnectToXero = async () => {
    try {
      const response = await api.xero.getAuthUrl();
      if (response.success && response.auth_url) {
        // Redirect to Xero OAuth page
        window.location.href = response.auth_url;
      }
    } catch (error) {
      console.error("Failed to get Xero auth URL:", error);
      toast({ title: "Error", description: "Failed to connect to Xero. Please try again.", variant: "destructive" });
    }
  };

  const handleLinkCompany = async (tenantId: string, companyId: number) => {
    try {
      setLinkingTenantId(tenantId);
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/companies/${companyId}/xero/link`,
        { tenant_id: tenantId }
      );

      if (response && response.success) {
        // Reload connections to show the new link
        await loadConnections();
        toast({ title: "Success", description: "Successfully linked company to Xero organization" });
      }
    } catch (error) {
      console.error("Failed to link company:", error);
      toast({ title: "Error", description: "Failed to link company. Please try again.", variant: "destructive" });
    } finally {
      setLinkingTenantId(null);
    }
  };

  if (!isOpen) return null;

  const totalOrgs = organizations.length;
  const connectedOrgs = organizations.filter((o) => o.connected).length;
  const totalCompanies = organizations.reduce((sum, org) => sum + org.companies.length, 0);
  const connectedCompanies = organizations.reduce((sum, org) =>
    sum + org.companies.filter((c) => c.connected).length, 0
  );

  // Get list of company IDs that already have Xero connections
  const linkedCompanyIds = new Set(
    organizations.flatMap(org => org.companies.map(c => c.company_id))
  );

  // Show ONLY corporate entities that belong to a Company Group
  const availableCompanies = companies.filter(c => {
    // Only include companies that:
    // 1. Belong to a Company Group (company_group_id != null) - excludes suppliers/vendors
    // 2. Are corporate entities (entity_type = "Company", "company", "Trust", or "trust")
    // 3. Don't already have a Xero connection
    const belongsToGroup = c.company_group_id != null;
    const isCorporateEntity =
      c.entity_type === "Company" ||
      c.entity_type === "company" ||
      c.entity_type === "Trust" ||
      c.entity_type === "trust";
    const hasNoConnection = !linkedCompanyIds.has(c.id);
    return belongsToGroup && isCorporateEntity && hasNoConnection;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-lg bg-white shadow-xl dark:bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 dark:border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground dark:text-white">
              Xero Connections
            </h2>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              {connectedOrgs} of {totalOrgs} Xero organizations • {connectedCompanies} of {totalCompanies} companies connected
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-muted dark:hover:bg-muted"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto overflow-x-hidden p-4 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500 dark:text-blue-400" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground dark:text-muted-foreground">
                No Xero connections found
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {organizations.map((org) => (
                <div
                  key={org.tenant_id}
                  className="rounded-lg border border-border bg-muted dark:border-border dark:bg-background"
                >
                  {/* Xero Organization Header */}
                  <div className="border-b border-border bg-white p-3 dark:border-border dark:bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {/* Organization Status - SSoT: Uses display_status from backend */}
                        <div className="relative">
                          {(org.display_status === 'connected' || (!org.display_status && org.connected)) ? (
                            <>
                              <CheckCircle className="h-6 w-6 text-green-500 dark:text-green-400" />
                              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-border" />
                            </>
                          ) : (org.display_status === 'warning' || org.degraded || org.status === 'degraded') ? (
                            <>
                              <AlertTriangle className="h-6 w-6 text-orange-500 dark:text-orange-400" />
                              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-orange-500 border-2 border-white dark:border-border" />
                            </>
                          ) : (
                            <>
                              <XCircle className="h-6 w-6 text-red-500 dark:text-red-400" />
                              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white dark:border-border" />
                            </>
                          )}
                        </div>

                        {/* Organization Name */}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-foreground dark:text-white">
                              {org.tenant_name}
                            </span>
                            {org.companies.length === 0 && (
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground dark:bg-muted dark:text-muted-foreground">
                                Not linked
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                            Xero Organization {org.companies.length > 0 && `• ${org.companies.length} ${org.companies.length === 1 ? 'company' : 'companies'}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        {/* Multi-tenancy: Tenant Assignment (Master only can edit) */}
                        <div className="relative">
                          {isMasterTenant ? (
                            <div className="combobox-container">
                              <button
                                onClick={() => setOpenTenantDropdownId(openTenantDropdownId === org.id ? null : org.id)}
                                disabled={assigningOrgId === org.id}
                                className="flex items-center space-x-2 rounded-md border border-border bg-muted px-2 py-1 text-sm hover:bg-accent dark:border-border dark:bg-muted dark:hover:bg-accent disabled:opacity-50"
                              >
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-foreground dark:text-white">
                                  {org.teeem_tenant_name || "Unassigned"}
                                </span>
                                {assigningOrgId === org.id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </button>
                              {openTenantDropdownId === org.id && (
                                <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-border bg-white shadow-lg dark:border-border dark:bg-card">
                                  {availableTenants.map((tenant) => (
                                    <button
                                      key={tenant.id}
                                      onClick={() => handleAssignTenant(org.id, tenant.id)}
                                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted dark:hover:bg-accent ${
                                        org.teeem_tenant_id === tenant.id
                                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                          : 'text-foreground dark:text-white'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span>{tenant.name}</span>
                                        {tenant.is_master && (
                                          <span className="text-xs text-muted-foreground">(Master)</span>
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : org.teeem_tenant_name ? (
                            <div className="flex items-center space-x-2 rounded-md bg-muted px-2 py-1 text-sm dark:bg-muted">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-foreground dark:text-white">{org.teeem_tenant_name}</span>
                            </div>
                          ) : null}
                        </div>

                        {/* Connection Status */}
                        <div className="text-right">
                          {org.companies.length > 0 ? (
                            <>
                              {/* SSoT: Use display_status to determine company connection counts */}
                              <span className={`text-sm font-medium ${
                                org.companies.every(c => c.display_status === 'connected' || (!c.display_status && c.connected))
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-orange-600 dark:text-orange-400'
                              }`}>
                                {org.companies.filter(c => c.display_status === 'connected' || (!c.display_status && c.connected)).length} / {org.companies.length}
                              </span>
                              <p className="text-xs text-muted-foreground dark:text-muted-foreground">linked</p>
                            </>
                          ) : (
                            /* SSoT: Use display_status from backend */
                            <span className={`text-sm font-medium ${
                              (org.display_status === 'connected' || (!org.display_status && org.connected)) ? 'text-green-600 dark:text-green-400' :
                              (org.display_status === 'warning' || org.degraded || org.status === 'degraded') ? 'text-orange-600 dark:text-orange-400' :
                              'text-red-600 dark:text-red-400'
                            }`}>
                              {(org.display_status === 'connected' || (!org.display_status && org.connected)) ? 'Connected' :
                              (org.display_status === 'warning' || org.degraded || org.status === 'degraded') ? 'Needs Re-auth' :
                              org.message || 'Disconnected'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Message Row (if there's a message to display) */}
                    {org.message && org.display_status !== 'connected' && (
                      <div className="mt-2 flex items-center space-x-2 rounded-md bg-orange-50 px-3 py-2 text-sm dark:bg-orange-900/20">
                        <AlertTriangle className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                        <span className="text-orange-700 dark:text-orange-300">{org.message}</span>
                        {org.action_required && (
                          <span className="text-xs text-orange-600 dark:text-orange-400">• {org.action_required}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Linked TEEEM Companies */}
                  <div className="p-3 space-y-2">
                    {org.companies.length > 0 ? (
                      org.companies.map((connection) => (
                        <div
                          key={connection.id}
                          className="flex items-center justify-between rounded-md bg-white p-3 dark:bg-card"
                        >
                          <div className="flex items-center space-x-3 flex-1">
                            {/* Company Status - SSoT: Uses display_status from backend */}
                            <div>
                              {(connection.display_status === 'connected' || (!connection.display_status && connection.connected)) ? (
                                <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                              ) : connection.display_status === 'warning' ? (
                                <AlertTriangle className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                              )}
                            </div>

                            {/* Arrow */}
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />

                            {/* TEEEM Company Name */}
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground dark:text-white">
                                  {connection.company.name}
                                </span>
                              </div>
                              {connection.last_sync_at && (
                                <div className="mt-0.5 flex items-center space-x-1 text-xs text-muted-foreground dark:text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    Last sync: {new Date(connection.last_sync_at).toLocaleDateString()}
                                    {connection.days_since_last_sync !== undefined &&
                                      ` (${connection.days_since_last_sync}d ago)`}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* View Button */}
                            <button
                              onClick={() => {
                                window.location.href = `/corporate/companies/${connection.company_id}/xero`;
                                onClose();
                              }}
                              className="whitespace-nowrap rounded-md border border-border bg-white px-3 py-1 text-xs font-medium text-foreground hover:bg-muted dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-accent"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md bg-white p-4 dark:bg-card">
                        <p className="mb-3 text-sm text-muted-foreground dark:text-muted-foreground">
                          No TEEEM companies linked to this organization yet.
                        </p>
                        {availableCompanies.length > 0 ? (
                          <div className="space-y-2 relative combobox-container">
                            <input
                              type="text"
                              placeholder="Search and select a company..."
                              value={searchTerms[org.tenant_id] || ""}
                              onChange={(e) => {
                                setSearchTerms({ ...searchTerms, [org.tenant_id]: e.target.value });
                                setOpenDropdownTenantId(org.tenant_id);
                              }}
                              onFocus={() => setOpenDropdownTenantId(org.tenant_id)}
                              disabled={linkingTenantId === org.tenant_id}
                              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            {openDropdownTenantId === org.tenant_id && (
                              <div className="absolute z-[100] mt-1 w-full max-h-60 overflow-auto rounded-md border border-border bg-white shadow-lg dark:border-border dark:bg-muted">
                                {availableCompanies
                                  .filter(company =>
                                    company.name.toLowerCase().includes((searchTerms[org.tenant_id] || "").toLowerCase())
                                  )
                                  .map((company) => (
                                    <button
                                      key={company.id}
                                      onClick={() => {
                                        handleLinkCompany(org.tenant_id, company.id);
                                        setOpenDropdownTenantId(null);
                                        setSearchTerms({ ...searchTerms, [org.tenant_id]: "" });
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-accent text-foreground dark:text-white"
                                    >
                                      {company.name}
                                    </button>
                                  ))}
                                {availableCompanies.filter(company =>
                                  company.name.toLowerCase().includes((searchTerms[org.tenant_id] || "").toLowerCase())
                                ).length === 0 && (
                                  <div className="px-3 py-2 text-sm text-muted-foreground dark:text-muted-foreground">
                                    No companies found
                                  </div>
                                )}
                              </div>
                            )}
                            {linkingTenantId === org.tenant_id && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                Linking company...
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                            All companies already have Xero connections.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 dark:border-border">
          <div className="flex gap-3">
            <button
              onClick={handleConnectToXero}
              className="flex flex-1 items-center justify-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <Building2 className="h-4 w-4" />
              <span>Connect to Xero</span>
            </button>
            <button
              onClick={loadConnections}
              className="flex items-center justify-center rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-muted dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-accent"
              title="Refresh connection data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
