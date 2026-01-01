import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Types
export interface XeroTenant {
  tenant_id: string;
  tenant_name: string;
}

export interface ContactRelationships {
  jobs: number;
  purchase_orders: number;
  cases: number;
}

export interface DuplicateContact {
  id: number;
  display_name: string;
  email: string | null;
  abn: string | null;
  mobile_phone: string | null;
  office_phone: string | null;
  created_at: string;
  score: number;
  xero_tenants: XeroTenant[];
  relationships: ContactRelationships;
}

export interface DuplicateGroup {
  id: string;
  normalized_name: string;
  contacts: DuplicateContact[];
  recommended_ssot_id: number;
  total_xero_tenants: number;
  can_auto_merge: boolean;
}

export interface DuplicateGroupsResponse {
  success: boolean;
  groups: DuplicateGroup[];
  summary: {
    total_groups: number;
    total_duplicate_contacts: number;
    total_contacts_after_merge: number;
  };
}

export interface MergeResponse {
  success: boolean;
  message: string;
  merged_count: number;
  deleted_contact_ids: number[];
  target_contact_id: number;
  already_merged?: boolean;
}

// Hooks

/**
 * Fetch all duplicate contact groups
 */
export function useGetDuplicateGroups() {
  return useQuery<DuplicateGroupsResponse>({
    queryKey: ['duplicate-contacts', 'groups'],
    queryFn: async () => {
      const response = await api.get<DuplicateGroupsResponse>('/api/v1/duplicate_contacts/groups');
      return response;
    },
  });
}

/**
 * Get count of duplicate groups (for badge)
 */
export function useGetDuplicateCount() {
  const { data } = useGetDuplicateGroups();
  return data?.summary.total_groups ?? 0;
}

/**
 * Merge a duplicate group into target contact
 */
export function useMergeDuplicateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      targetId
    }: {
      groupId: string;
      targetId: number;
    }) => {
      const response = await api.post<MergeResponse>(
        `/api/v1/duplicate_contacts/groups/${groupId}/merge`,
        { target_contact_id: targetId }
      );
      return response as MergeResponse;
    },
    onSuccess: async () => {
      // Force immediate refetch (not just invalidate) to ensure UI updates
      await queryClient.refetchQueries({ queryKey: ['duplicate-contacts', 'groups'] });
      // Also invalidate contacts list in case it's open
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

/**
 * Dismiss a duplicate group (mark as "not duplicate")
 */
export function useDismissDuplicateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const response = await api.post(
        `/api/v1/duplicate_contacts/groups/${groupId}/dismiss`
      );
      return response;
    },
    onSuccess: async () => {
      // Force immediate refetch to ensure UI updates
      await queryClient.refetchQueries({ queryKey: ['duplicate-contacts', 'groups'] });
    },
  });
}

// ============================================
// Xero Duplicates (duplicates WITHIN Xero that need merging in Xero)
// ============================================

export interface XeroDuplicateContact {
  xero_name: string;
  xero_id: string;
  invoice_count: number;
  total_amount: number;
  has_teeem_link: boolean;
  teeem_contact_id: number | null;
  teeem_contact_name: string | null;
}

export interface XeroDuplicateGroup {
  tenant_id: string;
  tenant_name: string;
  base_name: string;
  variation_count: number;
  xero_contacts: XeroDuplicateContact[];
}

export interface XeroDuplicatesResponse {
  success: boolean;
  data: {
    total_groups: number;
    groups: XeroDuplicateGroup[];
  };
}

/**
 * Fetch Xero duplicate contacts (same entity, different Xero IDs within same tenant)
 * These need to be merged in Xero, not in TEEEM
 */
export function useGetXeroDuplicates() {
  return useQuery<XeroDuplicatesResponse>({
    queryKey: ['xero-duplicates'],
    queryFn: async () => {
      const response = await api.get<XeroDuplicatesResponse>('/api/v1/xero/xero_duplicates');
      return response;
    },
  });
}

/**
 * Get count of Xero duplicate groups (for badge)
 */
export function useGetXeroDuplicateCount() {
  const { data } = useGetXeroDuplicates();
  return data?.data?.total_groups ?? 0;
}
