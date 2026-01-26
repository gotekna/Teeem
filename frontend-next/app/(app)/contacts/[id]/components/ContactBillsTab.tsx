"use client";

import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { XeroInvoicesListByTenant } from "@/components/contacts/XeroInvoicesListByTenant";
import type { Contact } from "../types";
import type { XeroLink } from "./ContactHeader";

// =============================================================================
// SSoT: Bills Tab (ROOT level)
// =============================================================================
// Shows ALL bills from ALL Xero connections for this contact.
// This is the primary access point for viewing supplier bills.
// Visibility: has_xero_links (only shown when contact has Xero connections)
// =============================================================================

interface ContactBillsTabProps {
  contact: Contact;
  xeroLinks: XeroLink[];
  handleViewInvoiceDetail: (invoiceId: string) => void;
}

export function ContactBillsTab({
  contact,
  xeroLinks,
  handleViewInvoiceDetail,
}: ContactBillsTabProps) {
  const hasXeroLinks = xeroLinks.length > 0;

  if (!hasXeroLinks) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-2">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No Xero connections found for this contact.
            </p>
            <p className="text-sm text-muted-foreground">
              Link this contact to Xero to view bills.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Bills
          {xeroLinks.length > 1 && (
            <Badge variant="outline" className="text-xs">
              {xeroLinks.length} Xero connections
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <XeroInvoicesListByTenant
          contactId={contact.id}
          type="ACCPAY"
          onViewInvoiceDetail={handleViewInvoiceDetail}
          linkedTenants={xeroLinks}
        />
      </CardContent>
    </Card>
  );
}

export default ContactBillsTab;
