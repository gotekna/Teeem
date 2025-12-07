"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MergeContactsModal } from "@/components/contacts/merge-contacts-modal";
import TeeemTableView from "@/components/table/TeeemTableView";
import { Plus, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import type { TableRow as TTableRow, TableColumn } from "@/components/table/types";

interface Contact {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  office_phone: string | null;
  entity_type: string | null;
  is_active: boolean;
  portal_enabled: boolean;
  xero_id: string | null;
  xero_contact_types: string[];
  xero_synced: boolean;
  teeem_rating: number | null;
  supplier_code: string | null;
  address: string | null;
  created_at: string;
  updated_at?: string;
  name?: string;
  phone?: string;
  company?: string;
  type?: string;
  jobs_count?: number;
  purchase_orders_count?: number;
  completeness_score?: number;
}

interface Foundation {
  id: number;
  name: string;
  slug: string;
}

interface ContactsPageClientProps {
  initialFoundation: Foundation | null;
  initialColumns: TableColumn[];
  initialRecords: TTableRow[];
  initialTotalCount: number | null;
  initialError: string | null;
}

export default function ContactsPageClient({
  initialFoundation,
  initialColumns,
  initialRecords,
  initialError,
}: ContactsPageClientProps) {
  const router = useRouter();

  // Use initial data from server - no loading state needed on first render!
  const [foundation] = useState(initialFoundation);
  const [columns] = useState(initialColumns);
  const [records, setRecords] = useState(initialRecords);

  const [selectedForMerge, setSelectedForMerge] = useState<Contact[]>([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  // Refresh function to reload data
  const refresh = useCallback(async () => {
    console.log('[ContactsPageClient] Refresh called');
    if (!foundation) {
      console.warn('[ContactsPageClient] Refresh aborted - no foundation');
      return;
    }

    try {
      console.log('[ContactsPageClient] Fetching records from API...');
      console.log('[ContactsPageClient] Foundation ID:', foundation.id);
      console.log('[ContactsPageClient] Current records count:', records.length);

      // Small delay to ensure backend transaction commits
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await api.get<{ records: TTableRow[] }>(
        `/api/v1/foundations/${foundation.id}/records`,
        {
          params: {
            per_page: 10000,  // Fetch all records (increased from 500)
            _t: Date.now()     // Cache buster to ensure fresh data
          },
          dedupe: false        // Disable request deduplication to force fresh data
        }
      );
      console.log('[ContactsPageClient] API response received');
      console.log('[ContactsPageClient] New records count:', response.records?.length || 0);
      console.log('[ContactsPageClient] Setting records...');
      setRecords(response.records || []);
      console.log('[ContactsPageClient] Refresh complete!');
    } catch (error) {
      console.error("[ContactsPageClient] Failed to refresh:", error);
    }
  }, [foundation, records.length]);

  const handleMergeComplete = () => {
    setSelectedForMerge([]);
    refresh();
  };

  // Handle row click - navigate to contact detail
  const handleRowClick = useCallback((row: TTableRow) => {
    const contact = row as unknown as Contact;
    router.push(`/contacts/${contact.id}`);
  }, [router]);

  // Handle row double-click
  const handleRowDoubleClick = useCallback((row: TTableRow) => {
    const contact = row as unknown as Contact;
    router.push(`/contacts/${contact.id}`);
  }, [router]);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    console.log('[ContactsPageClient] handleRowUpdate called');
    console.log('[ContactsPageClient] Row ID:', rowId);
    console.log('[ContactsPageClient] Field:', field);
    console.log('[ContactsPageClient] Value:', value);
    console.log('[ContactsPageClient] Value type:', typeof value);

    try {
      const payload = {
        record: { [field]: value }
      };
      console.log('[ContactsPageClient] API PATCH payload:', JSON.stringify(payload, null, 2));
      console.log('[ContactsPageClient] API URL:', `/api/v1/foundations/contacts/records/${rowId}`);

      const response = await api.patch(`/api/v1/foundations/contacts/records/${rowId}`, payload);
      console.log('[ContactsPageClient] API response:', response);
      console.log('[ContactsPageClient] Calling refresh...');
      refresh();
      console.log('[ContactsPageClient] Update complete!');
    } catch (error) {
      console.error("[ContactsPageClient] Failed to update contact:", error);
      console.error("[ContactsPageClient] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        error: error
      });
      throw error;
    }
  }, [refresh]);

  // Handle single contact delete
  const handleDelete = useCallback(async (row: TTableRow) => {
    const contact = row as unknown as Contact;
    if (!confirm(`Delete contact "${contact.full_name || contact.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/api/v1/foundations/contacts/records/${contact.id}`);
      await refresh();
    } catch (error) {
      console.error("Failed to delete contact:", error);
      alert("Failed to delete contact. Please try again.");
    }
  }, [refresh]);

  // Handle data health issue click (e.g., fix duplicate emails)
  const handleDataHealthIssueClick = useCallback((item: unknown, check: unknown) => {
    // Type guard for the item and check
    const healthItem = item as { contacts?: Contact[] };
    const healthCheck = check as { check_type?: string };

    // For duplicate email checks, open merge modal with the duplicate contacts
    if (healthCheck.check_type === 'duplicate_emails' && healthItem.contacts && Array.isArray(healthItem.contacts)) {
      setSelectedForMerge(healthItem.contacts);
      setMergeModalOpen(true);
    }
  }, []);

  // Show error if initial load failed
  if (initialError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{initialError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Left actions - Add Contact button
  const leftActions = (
    <div className="flex gap-2">
      <Button asChild>
        <Link href="/contacts/new">
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Link>
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {records.length.toLocaleString()} contacts
          </p>
        </div>
      </div>

      {/* Contacts Table */}
      <TeeemTableView
        entries={records}
        columns={columns}
        foundationId="contacts"
        foundationIdNumeric={foundation?.id}
        tableName={foundation?.name || "Contacts"}
        enableExport={true}
        enableImport={true}
        showDataHealth={false}
        onDataHealthIssueClick={handleDataHealthIssueClick}
        onRefresh={refresh}
        onRowClick={handleRowClick}
        onRowDoubleClick={handleRowDoubleClick}
        onRowUpdate={handleRowUpdate}
        onDelete={handleDelete}
        leftActions={leftActions}
      />

      {/* Merge Modal */}
      <MergeContactsModal
        open={mergeModalOpen}
        onOpenChange={setMergeModalOpen}
        contacts={selectedForMerge}
        onMergeComplete={handleMergeComplete}
      />
    </div>
  );
}
