"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow as TableRowType } from "@/components/table/types";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  FileText,
  Star,
  Users,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { XeroLinkToContactSheet } from "./XeroLinkToContactSheet";
import { clearCachedRecords } from "@/lib/records-cache";

// TenantStats interface matching XeroSyncStats
interface TenantContactStats {
  total_links: number;
  sync_enabled: number;
  pending_review: number;
  with_errors: number;
  cross_tenant_matches: number;
  last_synced_at: string | null;
}

interface TenantDocStats {
  invoices: number;
  bills: number;
  quotes: number;
  credit_notes: number;
  total: number;
  last_synced_at: string | null;
}

interface TenantStats {
  tenant_id: string;
  tenant_name: string;
  status: string;
  is_primary: boolean;
  contacts: TenantContactStats;
  documents: TenantDocStats;
}

// Type for selected row data for the link sheet
interface SelectedRowForLinkSheet {
  xeroName: string;
  xeroId: string | null;
  xeroTenantId: string | null;
  xeroTenantName: string | null;
  xeroLinkId: number | null;
  currentContactId: number | null;
  currentContactName: string | null;
  currentEntityType: string | null;
  synced: boolean;
  matchConfidence: number | null;
}

interface XeroOrgContactsDrilldownSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: TenantStats[];
  totalContacts: number;
  onLinkChanged?: () => void;
}

export function XeroOrgContactsDrilldownSheet({
  isOpen,
  onClose,
  tenants,
  totalContacts,
  onLinkChanged,
}: XeroOrgContactsDrilldownSheetProps) {
  const router = useRouter();

  // Selected tenant for drilldown (null = show org list)
  const [selectedTenant, setSelectedTenant] = React.useState<TenantStats | null>(null);

  // State for Xero link management sheet
  const [showLinkSheet, setShowLinkSheet] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<SelectedRowForLinkSheet | null>(null);

  // Refresh key for table
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Reset selection when sheet closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedTenant(null);
      setShowLinkSheet(false);
      setSelectedRow(null);
    }
  }, [isOpen]);

  // Handle back button
  const handleBack = () => {
    setSelectedTenant(null);
  };

  // Filter for the table - filter by xero_tenant_id
  const initialFilters = React.useMemo(() => {
    if (!selectedTenant) return [];
    return [
      {
        id: "tenant-filter",
        column: "xero_tenant_id",
        operator: "=" as const,
        value: selectedTenant.tenant_id,
      },
    ];
  }, [selectedTenant]);

  // Custom cell renderer for the contact table
  const customCellRenderer = React.useCallback(
    (entry: TableRowType, columnKey: string) => {
      // CONTACT column - clickable link to contact page (only if linked)
      if (columnKey === "display_name") {
        const contactId = entry.contact_id as number | null;
        const displayName = entry.display_name as string | null;

        if (!contactId || !displayName) {
          return (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Not Linked
            </Badge>
          );
        }

        return (
          <button
            className="text-left hover:underline text-primary font-medium"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/contacts/${contactId}`);
            }}
          >
            {displayName}
          </button>
        );
      }

      // XERO NAME column - clickable to open link management sheet
      if (columnKey === "xero_name") {
        const hasXeroName = entry.xero_name && (entry.xero_name as string) !== "";
        return (
          <button
            className={cn(
              "text-left w-full",
              hasXeroName
                ? "hover:underline text-blue-600 dark:text-blue-400"
                : "text-muted-foreground cursor-default"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (hasXeroName) {
                setSelectedRow({
                  xeroName: entry.xero_name as string,
                  xeroId: entry.xero_id as string | null,
                  xeroTenantId: entry.xero_tenant_id as string | null,
                  xeroTenantName: entry.xero_tenant_name as string | null,
                  xeroLinkId: entry.xero_link_id as number | null,
                  currentContactId: entry.contact_id as number | null,
                  currentContactName: entry.display_name as string | null,
                  currentEntityType: entry.entity_type as string | null,
                  synced: entry.synced as boolean,
                  matchConfidence: entry.match_confidence as number | null,
                });
                setShowLinkSheet(true);
              }
            }}
          >
            {hasXeroName ? (entry.xero_name as string) : "—"}
          </button>
        );
      }

      // Synced icon (for "synced" column)
      if (columnKey === "synced") {
        return entry.synced ? (
          <Check className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground mx-auto" />
        );
      }

      // Invoices count
      if (columnKey === "invoices_count") {
        const count = entry.invoices_count as number;
        return count > 0 ? (
          <span className="font-medium">{count}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      }

      // Bills count
      if (columnKey === "bills_count") {
        const count = entry.bills_count as number;
        return count > 0 ? (
          <span className="font-medium">{count}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      }

      // PDF sync percent with color coding
      if (columnKey === "pdf_sync_percent") {
        const percent = entry.pdf_sync_percent as number | null;
        if (percent === null || percent === undefined)
          return <span className="text-muted-foreground">-</span>;
        const color =
          percent === 100
            ? "text-green-600 dark:text-green-400"
            : percent >= 50
            ? "text-amber-600"
            : "text-red-600 dark:text-red-400";
        return <span className={cn("font-medium", color)}>{percent}%</span>;
      }

      // Has error indicator
      if (columnKey === "has_error") {
        return entry.has_error ? (
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />
            <span className="text-xs font-medium">Error</span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      }

      return null; // Use default rendering
    },
    [router]
  );

  // Handle row click to navigate to contact
  const handleRowClick = React.useCallback(
    (row: TableRowType) => {
      const contactId = row.contact_id as number | null;
      if (contactId) {
        router.push(`/contacts/${contactId}`);
      }
    },
    [router]
  );

  // Handle link changed
  const handleLinkChanged = () => {
    clearCachedRecords("xero-sync-contacts");
    setRefreshKey((prev) => prev + 1);
    onLinkChanged?.();
  };

  // Sort tenants: primary first, then alphabetically
  const sortedTenants = React.useMemo(() => {
    return [...tenants].sort((a, b) => {
      if (a.is_primary) return -1;
      if (b.is_primary) return 1;
      return a.tenant_name.localeCompare(b.tenant_name);
    });
  }, [tenants]);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right-wide" className="p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              {selectedTenant && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                  {selectedTenant
                    ? selectedTenant.tenant_name
                    : "Xero Contacts by Organization"}
                </SheetTitle>
                <SheetDescription>
                  {selectedTenant
                    ? `${selectedTenant.contacts.total_links.toLocaleString()} contacts • ${selectedTenant.documents.invoices.toLocaleString()} invoices • ${selectedTenant.documents.bills.toLocaleString()} bills`
                    : `${totalContacts.toLocaleString()} total contacts across ${tenants.length} organizations`}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {selectedTenant ? (
              /* Contact Table View */
              <div className="h-full">
                <TeeemTableView
                  key={`tenant-${selectedTenant.tenant_id}-${refreshKey}`}
                  foundationId="xero-sync-contacts"
                  autoFetchRecords={true}
                  onRowClick={handleRowClick}
                  customCellRenderer={customCellRenderer}
                  initialFilters={initialFilters}
                  viewOnly={true}
                />
              </div>
            ) : (
              /* Org List View */
              <div className="p-4 space-y-2 overflow-auto h-full">
                {sortedTenants.map((tenant) => (
                  <button
                    key={tenant.tenant_id}
                    onClick={() => setSelectedTenant(tenant)}
                    className={cn(
                      "w-full p-4 rounded-lg border text-left transition-colors",
                      "hover:bg-muted/50 hover:border-primary/50",
                      tenant.is_primary
                        ? "border-cyan-300 dark:border-cyan-700 bg-cyan-50/50 dark:bg-cyan-950/20"
                        : "border-border bg-card"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-2 rounded",
                            tenant.is_primary
                              ? "bg-cyan-100 dark:bg-cyan-900"
                              : "bg-muted"
                          )}
                        >
                          <Building2
                            className={cn(
                              "h-5 w-5",
                              tenant.is_primary
                                ? "text-cyan-600 dark:text-cyan-400"
                                : "text-muted-foreground"
                            )}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {tenant.tenant_name}
                            </span>
                            {tenant.is_primary && (
                              <Badge className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                Primary
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {tenant.contacts.total_links.toLocaleString()} contacts
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {tenant.documents.total.toLocaleString()} docs
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                      <div className="text-center p-2 bg-muted/50 rounded">
                        <div className="font-bold">{tenant.documents.invoices}</div>
                        <div className="text-muted-foreground">Invoices</div>
                      </div>
                      <div className="text-center p-2 bg-muted/50 rounded">
                        <div className="font-bold">{tenant.documents.bills}</div>
                        <div className="text-muted-foreground">Bills</div>
                      </div>
                      <div className="text-center p-2 bg-muted/50 rounded">
                        <div className="font-bold">{tenant.documents.quotes}</div>
                        <div className="text-muted-foreground">Quotes</div>
                      </div>
                      <div className="text-center p-2 bg-muted/50 rounded">
                        <div className="font-bold">
                          {tenant.contacts.cross_tenant_matches}
                        </div>
                        <div className="text-muted-foreground">Shared</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Xero Link Management Sheet */}
      {selectedRow && (
        <XeroLinkToContactSheet
          isOpen={showLinkSheet}
          onClose={() => {
            setShowLinkSheet(false);
            setSelectedRow(null);
          }}
          xeroName={selectedRow.xeroName}
          xeroId={selectedRow.xeroId}
          xeroTenantId={selectedRow.xeroTenantId}
          xeroTenantName={selectedRow.xeroTenantName}
          xeroLinkId={selectedRow.xeroLinkId}
          currentContactId={selectedRow.currentContactId}
          currentContactName={selectedRow.currentContactName}
          currentEntityType={selectedRow.currentEntityType}
          synced={selectedRow.synced}
          matchConfidence={selectedRow.matchConfidence}
          onLinkChanged={handleLinkChanged}
        />
      )}
    </>
  );
}
