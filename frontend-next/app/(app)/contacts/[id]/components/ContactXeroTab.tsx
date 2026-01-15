"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, FileText, Receipt } from "lucide-react";
import { XeroInvoicesListByTenant } from "@/components/contacts/XeroInvoicesListByTenant";
import { XeroLink } from "./ContactHeader";

interface ContactXeroTabProps {
  contact: {
    id: number;
    display_name: string;
  };
  xeroLinks: XeroLink[];
  onViewInvoiceDetail?: (invoiceId: string) => void;
}

/**
 * ContactXeroTab - SSoT: Shows all linked Xero companies with Invoices/Bills under each
 *
 * Structure:
 * - Tab for each linked Xero company (e.g., "Tekna Admin", "Tekna Drafting")
 * - Under each company: Invoices and Bills sub-tabs
 *
 * visibility_rule: "Has Primary Xero links" - only shows if xeroLinks.length > 0
 */
export function ContactXeroTab({
  contact,
  xeroLinks,
  onViewInvoiceDetail,
}: ContactXeroTabProps) {
  // Get unique tenants from xeroLinks
  const uniqueTenants = useMemo(() => {
    const seen = new Set<string>();
    return xeroLinks.filter((link) => {
      if (seen.has(link.xero_tenant_id)) return false;
      seen.add(link.xero_tenant_id);
      return true;
    });
  }, [xeroLinks]);

  // Active company tab
  const [activeCompany, setActiveCompany] = useState<string>(
    uniqueTenants[0]?.xero_tenant_id || ""
  );

  // Active sub-tab within company (invoices or bills)
  const [activeSubTab, setActiveSubTab] = useState<string>("invoices");

  if (xeroLinks.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">
            This contact is not linked to any Xero accounts.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Single company - show invoices/bills directly without company tabs
  if (uniqueTenants.length === 1) {
    const tenant = uniqueTenants[0];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{tenant.xero_tenant_name}</span>
          <Badge variant="outline" className="text-xs">Xero Linked</Badge>
        </div>

        <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
          <TabsList>
            <TabsTrigger value="invoices">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="bills">
              <Receipt className="h-3.5 w-3.5 mr-1" />
              Bills
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="mt-4">
            <XeroInvoicesListByTenant
              contactId={contact.id}
              type="ACCREC"
              onViewInvoiceDetail={onViewInvoiceDetail}
              linkedTenants={[tenant]}
            />
          </TabsContent>

          <TabsContent value="bills" className="mt-4">
            <XeroInvoicesListByTenant
              contactId={contact.id}
              type="ACCPAY"
              onViewInvoiceDetail={onViewInvoiceDetail}
              linkedTenants={[tenant]}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Multiple companies - show company tabs with invoices/bills under each
  return (
    <Tabs value={activeCompany} onValueChange={setActiveCompany}>
      <TabsList className="mb-4">
        {uniqueTenants.map((tenant) => (
          <TabsTrigger key={tenant.xero_tenant_id} value={tenant.xero_tenant_id}>
            <Building2 className="h-3.5 w-3.5 mr-1" />
            {tenant.xero_tenant_name}
          </TabsTrigger>
        ))}
      </TabsList>

      {uniqueTenants.map((tenant) => (
        <TabsContent key={tenant.xero_tenant_id} value={tenant.xero_tenant_id}>
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
            <TabsList>
              <TabsTrigger value="invoices">
                <FileText className="h-3.5 w-3.5 mr-1" />
                Invoices
              </TabsTrigger>
              <TabsTrigger value="bills">
                <Receipt className="h-3.5 w-3.5 mr-1" />
                Bills
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invoices" className="mt-4">
              <XeroInvoicesListByTenant
                contactId={contact.id}
                type="ACCREC"
                onViewInvoiceDetail={onViewInvoiceDetail}
                linkedTenants={[tenant]}
              />
            </TabsContent>

            <TabsContent value="bills" className="mt-4">
              <XeroInvoicesListByTenant
                contactId={contact.id}
                type="ACCPAY"
                onViewInvoiceDetail={onViewInvoiceDetail}
                linkedTenants={[tenant]}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      ))}
    </Tabs>
  );
}
