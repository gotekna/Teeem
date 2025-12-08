"use client";

import React, { useEffect, useState } from "react";
import { X, CheckCircle, XCircle, RefreshCw, Building2, Calendar, Star, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

interface XeroConnection {
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
  last_sync_at?: string;
  days_since_last_sync?: number;
}

interface XeroOrganization {
  tenant_id: string;
  tenant_name: string;
  companies: XeroConnection[];
  allConnected: boolean;
}

interface XeroConnectionsPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function XeroConnectionsPopup({ isOpen, onClose }: XeroConnectionsPopupProps) {
  const [connections, setConnections] = useState<XeroConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadConnections();
    }
  }, [isOpen]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; connections: XeroConnection[] }>(
        "/api/v1/company_xero_connections"
      );
      setConnections(response.connections || []);
    } catch (error) {
      console.error("Failed to load Xero connections:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Group connections by Xero organization
  const organizations: XeroOrganization[] = [];
  const organizationMap = new Map<string, XeroOrganization>();

  connections.forEach((connection) => {
    if (!organizationMap.has(connection.xero_tenant_id)) {
      const org: XeroOrganization = {
        tenant_id: connection.xero_tenant_id,
        tenant_name: connection.xero_tenant_name,
        companies: [],
        allConnected: true,
      };
      organizationMap.set(connection.xero_tenant_id, org);
      organizations.push(org);
    }

    const org = organizationMap.get(connection.xero_tenant_id)!;
    org.companies.push(connection);
    if (!connection.connected) {
      org.allConnected = false;
    }
  });

  const totalOrgs = organizations.length;
  const connectedOrgs = organizations.filter((o) => o.allConnected).length;
  const totalCompanies = connections.length;
  const connectedCompanies = connections.filter((c) => c.connected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Xero Connections
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {connectedOrgs} of {totalOrgs} Xero organizations • {connectedCompanies} of {totalCompanies} companies connected
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(85vh - 140px)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                No Xero connections found
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {organizations.map((org) => (
                <div
                  key={org.tenant_id}
                  className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
                >
                  {/* Xero Organization Header */}
                  <div className="flex items-center justify-between border-b border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center space-x-3">
                      {/* Organization Status */}
                      <div className="relative">
                        {org.allConnected ? (
                          <>
                            <CheckCircle className="h-6 w-6 text-green-500" />
                            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-800" />
                          </>
                        ) : (
                          <>
                            <XCircle className="h-6 w-6 text-orange-500" />
                            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-orange-500 border-2 border-white dark:border-gray-800" />
                          </>
                        )}
                      </div>

                      {/* Organization Name */}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {org.tenant_name}
                          </span>
                          {org.companies.length === 1 && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              <Star className="mr-1 h-3 w-3" />
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Xero Organization • {org.companies.length} {org.companies.length === 1 ? 'company' : 'companies'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-sm font-medium ${org.allConnected ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        {org.companies.filter(c => c.connected).length} / {org.companies.length}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">connected</p>
                    </div>
                  </div>

                  {/* Linked TEEEM Companies */}
                  <div className="p-3 space-y-2">
                    {org.companies.map((connection) => (
                      <div
                        key={connection.id}
                        className="flex items-center justify-between rounded-md bg-white p-3 dark:bg-gray-800"
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          {/* Company Status */}
                          <div>
                            {connection.connected ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>

                          {/* Arrow */}
                          <ArrowRight className="h-4 w-4 text-gray-400" />

                          {/* TEEEM Company Name */}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {connection.company.name}
                              </span>
                            </div>
                            {connection.last_sync_at && (
                              <div className="mt-0.5 flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
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
                              window.location.href = `/corporate/companies/${connection.company_id}?tab=xero`;
                              onClose();
                            }}
                            className="whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            onClick={loadConnections}
            className="flex w-full items-center justify-center space-x-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh Connections</span>
          </button>
        </div>
      </div>
    </div>
  );
}
