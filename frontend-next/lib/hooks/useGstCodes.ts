import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { type GstCodeOption } from "@/lib/constants/purchase-order-constants";

/**
 * useGstCodes - Fetch GST codes from the database (SSoT)
 *
 * No static fallback. If the API fails, gstCodes will be empty
 * and getGstRateFromCodes will throw — fail fast.
 */
export function useGstCodes(): {
  gstCodes: GstCodeOption[];
  loading: boolean;
  error: string | null;
} {
  const [gstCodes, setGstCodes] = useState<GstCodeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCodes() {
      try {
        const res = await api.get<{
          success: boolean;
          gst_codes: Array<{ code: string; name: string; rate: number; active: boolean }>;
        }>("/api/v1/gst_codes?active=true");

        if (!cancelled && res.success) {
          setGstCodes(
            res.gst_codes.map((gc) => ({
              value: gc.code,
              label: gc.name,
              rate: gc.rate,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load GST codes");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCodes();
    return () => { cancelled = true; };
  }, []);

  return { gstCodes, loading, error };
}
