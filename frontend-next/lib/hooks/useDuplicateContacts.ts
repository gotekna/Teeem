import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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
  tax_number: string | null;
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
}

// Hooks

/**
 * Fetch all duplicate contact groups
 */
export function useGetDuplicateGroups() {
  return useQuery<DuplicateGroupsResponse>({
    queryKey: ['duplicate-contacts', 'groups'],
    queryFn: async () => {
      const response = await apiClient.get('/duplicate_contacts/groups');
      return response.data;
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
      const response = await apiClient.post(
        `/duplicate_contacts/groups/${groupId}/merge`,
        { target_contact_id: targetId }
      );
      return response.data as MergeResponse;
    },
    onSuccess: () => {
      // Invalidate and refetch duplicate groups
      queryClient.invalidateQueries({ queryKey: ['duplicate-contacts', 'groups'] });
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
      const response = await apiClient.post(
        `/duplicate_contacts/groups/${groupId}/dismiss`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-contacts', 'groups'] });
    },
  });
}
