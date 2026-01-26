import { useState, useEffect } from "react";
import { api } from "@/lib/api";

/**
 * Custom hook to fetch images from authenticated endpoints and convert to blob URLs
 *
 * Problem: When frontend and backend are on different domains (e.g., Vercel + Heroku),
 * <img src="backend-url" /> doesn't send authentication cookies, resulting in 401 errors.
 *
 * Solution: Use api.getBlob() (SSoT for authenticated blob requests), convert to object URL.
 *
 * @param url - The URL to fetch (can be null)
 * @returns Object with { imageUrl, loading, error }
 */
export function useAuthenticatedImage(url: string | null) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url) {
      setImageUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    const fetchImage = async () => {
      setLoading(true);
      setError(null);

      try {
        // Use api.getBlob (SSoT for authenticated blob requests)
        const blob = await api.getBlob(url);

        // Check if the component is still mounted
        if (cancelled) {
          return;
        }

        // Create object URL
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          console.error("[useAuthenticatedImage] Failed to load:", err);
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchImage();

    // Cleanup: revoke object URL on unmount or URL change
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  return { imageUrl, loading, error };
}
