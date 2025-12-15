 
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MergeContactsModal } from "@/components/contacts/merge-contacts-modal";
import TeeemTableView from "@/components/table/TeeemTableView";
import ContactsRelationalView from "./ContactsRelationalView";
import ContactRelationshipsExplorer from "./ContactRelationshipsExplorer";
import { Plus, AlertTriangle, Table2, Network, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useViewMode } from "@/contexts/ViewModeContext";
import type { TableRow as TTableRow, TableColumn } from "@/components/table/types";

interface Contact {
  id: number;
  display_name: string;
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
  initialHasMore: boolean;
  initialError: string | null;
}

export default function ContactsPageClient({
  initialFoundation,
  initialColumns,
  initialRecords,
  initialTotalCount,
  initialHasMore,
  initialError,
}: ContactsPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Helper function to deduplicate records by ID (belt-and-suspenders approach)
  const deduplicateRecords = useCallback((recs: TTableRow[]) => {
    const seen = new Set<number | string>();
    const unique = recs.filter(r => {
      if (seen.has(r.id)) {
        console.warn(`[ContactsPageClient] Removed duplicate record ID: ${r.id}`);
        return false;
      }
      seen.add(r.id);
      return true;
    });

    if (unique.length !== recs.length) {
      console.error(`[ContactsPageClient] ⚠️ DUPLICATES DETECTED: Removed ${recs.length - unique.length} duplicate records`);
    }

    return unique;
  }, []);

  // Use initial data from server - no loading state needed on first render!
  const [foundation] = useState(initialFoundation);
  const [columns] = useState(initialColumns);

  // Use SSR data as initial state, then infinite scroll will load more
  // Deduplicate initial records as a safety measure
  const [records, setRecords] = useState(() => {
    const seen = new Set<number | string>();
    return (initialRecords || []).filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  });
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [hasMore, setHasMore] = useState(initialHasMore); // Use server-provided hasMore flag
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [selectedForMerge, setSelectedForMerge] = useState<Contact[]>([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  // Track current view to determine display mode
  const [currentView, setCurrentView] = useState<any>(null);
  const [showExplorer, setShowExplorer] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Track if we've already started auto-loading (to prevent double-load)
  const hasStartedAutoLoad = useRef(false);

  // Handler for when the active view changes in View Manager
  const handleViewChange = useCallback((view: any) => {
    setCurrentView(view);
  }, []);

  // Server-side search - searches ALL contacts in database, not just loaded ones
  const handleServerSearch = useCallback(async (searchTerm: string) => {
    if (!foundation) return;

    setIsSearching(true);

    try {
      const response = await api.get<{ records: TTableRow[], has_more: boolean, next_cursor: number, total_count?: number }>(
        `/api/v1/foundations/${foundation.id}/records`,
        {
          params: {
            search: searchTerm,
            limit: 100  // Return first 100 search results
          }
        }
      );

      setRecords(deduplicateRecords(response.records || []));
      setHasMore(response.has_more ?? false);
      // Update total count if provided (first request includes it)
      if (response.total_count !== undefined) {
        setTotalCount(response.total_count);
      }
    } catch (error) {
      console.error("[ContactsPageClient] Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  }, [foundation, deduplicateRecords]);

  // Load more records (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!foundation || !hasMore || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const lastRecord = records[records.length - 1];
      const cursor = lastRecord?.id;

      const response = await api.get<{ records: TTableRow[], has_more: boolean, next_cursor: number }>(
        `/api/v1/foundations/${foundation.id}/records`,
        {
          params: {
            cursor,
            limit: 100  // Fetch 100 more records
          }
        }
      );

      // Append new records to existing ones (with deduplication)
      setRecords(prev => deduplicateRecords([...prev, ...(response.records || [])]));
      setHasMore(response.has_more ?? false);
    } catch (error) {
      console.error("[ContactsPageClient] Failed to load more:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [foundation, records, hasMore, isLoadingMore, deduplicateRecords]);

  // Load ALL remaining records (loops until hasMore is false)
  const loadAll = useCallback(async () => {
    if (!foundation || !hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    let keepLoading = true;
    let currentRecords = records;

    try {
      while (keepLoading) {
        const lastRecord = currentRecords[currentRecords.length - 1];
        const cursor = lastRecord?.id;

        const response = await api.get<{ records: TTableRow[], has_more: boolean, next_cursor: number }>(
          `/api/v1/foundations/${foundation.id}/records`,
          {
            params: {
              cursor,
              limit: 100
            }
          }
        );

        const newRecords = response.records || [];
        // CRITICAL: Deduplicate after appending to prevent duplicate IDs in UI
        currentRecords = deduplicateRecords([...currentRecords, ...newRecords]);
        setRecords(currentRecords);

        keepLoading = response.has_more ?? false;
        setHasMore(keepLoading);

        // Small delay to avoid hammering the API
        if (keepLoading) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      toast({
        title: "All contacts loaded",
        description: `Loaded ${currentRecords.length} total contacts`,
      });
    } catch (error) {
      console.error("[ContactsPageClient] Failed to load all:", error);
      toast({
        title: "Load failed",
        description: "Failed to load all contacts",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [foundation, records, hasMore, isLoadingMore, toast, deduplicateRecords]);

  // Refresh function to reload data (resets to first page)
  const refresh = useCallback(async () => {
    console.log('[ContactsPageClient] Refresh called');
    if (!foundation) {
      console.warn('[ContactsPageClient] Refresh aborted - no foundation');
      return;
    }

    try {
      console.log('[ContactsPageClient] Fetching records from API...');

      // Small delay to ensure backend transaction commits
      await new Promise(resolve => setTimeout(resolve, 200));

      const timestamp = Date.now();

      const response = await api.get<{ records: TTableRow[], has_more: boolean, total_count?: number }>(
        `/api/v1/foundations/${foundation.id}/records`,
        {
          params: {
            limit: 100,        // Initial load: first 100 records (FAST!)
            _t: timestamp      // Cache buster to ensure fresh data
          },
          dedupe: false        // Disable request deduplication to force fresh data
        }
      );

      setRecords(deduplicateRecords(response.records || []));
      setHasMore(response.has_more ?? true);
      // Update total count if provided (first request includes it)
      if (response.total_count !== undefined) {
        setTotalCount(response.total_count);
      }
      console.log('[ContactsPageClient] Refresh complete!');
    } catch (error) {
      console.error("[ContactsPageClient] Failed to refresh:", error);
    }
  }, [foundation, deduplicateRecords]);

  // Check if we need to refresh after returning from detail page
  useEffect(() => {
    const needsRefresh = sessionStorage.getItem('contacts_needs_refresh');
    if (needsRefresh === 'true') {
      sessionStorage.removeItem('contacts_needs_refresh');
      refresh();
    }
  }, [refresh]);

  // Auto-load all contacts in background after initial render
  useEffect(() => {
    if (!foundation || !hasMore || hasStartedAutoLoad.current) return;

    hasStartedAutoLoad.current = true;

    // Small delay to let initial render complete
    const timer = setTimeout(() => {
      console.log('[ContactsPageClient] Auto-loading all contacts in background...');
      loadAll();
    }, 500);

    return () => clearTimeout(timer);
  }, [foundation, hasMore, loadAll]);

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

  // TEEEM Values to rotate through
  const teeemValues = [
    {
      title: "Trust",
      description: "We build trust through being HOT: Honest, Open, and Transparent. We say things straight, share what needs to be shared, and always act with integrity."
    },
    {
      title: "Empower",
      description: "We give everyone the authority, tools, and backing to make decisions and take action. When people feel trusted and supported, they deliver their best."
    },
    {
      title: "Evolve",
      description: "We are committed to constant growth. We learn fast, embrace change, turn challenges into opportunities, and keep getting better every day."
    },
    {
      title: "Enjoy",
      description: "We believe great results come when we genuinely enjoy what we do. We celebrate wins, look after each other, and keep the workplace positive and human."
    },
    {
      title: "Measure",
      description: "We set clear targets, track progress honestly, and use real data to improve. What we measure, we manage—and we always aim higher."
    }
  ];

  // Handle delete - no confirmation, just soft delete (archive) immediately
  // Backend sets deleted=true, record disappears from UI but can be recovered
  const handleDelete = useCallback(async (row: TTableRow) => {
    const contact = row as unknown as Contact;
    const contactName = contact.display_name || contact.display_name || contact.name || 'Contact';

    // Pick a random TEEEM value
    const randomValue = teeemValues[Math.floor(Math.random() * teeemValues.length)];

    try {
      // Optimistically remove from UI immediately
      setRecords(prev => prev.filter(r => r.id !== contact.id));

      // Show TEEEM value toast
      toast({
        title: randomValue.title,
        description: randomValue.description,
      });

      // Soft delete via API (backend sets deleted=true)
      await api.delete(`/api/v1/foundations/contacts/records/${contact.id}`);

      // Show success toast
      toast({
        title: "Contact archived",
        description: `${contactName} has been removed`,
      });
    } catch (error: any) {
      console.error("[ContactsPageClient] Failed to delete contact:", error);

      // If delete failed, refresh to restore the contact
      if (error?.status !== 404 && !error?.message?.includes('not found')) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        toast({
          title: "Delete failed",
          description: errorMessage,
          variant: "destructive",
        });
        await refresh();
      }
    }
  }, [refresh, toast]);

  // Handle bulk delete - no confirmation, just soft delete all immediately
  const handleBulkDelete = useCallback(async (ids: (number | string)[]) => {
    if (ids.length === 0) return;

    // Pick a random TEEEM value
    const randomValue = teeemValues[Math.floor(Math.random() * teeemValues.length)];

    try {
      // Optimistically remove from UI immediately
      const idsSet = new Set(ids);
      setRecords(prev => prev.filter(r => !idsSet.has(r.id)));

      // Show TEEEM value toast
      toast({
        title: randomValue.title,
        description: randomValue.description,
      });

      // Soft delete all via API (in parallel for speed)
      await Promise.all(
        ids.map(id => api.delete(`/api/v1/foundations/contacts/records/${id}`))
      );

      // Show success toast
      toast({
        title: "Contacts archived",
        description: `${ids.length} contacts have been removed`,
      });
    } catch (error: any) {
      console.error("[ContactsPageClient] Failed to delete contacts:", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Delete failed",
        description: errorMessage,
        variant: "destructive",
      });
      await refresh();
    }
  }, [refresh, toast]);

  // Handle data health issue click (e.g., fix duplicate emails)
  const handleDataHealthIssueClick = useCallback((item: unknown, check: unknown) => {
    console.log('[ContactsPageClient] handleDataHealthIssueClick called');
    console.log('[ContactsPageClient] item:', item);
    console.log('[ContactsPageClient] check:', check);

    // Type guard for the item and check
    const healthItem = item as { id?: number; contacts?: Contact[] };
    const healthCheck = check as { check_name?: string };

    console.log('[ContactsPageClient] healthCheck.check_name:', healthCheck.check_name);
    console.log('[ContactsPageClient] healthItem.contacts:', healthItem.contacts);

    // For duplicate email checks, open merge modal with the duplicate contacts
    if (healthCheck.check_name === 'duplicate_emails' && healthItem.contacts && Array.isArray(healthItem.contacts)) {
      console.log('[ContactsPageClient] Opening merge modal with', healthItem.contacts.length, 'contacts');
      setSelectedForMerge(healthItem.contacts);
      setMergeModalOpen(true);
    } else if (healthItem.id) {
      // For all other checks, navigate to the contact detail page
      console.log('[ContactsPageClient] Navigating to contact:', healthItem.id);
      router.push(`/contacts/${healthItem.id}`);
    }
  }, [router]);

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount !== null
              ? `${totalCount.toLocaleString()} contacts`
              : `${records.length.toLocaleString()}+ contacts`}
          </p>
        </div>
        {currentView?.view_type === "relational" && (
          <Button
            variant={showExplorer ? "default" : "outline"}
            size="sm"
            onClick={() => setShowExplorer(!showExplorer)}
          >
            <Search className="h-4 w-4 mr-2" />
            {showExplorer ? "Show Network" : "Search Relationships"}
          </Button>
        )}
      </div>

      {/* Contacts View - Table or Relational based on saved view setting */}
      <div className="flex-1 min-h-0">
        {currentView?.view_type === "relational" ? (
          showExplorer ? (
            <ContactRelationshipsExplorer />
          ) : (
            <ContactsRelationalView contacts={records as unknown as Contact[]} />
          )
        ) : (
          <TeeemTableView
            entries={records}
            columns={columns}
            totalCount={totalCount}
            foundationId="contacts"
            foundationIdNumeric={foundation?.id}
            tableName={foundation?.name || "Contacts"}
            enableExport={true}
            enableImport={true}
            onDataHealthIssueClick={handleDataHealthIssueClick}
            onRefresh={refresh}
            onRowClick={handleRowClick}
            onRowDoubleClick={handleRowDoubleClick}
            onRowUpdate={handleRowUpdate}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            leftActions={leftActions}
            onViewChange={handleViewChange}
            onServerSearch={handleServerSearch}
            serverSearchLoading={isSearching}
            loadingMore={isLoadingMore}
            onLoadMore={loadMore}
          />
        )}
      </div>

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
