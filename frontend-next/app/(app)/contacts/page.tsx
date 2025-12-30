"use client";

import { useCallback, useState, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { Plus } from "lucide-react";
import type { TableRow } from "@/components/table/types";

// Lazy load heavy modals - they're only needed when user triggers merge/transfer
const MergeModal = lazy(() => import("@/components/table/MergeModal").then(m => ({ default: m.MergeModal })));
const XeroLinkTransferModal = lazy(() => import("@/components/contacts/XeroLinkTransferModal").then(m => ({ default: m.XeroLinkTransferModal })));

interface Contact {
  id: number;
  display_name: string;
  email: string | null;
  phone?: string;
  mobile_phone: string | null;
  office_phone: string | null;
  entity_type: string | null;
  xero_id: string | null;
  completeness_score?: number;
  jobs_count?: number;
  purchase_orders_count?: number;
}

/**
 * Contacts Page - Performance Optimized
 *
 * Uses autoFetchRecords for TeeemTableView to handle data loading.
 * Lazy loads heavy modals to reduce initial bundle size.
 */
export default function ContactsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Modal state - lazy loaded when needed
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Contact[]>([]);
  const [xeroTransferModalOpen, setXeroTransferModalOpen] = useState(false);
  const [xeroTransferIds, setXeroTransferIds] = useState<(number | string)[]>([]);

  // Refresh key to trigger TeeemTableView refresh
  const [refreshKey, setRefreshKey] = useState(0);

  // Navigation handler
  const handleRowDoubleClick = useCallback((row: TableRow) => {
    router.push(`/contacts/${row.id}`);
  }, [router]);

  // Inline update handler
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    await api.patch(`/api/v1/foundations/contacts/records/${rowId}`, {
      record: { [field]: value }
    });
    setRefreshKey(k => k + 1);
  }, []);

  // Delete handler
  const handleDelete = useCallback(async (row: TableRow) => {
    try {
      await api.delete(`/api/v1/foundations/contacts/records/${row.id}`);
      toast({ title: "Contact archived", description: "Contact has been removed" });
      setRefreshKey(k => k + 1);
    } catch (error) {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }, [toast]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async (ids: (number | string)[]) => {
    await Promise.allSettled(ids.map(id => api.delete(`/api/v1/foundations/contacts/records/${id}`)));
    toast({ title: "Contacts archived", description: `${ids.length} contacts removed` });
    setRefreshKey(k => k + 1);
  }, [toast]);

  // Xero transfer handler
  const handleXeroTransfer = useCallback((ids: (number | string)[]) => {
    if (ids.length === 2) {
      setXeroTransferIds(ids);
      setXeroTransferModalOpen(true);
    }
  }, []);

  // Merge complete handler
  const handleMergeComplete = useCallback((deletedIds: (string | number)[]) => {
    setSelectedForMerge([]);
    toast({ title: "Contacts merged", description: `${deletedIds.length} contact(s) merged` });
    setRefreshKey(k => k + 1);
  }, [toast]);

  // Data health issue click handler
  const handleDataHealthIssueClick = useCallback((item: unknown, check: unknown) => {
    const healthItem = item as { id?: number; contacts?: Contact[] };
    const healthCheck = check as { check_name?: string };

    if (healthCheck.check_name === 'duplicate_emails' && healthItem.contacts) {
      setSelectedForMerge(healthItem.contacts);
      setMergeModalOpen(true);
    } else if (healthItem.id) {
      router.push(`/contacts/${healthItem.id}`);
    }
  }, [router]);

  // Left actions
  const leftActions = (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref="/dashboard" />
      <Button asChild>
        <Link href="/contacts/new">
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Link>
      </Button>
    </div>
  );

  return (
    <TablePage>
      <TeeemTableView
        key={refreshKey}
        foundationId="contacts"
        autoFetchRecords
        tableName="Contacts"
        enableExport
        enableImport
        showDataHealth
        onDataHealthIssueClick={handleDataHealthIssueClick}
        onRowDoubleClick={handleRowDoubleClick}
        onRowUpdate={handleRowUpdate}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onXeroTransfer={handleXeroTransfer}
        leftActions={leftActions}
        hideFooter
      />

      {/* Lazy loaded modals - only render when open */}
      {mergeModalOpen && (
        <Suspense fallback={null}>
          <MergeModal
            open={mergeModalOpen}
            onOpenChange={setMergeModalOpen}
            selectedIds={selectedForMerge.map(c => c.id)}
            foundationId="contacts"
            records={selectedForMerge as unknown as Record<string, unknown>[]}
            displayColumn="display_name"
            secondaryColumns={["email", "phone"]}
            entityName="Contact"
            onMergeComplete={handleMergeComplete}
          />
        </Suspense>
      )}

      {xeroTransferModalOpen && (
        <Suspense fallback={null}>
          <XeroLinkTransferModal
            isOpen={xeroTransferModalOpen}
            onClose={() => {
              setXeroTransferModalOpen(false);
              setXeroTransferIds([]);
            }}
            contactIds={xeroTransferIds}
            onSuccess={() => setRefreshKey(k => k + 1)}
          />
        </Suspense>
      )}
    </TablePage>
  );
}
