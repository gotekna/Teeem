"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUrlState } from "@/hooks/useUrlState";
import Link from "next/link";
import { useAtomValue } from "jotai";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MergeModal } from "@/components/table/MergeModal";
import { XeroLinkTransferModal } from "@/components/contacts/XeroLinkTransferModal";
import TeeemTableView from "@/components/table/TeeemTableView";
import { isPerson, isCompany, isTrust, canHaveEmployees, getEntityTypeBadge } from "@/lib/entity-types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Mail, Phone, Building2, ExternalLink, Trash2, UserPlus, Plus, AlertTriangle, Table2, Network, Search } from "lucide-react";
import ContactsRelationalView from "./ContactsRelationalView";
import ContactRelationshipsExplorer from "./ContactRelationshipsExplorer";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useViewMode } from "@/contexts/ViewModeContext";
import { TablePage } from "@/components/ui/page-wrappers";
import type { TableRow as TTableRow, TableColumn } from "@/components/table/types";
import type { SearchMode } from "@/components/table/components/SearchInput";
import {
  currentFiltersAtom,
  currentFilterGroupsAtom,
  currentInterGroupLogicAtom,
} from "@/lib/view-state-atoms";
import {
  getCachedRecords,
  setCachedRecords,
  removeMultipleFromCache,
} from "@/lib/records-cache";

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

// Helper functions for contact merge display (moved from MergeContactsModal)
function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getCompletenessColor(score: number | undefined | null): string {
  if (!score) return "text-gray-400";
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

// Auto-select the best contact for merge (highest completeness, has Xero connection)
function getBestPrimaryContact(contacts: Contact[]): number | undefined {
  if (contacts.length === 0) return undefined;
  const sorted = [...contacts].sort((a, b) => {
    // Prefer contacts with Xero connection
    const aXero = a.xero_id;
    const bXero = b.xero_id;
    if (aXero && !bXero) return -1;
    if (!aXero && bXero) return 1;
    // Then by completeness score
    return (b.completeness_score || 0) - (a.completeness_score || 0);
  });
  return sorted[0].id;
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

  // SSoT: URL state managed by useUrlState hook
  const [urlState, setUrlState] = useUrlState({
    search: null as string | null,
    mode: null as string | null,  // search mode: null = "contains"
  });

  // URL is SSoT for search (enables shareable filtered URLs)
  const initialSearchFromUrl = urlState.search || undefined;

  // Derive search mode from URL (null = default "contains")
  const searchMode: SearchMode = (urlState.mode as SearchMode) || "contains";

  // Update URL when search changes (uses SSoT hook)
  const handleSearchChange = useCallback((term: string) => {
    setUrlState({ search: term && term.trim() ? term : null });
  }, [setUrlState]);

  // Update URL when search mode changes
  const setSearchMode = useCallback((mode: SearchMode) => {
    setUrlState({ mode: mode === "contains" ? null : mode });
  }, [setUrlState]);

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
  // columns removed - TeeemTableView auto-fetches from Foundation API (SSoT)

  // SSoT: Check cache first, then fall back to SSR initial data
  // This preserves loaded records when navigating back from detail pages
  const [records, setRecords] = useState(() => {
    // Check if we have cached records for this foundation
    if (initialFoundation?.id) {
      const cached = getCachedRecords(initialFoundation.id);
      if (cached && cached.records.length > (initialRecords?.length || 0)) {
        console.log(`[ContactsPageClient] Using cached records: ${cached.records.length} (SSR had ${initialRecords?.length || 0})`);
        return cached.records as TTableRow[];
      }
    }
    // Fall back to SSR data
    const seen = new Set<number | string>();
    return (initialRecords || []).filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  });
  const [totalCount, setTotalCount] = useState(() => {
    if (initialFoundation?.id) {
      const cached = getCachedRecords(initialFoundation.id);
      if (cached && cached.records.length > (initialRecords?.length || 0)) {
        return cached.totalCount;
      }
    }
    return initialTotalCount;
  });
  const [hasMore, setHasMore] = useState(() => {
    if (initialFoundation?.id) {
      const cached = getCachedRecords(initialFoundation.id);
      if (cached && cached.records.length > (initialRecords?.length || 0)) {
        return cached.hasMore;
      }
    }
    return initialHasMore;
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [selectedForMerge, setSelectedForMerge] = useState<Contact[]>([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [fixingEmail, setFixingEmail] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [xeroTransferIds, setXeroTransferIds] = useState<(number | string)[]>([]);
  const [xeroTransferModalOpen, setXeroTransferModalOpen] = useState(false);

  // Track current view to determine display mode
  const [currentView, setCurrentView] = useState<any>(null);
  const [showExplorer, setShowExplorer] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Track if we've already started auto-loading (to prevent double-load)
  const hasStartedAutoLoad = useRef(false);

  // Search: AbortController for cancelling pending requests (prevents race conditions)
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  // Search: Cache original data to restore when search is cleared
  const preSearchDataRef = useRef<{ records: TTableRow[]; totalCount: number | null; hasMore: boolean } | null>(null);

  // Handler for when the active view changes in View Manager
  const handleViewChange = useCallback((view: any) => {
    setCurrentView(view);
  }, []);

  // Read current filters from Jotai atoms
  const currentFilters = useAtomValue(currentFiltersAtom);
  const currentFilterGroups = useAtomValue(currentFilterGroupsAtom);
  const currentInterGroupLogic = useAtomValue(currentInterGroupLogicAtom);

  // Server-side search - searches within the current filtered view (SSoT approach)
  // Sends both search term AND view filters to backend for combined SQL query
  // Features: request cancellation, pre-search data caching, instant restore on clear, search modes
  const handleServerSearch = useCallback(async (searchTerm: string, mode?: SearchMode) => {
    if (!foundation) return;

    // Update search mode if provided
    const effectiveMode = mode || searchMode;
    if (mode && mode !== searchMode) {
      setSearchMode(mode);
    }

    // Cancel any pending search request (prevents race conditions)
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }

    // If clearing search, restore cached pre-search data instantly (no API call needed)
    if (!searchTerm || searchTerm.trim() === "") {
      if (preSearchDataRef.current) {
        setRecords(preSearchDataRef.current.records);
        setTotalCount(preSearchDataRef.current.totalCount);
        setHasMore(preSearchDataRef.current.hasMore);
        preSearchDataRef.current = null; // Clear cache after restore
      }
      setIsSearching(false);
      return;
    }

    // Cache current data before first search (so we can restore on clear)
    if (!preSearchDataRef.current) {
      preSearchDataRef.current = { records, totalCount, hasMore };
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    searchAbortControllerRef.current = abortController;

    setIsSearching(true);

    try {
      // Build params with search + search mode + current view filters (SSoT: backend does filtering + search)
      const params: Record<string, string | number> = {
        search: searchTerm,
        search_mode: effectiveMode,  // Pass search mode to backend
        limit: 100  // Return first 100 search results
      };

      // Include view filters if present (so search only searches within current view)
      if (currentFilters.length > 0) {
        params.filters = JSON.stringify(currentFilters);
        params.filter_groups = JSON.stringify(currentFilterGroups);
        params.inter_group_logic = currentInterGroupLogic;
      }

      const response = await api.get<{ records: TTableRow[], has_more: boolean, next_cursor: number, total_count?: number }>(
        `/api/v1/foundations/${foundation.id}/records`,
        { params, signal: abortController.signal }
      );

      // Only update if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setRecords(deduplicateRecords(response.records || []));
        setHasMore(response.has_more ?? false);
        if (response.total_count !== undefined) {
          setTotalCount(response.total_count);
        }
      }
    } catch (error) {
      // Ignore abort errors (expected when user types quickly)
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error("[ContactsPageClient] Search failed:", error);
    } finally {
      // Only clear loading if this is still the current request
      if (searchAbortControllerRef.current === abortController) {
        setIsSearching(false);
      }
    }
  }, [foundation, records, totalCount, hasMore, deduplicateRecords, currentFilters, currentFilterGroups, currentInterGroupLogic, searchMode]);

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
    if (!foundation || !hasMore || isLoadingMore) {
      console.log('[ContactsPageClient] loadAll aborted:', { foundation: !!foundation, hasMore, isLoadingMore });
      return;
    }

    console.log('[ContactsPageClient] 🔄 Starting loadAll - Initial records:', records.length);
    setIsLoadingMore(true);
    let keepLoading = true;
    let currentRecords = records;
    let iteration = 0;

    try {
      while (keepLoading) {
        iteration++;
        const lastRecord = currentRecords[currentRecords.length - 1];
        const cursor = lastRecord?.id;

        console.log(`[ContactsPageClient] 📥 Iteration ${iteration}: Fetching with cursor=${cursor}, current total: ${currentRecords.length}`);

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
        console.log(`[ContactsPageClient] 📦 Iteration ${iteration}: Received ${newRecords.length} records, has_more=${response.has_more}`);

        // CRITICAL: Deduplicate after appending to prevent duplicate IDs in UI
        const beforeDedup = currentRecords.length + newRecords.length;
        currentRecords = deduplicateRecords([...currentRecords, ...newRecords]);
        console.log(`[ContactsPageClient] 🔍 Iteration ${iteration}: After dedup: ${currentRecords.length} (removed ${beforeDedup - currentRecords.length} duplicates)`);

        setRecords(currentRecords);

        keepLoading = response.has_more ?? false;
        setHasMore(keepLoading);

        if (!keepLoading) {
          console.log(`[ContactsPageClient] ✅ LoadAll complete: Loaded ${currentRecords.length} total records (expected ~1216)`);
        }

        // Small delay to avoid hammering the API
        if (keepLoading) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Save to cache so data persists when navigating back
      if (foundation?.id) {
        setCachedRecords(foundation.id, currentRecords, totalCount, false);
      }

      toast({
        title: "All contacts loaded",
        description: `Loaded ${currentRecords.length} total contacts`,
      });
    } catch (error) {
      console.error("[ContactsPageClient] ❌ Failed to load all:", error);
      console.error("[ContactsPageClient] ❌ Error details:", {
        message: error instanceof Error ? error.message : String(error),
        iteration,
        currentRecordsCount: currentRecords.length,
        error
      });
      toast({
        title: "Load failed",
        description: `Failed after loading ${currentRecords.length} contacts`,
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

  // DISABLED: Auto-load was loading 1,178 contacts on every page load (wasteful!)
  // Now user clicks "Load All" button when they want to load everything
  // useEffect(() => {
  //   if (hasStartedAutoLoad.current || currentFilters.length > 0) return;
  //   if (!foundation || !hasMore) return;
  //   hasStartedAutoLoad.current = true;
  //   const timer = setTimeout(() => loadAll(), 500);
  //   return () => clearTimeout(timer);
  // }, [foundation]);

  const handleMergeComplete = useCallback((deletedIds: (string | number)[], primaryId?: string | number) => {
    console.log('[ContactsPageClient] Merge complete - removing contacts:', deletedIds);
    setSelectedForMerge([]);
    setMergeError(null);

    // Optimistically remove merged contacts from state (no need to reload all 1,178 contacts!)
    setRecords(prev => prev.filter(r => !deletedIds.includes(Number(r.id))));

    // Update cache to remove merged contacts
    if (foundation?.id) {
      removeMultipleFromCache(foundation.id, deletedIds);
    }

    // Update total count
    if (totalCount !== null) {
      setTotalCount(totalCount - deletedIds.length);
    }

    toast({
      title: "Contacts merged",
      description: `${deletedIds.length} contact(s) merged successfully`,
    });
  }, [foundation?.id, totalCount, toast]);

  // Custom merge handler for contacts - uses contacts-specific API
  const handleContactsMerge = useCallback(async (primaryId: string | number, secondaryIds: (string | number)[]) => {
    await api.post("/api/v1/contacts/merge", {
      target_id: primaryId,
      source_ids: secondaryIds,
    });
  }, []);

  // Handle fix email assignment: keep email on person, clear from companies, create employment links
  const handleFixEmailAssignment = useCallback(async () => {
    // Find the person contact
    const personContact = selectedForMerge.find(c => isPerson(c.entity_type));
    // Find all contacts that can have employees (company/trust/sole_trader)
    const companyContacts = selectedForMerge.filter(c => canHaveEmployees(c.entity_type));

    if (!personContact || companyContacts.length === 0) {
      setMergeError("Could not identify person and company contacts");
      return;
    }

    setFixingEmail(true);
    setMergeError(null);

    try {
      await api.post("/api/v1/contacts/fix_email_assignment", {
        person_id: personContact.id,
        company_ids: companyContacts.map(c => c.id),
      });
      // No contacts are deleted in fix email assignment, just pass empty array
      handleMergeComplete([], personContact.id);
      setMergeModalOpen(false);
      toast({
        title: "Email assignment fixed",
        description: `Email assigned to ${personContact.display_name || personContact.name}`,
      });
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Failed to fix email assignment");
    } finally {
      setFixingEmail(false);
    }
  }, [selectedForMerge, handleMergeComplete, toast]);

  // Xero transfer handler - called when 2 contacts are selected and Xero button is clicked
  const handleXeroTransfer = useCallback((ids: (number | string)[]) => {
    if (ids.length === 2) {
      setXeroTransferIds(ids);
      setXeroTransferModalOpen(true);
    }
  }, []);

  // Handle row double-click - navigate to contact detail
  // NOTE: Single-click is disabled to allow row selection and inline editing
  // Double-click is the standard way to open a record in a table
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

    // Optimistically remove from UI immediately
    const idsSet = new Set(ids);
    setRecords(prev => prev.filter(r => !idsSet.has(r.id)));

    // Update cache to remove deleted contacts
    if (foundation?.id) {
      removeMultipleFromCache(foundation.id, ids);
    }

    // Show TEEEM value toast
    toast({
      title: randomValue.title,
      description: randomValue.description,
    });

    // Soft delete all via API (in parallel for speed)
    // Use allSettled to handle already-deleted records gracefully
    const results = await Promise.allSettled(
      ids.map(id => api.delete(`/api/v1/foundations/contacts/records/${id}`))
    );

    // Count successes and failures
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      // Some failed (likely already deleted) - log but don't show error
      console.warn(`[ContactsPageClient] Bulk delete: ${succeeded} succeeded, ${failed} already deleted/not found`);
    }

    // Show success toast (even if some were already deleted)
    toast({
      title: "Contacts archived",
      description: succeeded === ids.length
        ? `${ids.length} contacts have been removed`
        : `${succeeded} contacts removed (${failed} were already deleted)`,
    });

    // Refresh to ensure UI is in sync with backend
    if (failed > 0) {
      await refresh();
    }
  }, [foundation?.id, refresh, toast]);

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

  // Left actions - Back button + Add Contact button
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
      {/* TeeemTableView handles header, count, and table (SSoT) */}
        {currentView?.view_type === "relational" ? (
          showExplorer ? (
            <ContactRelationshipsExplorer />
          ) : (
            <ContactsRelationalView contacts={records as unknown as Contact[]} />
          )
        ) : (
          <TeeemTableView
            entries={records}
            totalCount={totalCount}
            foundationId="contacts"
            foundationIdNumeric={foundation?.id}
            tableName={foundation?.name || "Contacts"}
            enableExport={true}
            enableImport={true}
            onDataHealthIssueClick={handleDataHealthIssueClick}
            onRefresh={refresh}
            onRowDoubleClick={handleRowDoubleClick}
            onRowUpdate={handleRowUpdate}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            onXeroTransfer={handleXeroTransfer}
            leftActions={leftActions}
            onViewChange={handleViewChange}
            onServerSearch={handleServerSearch}
            serverSearchLoading={isSearching}
            searchMode={searchMode}
            onSearchModeChange={setSearchMode}
            initialSearch={initialSearchFromUrl}
            onSearchChange={handleSearchChange}
            loadingMore={isLoadingMore}
            onLoadMore={loadMore}
            onLoadAll={loadAll}
            hasMore={hasMore}
            hideFooter={true}
          />
        )}

      {/* Merge Modal - uses generic MergeModal with contacts-specific extensions */}
      <MergeModal
        open={mergeModalOpen}
        onOpenChange={(open) => {
          setMergeModalOpen(open);
          if (!open) setMergeError(null);
        }}
        selectedIds={selectedForMerge.map(c => c.id)}
        foundationId="contacts"
        records={selectedForMerge as unknown as Record<string, unknown>[]}
        displayColumn="display_name"
        secondaryColumns={["email", "phone"]}
        entityName="Contact"
        onMergeComplete={handleMergeComplete}
        // Extension props for contacts-specific behavior
        defaultPrimaryId={getBestPrimaryContact(selectedForMerge)}
        onMerge={handleContactsMerge}
        // Header content: Entity type warnings
        headerContent={(() => {
          const entityTypes = [...new Set(selectedForMerge.map(c => c.entity_type).filter(Boolean))];
          const hasPersonAndCompany = entityTypes.includes('person') &&
            (entityTypes.includes('company') || entityTypes.includes('trust'));
          const hasXeroConflict = selectedForMerge.filter(c => c.xero_id).length > 1;

          return (
            <>
              {hasPersonAndCompany && (
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <strong>Different entity types detected!</strong> These contacts include both
                    people and companies sharing the same email.
                    <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded-md border border-amber-200 dark:border-amber-800">
                      <p className="font-medium text-amber-900 dark:text-amber-100 mb-2">Recommended: Fix Email Assignment</p>
                      <ul className="list-disc ml-5 space-y-1 text-sm">
                        <li>Keep the email on the person contact</li>
                        <li>Clear the email from company contacts</li>
                        <li>Link the person as an employee of each company</li>
                      </ul>
                      <Button
                        className="mt-3 bg-amber-600 hover:bg-amber-700"
                        size="sm"
                        onClick={handleFixEmailAssignment}
                        disabled={fixingEmail}
                      >
                        {fixingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <UserPlus className="h-4 w-4 mr-2" />
                        Fix Email Assignment
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              {hasXeroConflict && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Multiple contacts are linked to Xero. Only the primary contact's Xero connection
                    will be preserved.
                  </AlertDescription>
                </Alert>
              )}
              {mergeError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{mergeError}</AlertDescription>
                </Alert>
              )}
            </>
          );
        })()}
        // Extra content per record: Avatar + stats
        renderRecordExtra={(record, isPrimary) => {
          const contact = record as unknown as Contact;
          return (
            <div className="flex items-start gap-3 mt-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{getInitials(contact.display_name || contact.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="space-y-1 text-sm text-muted-foreground">
                  {contact.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </div>
                  )}
                  {(contact.phone || contact.mobile_phone || contact.office_phone) && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {contact.phone || contact.mobile_phone || contact.office_phone}
                    </div>
                  )}
                  {contact.company && (
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {contact.company}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <span>{contact.jobs_count || 0} jobs</span>
                  <span>{contact.purchase_orders_count || 0} POs</span>
                  <span className={getCompletenessColor(contact.completeness_score)}>
                    {contact.completeness_score || 0}% complete
                  </span>
                  {contact.xero_id && (
                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Xero
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        }}
        // Footer content: What will happen preview
        footerContent={(() => {
          const primaryContact = selectedForMerge.find(c => c.id === getBestPrimaryContact(selectedForMerge));
          const secondaryContacts = selectedForMerge.filter(c => c.id !== primaryContact?.id);
          if (!primaryContact || secondaryContacts.length === 0) return null;

          return (
            <div className="space-y-2 mt-4">
              <Separator />
              <p className="text-sm font-medium">What will happen:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Keep "{primaryContact.display_name || primaryContact.name}" as the primary contact
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Merge {secondaryContacts.reduce((sum, c) => sum + (c.jobs_count || 0), 0)} jobs
                  and {secondaryContacts.reduce((sum, c) => sum + (c.purchase_orders_count || 0), 0)} POs
                </li>
                <li className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-600" />
                  Delete {secondaryContacts.length} duplicate contact(s)
                </li>
              </ul>
            </div>
          );
        })()}
      />

      {/* Xero Link Transfer Modal */}
      <XeroLinkTransferModal
        isOpen={xeroTransferModalOpen}
        onClose={() => {
          setXeroTransferModalOpen(false);
          setXeroTransferIds([]);
        }}
        contactIds={xeroTransferIds}
        onSuccess={refresh}
      />
    </TablePage>
  );
}
