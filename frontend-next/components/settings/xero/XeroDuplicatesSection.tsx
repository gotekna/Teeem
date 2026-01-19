"use client";

import { useGetXeroDuplicates, XeroDuplicateGroup } from "@/lib/hooks/useDuplicateContacts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Building2,
  Link2,
  Unlink,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";

function XeroDuplicateGroupCard({ group }: { group: XeroDuplicateGroup }) {
  const [expanded, setExpanded] = useState(true);

  // Count linked vs unlinked
  const linkedCount = group.xero_contacts.filter(c => c.has_teeem_link).length;
  const unlinkedCount = group.xero_contacts.length - linkedCount;
  const totalInvoices = group.xero_contacts.reduce((sum, c) => sum + c.invoice_count, 0);
  const totalAmount = group.xero_contacts.reduce((sum, c) => sum + c.total_amount, 0);

  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 hover:opacity-80"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-base">
              "{group.base_name}..." variations
            </CardTitle>
            <Badge variant="outline" className="ml-2">
              {group.variation_count} contacts
            </Badge>
          </button>
          <div className="flex items-center gap-2">
            <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
              {group.tenant_name}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://go.xero.com/app/contacts", "_blank")}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open Xero
            </Button>
          </div>
        </div>
        <CardDescription className="mt-1">
          {totalInvoices} invoices totaling {formatCurrency(totalAmount)}
          {unlinkedCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400 ml-2">
              ({unlinkedCount} not linked to TEEEM)
            </span>
          )}
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {group.xero_contacts.map((contact, idx) => (
              <div
                key={contact.xero_id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  contact.has_teeem_link
                    ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                    : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded",
                    contact.has_teeem_link ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"
                  )}>
                    <Building2 className={cn(
                      "h-4 w-4",
                      contact.has_teeem_link ? "text-green-600" : "text-red-600"
                    )} />
                  </div>
                  <div>
                    <div className="font-medium">{contact.xero_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {contact.invoice_count} invoices = {formatCurrency(contact.total_amount)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {contact.has_teeem_link ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <Link2 className="h-3 w-3 mr-1" />
                      {contact.teeem_contact_name}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <Unlink className="h-3 w-3 mr-1" />
                      Not Linked
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Alert className="mt-4 border-amber-300 bg-amber-100/50 dark:bg-amber-900/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>Action Required:</strong> Merge these contacts in Xero to consolidate invoices under one contact.
              After merging, run a Xero sync to update TEEEM.
            </AlertDescription>
          </Alert>
        </CardContent>
      )}
    </Card>
  );
}

export function XeroDuplicatesSection() {
  const { data, isLoading, error } = useGetXeroDuplicates();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load Xero duplicates: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const groups = data?.data?.groups || [];

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/30">
        <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
        <h3 className="text-base font-semibold">No Xero Duplicates Found</h3>
        <p className="text-sm text-muted-foreground mt-1">
          All Xero contacts appear to be unique within each tenant.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">Xero Duplicates</h3>
          <p className="text-sm text-muted-foreground">
            These are potential duplicate contacts <strong>within Xero</strong> that should be merged in Xero.
          </p>
        </div>
        <Badge variant="destructive">
          {groups.length} group{groups.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xl font-bold">{groups.length}</div>
          <div className="text-xs text-muted-foreground">Duplicate Groups</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xl font-bold">
            {groups.reduce((sum, g) => sum + g.xero_contacts.length, 0)}
          </div>
          <div className="text-xs text-muted-foreground">Total Contacts</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xl font-bold text-amber-600">
            {groups.reduce((sum, g) => sum + g.xero_contacts.filter(c => !c.has_teeem_link).length, 0)}
          </div>
          <div className="text-xs text-muted-foreground">Not Linked</div>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {groups.map((group, idx) => (
          <XeroDuplicateGroupCard key={`${group.tenant_id}-${group.base_name}-${idx}`} group={group} />
        ))}
      </div>
    </div>
  );
}
