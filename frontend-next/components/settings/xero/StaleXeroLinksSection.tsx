"use client";

import {
  useGetStaleXeroLinks,
  useDeleteStaleXeroLink,
  StaleXeroLink,
} from "@/lib/hooks/useDuplicateContacts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Trash2,
  FileText,
  Ghost,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { useToast } from "@/components/ui/use-toast";

function StaleXeroLinkCard({ link }: { link: StaleXeroLink }) {
  const [expanded, setExpanded] = useState(true);
  const { toast } = useToast();
  const deleteLink = useDeleteStaleXeroLink();

  const handleDelete = async () => {
    try {
      await deleteLink.mutateAsync(link.link_id);
      toast({
        title: "Link Deleted",
        description: "Remember to update the invoices in Xero to prevent this from reappearing.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete link",
        variant: "destructive",
      });
    }
  };

  const totalAmount = link.invoices.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/10 dark:border-red-800">
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
            <Ghost className="h-5 w-5 text-red-500" />
            <CardTitle className="text-base">
              {link.xero_contact_name}
            </CardTitle>
            <Badge variant="destructive" className="ml-2">
              Merged/Deleted
            </Badge>
          </button>
          <div className="flex items-center gap-2">
            {link.tenant_name && (
              <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                {link.tenant_name}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://go.xero.com/app/invoices", "_blank")}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open Xero
            </Button>
          </div>
        </div>
        <CardDescription className="mt-1">
          <span className="text-red-600 dark:text-red-400">
            {link.sync_error || "Contact no longer exists in Xero"}
          </span>
          {link.teeem_contact_name && (
            <span className="ml-2">
              (was linked to: {link.teeem_contact_name})
            </span>
          )}
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {/* Invoice List */}
          {link.invoices.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                <FileText className="h-4 w-4 inline mr-1" />
                {link.invoice_count} invoice{link.invoice_count !== 1 ? "s" : ""} referencing this contact:
              </div>
              <div className="bg-white dark:bg-background rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Invoice #</th>
                      <th className="text-left p-2 font-medium">Contact Name</th>
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {link.invoices.map((invoice, idx) => (
                      <tr key={idx} className={cn(idx < link.invoices.length - 1 && "border-b")}>
                        <td className="p-2 font-mono text-xs">{invoice.number || "-"}</td>
                        <td className="p-2">{invoice.contact_name}</td>
                        <td className="p-2">{formatDate(invoice.date)}</td>
                        <td className="p-2 text-right">{formatCurrency(invoice.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/30">
                    <tr>
                      <td colSpan={3} className="p-2 font-medium">Total</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No invoices found referencing this contact.
            </div>
          )}

          <Alert className="mt-4 border-red-300 bg-red-100/50 dark:bg-red-900/20">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              <strong>Action Required:</strong> Open these invoices in Xero and change the contact to the merged contact.
              Once done, click "Delete Link" to remove this stale reference from TEEEM.
            </AlertDescription>
          </Alert>

          <div className="mt-4 flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteLink.isPending}
            >
              {deleteLink.isPending ? (
                <Spinner size={14} className="mr-1" />
              ) : (
                <Trash2 className="h-3 w-3 mr-1" />
              )}
              Delete Link
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function StaleXeroLinksSection() {
  const { data, isLoading, error } = useGetStaleXeroLinks();

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
          Failed to load stale Xero links: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const staleLinks = data?.data?.stale_links || [];

  if (staleLinks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/30">
        <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
        <h3 className="text-base font-semibold">No Stale Links Found</h3>
        <p className="text-sm text-muted-foreground mt-1">
          All Xero contact links are valid and active.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">Stale Xero Contacts</h3>
          <p className="text-sm text-muted-foreground">
            These Xero contacts were merged or deleted, but invoices still reference them.
            Update the invoices in Xero to point to the correct contact.
          </p>
        </div>
        <Badge variant="destructive">
          {staleLinks.length} stale link{staleLinks.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xl font-bold text-red-600">{staleLinks.length}</div>
          <div className="text-xs text-muted-foreground">Stale Links</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xl font-bold">
            {staleLinks.reduce((sum, l) => sum + l.invoice_count, 0)}
          </div>
          <div className="text-xs text-muted-foreground">Affected Invoices</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xl font-bold">
            {formatCurrency(
              staleLinks.reduce(
                (sum, l) => sum + l.invoices.reduce((s, i) => s + i.total, 0),
                0
              )
            )}
          </div>
          <div className="text-xs text-muted-foreground">Total Amount</div>
        </div>
      </div>

      {/* Links */}
      <div className="space-y-4">
        {staleLinks.map((link) => (
          <StaleXeroLinkCard key={link.link_id} link={link} />
        ))}
      </div>
    </div>
  );
}
