"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Users,
  Building2,
  Mail,
  Hash,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";

interface TenantLink {
  tenant_id: string;
  tenant_name: string;
  external_contact_id: string;
  external_contact_name: string;
  match_type: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
}

interface CommonContact {
  id: number;
  display_name: string;
  entity_type: string;
  email: string | null;
  abn: string | null;
  tenant_count: number;
  tenants: TenantLink[];
}

interface CommonContactsResponse {
  success: boolean;
  data: {
    total_count: number;
    contacts: CommonContact[];
  };
  error?: string;
}

export function XeroCommonContacts() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [contacts, setContacts] = React.useState<CommonContact[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);

  const fetchCommonContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<CommonContactsResponse>("/api/v1/xero/common_contacts");
      if (response.success && response.data) {
        setContacts(response.data.contacts);
        setTotalCount(response.data.total_count);
      } else {
        setError(response.error || "Failed to fetch common contacts");
      }
    } catch (err) {
      console.error("Error fetching common contacts:", err);
      setError("Failed to fetch common contacts");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCommonContacts();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={fetchCommonContacts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Common Contacts
              </CardTitle>
              <CardDescription>
                Contacts linked to multiple Xero organizations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 hover:bg-purple-100">
                {totalCount} {totalCount === 1 ? 'Contact' : 'Contacts'}
              </Badge>
              <Button variant="ghost" size="sm" onClick={fetchCommonContacts}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No contacts are linked to multiple Xero organizations yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                When contacts are matched across Xero companies, they will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  {/* Contact Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        {contact.entity_type === 'company' ? (
                          <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{contact.display_name}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {contact.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </span>
                          )}
                          {contact.abn && (
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              ABN: {contact.abn}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 hover:bg-purple-100">
                      {contact.tenant_count} Xero Orgs
                    </Badge>
                  </div>

                  {/* Linked Tenants */}
                  <div className="pl-12 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Linked Xero Organizations
                    </p>
                    <div className="grid gap-2">
                      {contact.tenants.map((tenant) => (
                        <div
                          key={tenant.tenant_id}
                          className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{tenant.tenant_name}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-muted-foreground">{tenant.external_contact_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {tenant.match_type && (
                              <Badge variant="outline" className="text-xs">
                                {tenant.match_type.replace('_', ' ')}
                              </Badge>
                            )}
                            {tenant.sync_enabled ? (
                              <Badge className="bg-status-success text-status-success-foreground hover:bg-green-100 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Syncing
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Sync Disabled
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
