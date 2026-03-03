import { useState, useEffect } from "react";
import { api } from "@/lib/api";

/**
 * useContacts - THE ONE hook for fetching contacts in pickers/dropdowns.
 *
 * SSoT: All contact list fetching for pickers should go through this hook.
 * Three modes:
 *   - "slim" (default): Just id + display_name. Uses slim=true (1 pluck query, ~10ms)
 *   - "select": Picker-friendly data (id, display_name, entity_type, email, employer_name).
 *              Uses for=select (3 queries, ~50ms)
 *   - "full": Full serialization with all associations. Only for pages that need everything.
 *
 * @example Basic picker (just names):
 * ```tsx
 * const { contacts, loading } = useContacts({ type: "suppliers" });
 * ```
 *
 * @example With email + entity type (signer panel, email compose):
 * ```tsx
 * const { contacts, loading } = useContacts({ mode: "select", withEmail: true });
 * ```
 *
 * @example Company picker:
 * ```tsx
 * const { contacts, loading } = useContacts({ entityType: "company,trust,sole_trader" });
 * ```
 */

export interface ContactSlim {
  id: number;
  display_name: string;
}

export interface ContactSelect extends ContactSlim {
  entity_type?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  employer_name?: string | null;
}

// Module-level caches keyed by filter params
// Contacts change more often than doc types, but within a session pickers
// don't need to refetch every mount.
const cache = new Map<string, { data: ContactSlim[] | ContactSelect[]; timestamp: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

function getCacheKey(options: UseContactsOptions): string {
  const { mode = "slim", type, entityType, withEmail } = options;
  return `${mode}|${type || ""}|${entityType || ""}|${withEmail || ""}`;
}

export interface UseContactsOptions {
  /** "suppliers" or "customers" - maps to ?type= */
  type?: "suppliers" | "customers";
  /** Comma-separated entity types: "company,trust,sole_trader,person" */
  entityType?: string;
  /** Only return contacts with email addresses */
  withEmail?: boolean;
  /** "slim" = id+name (default), "select" = +entity_type/email/employer, "full" = everything */
  mode?: "slim" | "select" | "full";
  /** Skip fetching (e.g., when data comes from props) */
  skip?: boolean;
}

interface UseContactsResult<T> {
  contacts: T[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useContacts(
  options: UseContactsOptions & { mode: "select" }
): UseContactsResult<ContactSelect>;
export function useContacts(
  options: UseContactsOptions & { mode: "full" }
): UseContactsResult<Record<string, unknown>>;
export function useContacts(
  options?: UseContactsOptions
): UseContactsResult<ContactSlim>;
export function useContacts(
  options: UseContactsOptions = {}
): UseContactsResult<ContactSlim | ContactSelect | Record<string, unknown>> {
  const { type, entityType, withEmail, mode = "slim", skip = false } = options;
  const [data, setData] = useState<(ContactSlim | ContactSelect | Record<string, unknown>)[]>([]);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return;
    }

    // Check module-level cache (not for full mode - too variable)
    if (mode !== "full") {
      const key = getCacheKey(options);
      const cached = cache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setData(cached.data);
        setLoading(false);
        return;
      }
    }

    let cancelled = false;

    async function fetchContacts() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();

        // Mode determines fast path
        if (mode === "slim") params.set("slim", "true");
        if (mode === "select") params.set("for", "select");

        // Filters
        if (type) params.set("type", type);
        if (entityType) params.set("entity_type", entityType);
        if (withEmail) params.set("with_email", "true");

        const url = `/api/v1/contacts?${params.toString()}`;
        const response = await api.get<{ success: boolean; contacts: ContactSlim[] | ContactSelect[] }>(url);

        if (!cancelled) {
          const result = response?.contacts || [];
          setData(result);

          // Cache slim/select results
          if (mode !== "full") {
            const key = getCacheKey(options);
            cache.set(key, { data: result, timestamp: Date.now() });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load contacts");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchContacts();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, entityType, withEmail, mode, skip, refreshCount]);

  return {
    contacts: data,
    loading,
    error,
    refresh: () => setRefreshCount((c) => c + 1),
  };
}

/** Invalidate all contact caches (call after create/update/delete/merge) */
export function clearContactsCache() {
  cache.clear();
}
