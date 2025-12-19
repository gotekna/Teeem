import { useState, useEffect } from "react";

/**
 * Custom hook to fetch images from authenticated endpoints and convert to blob URLs
 *
 * Problem: When frontend and backend are on different domains (e.g., Vercel + Heroku),
 * <img src="backend-url" /> doesn't send authentication cookies, resulting in 401 errors.
 *
 * Solution: Fetch the image via authenticated fetch(), convert to blob, create object URL.
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
        // Get JWT token from localStorage (same as api.ts does)
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

        // Build headers with JWT token
        const headers: HeadersInit = {
          Accept: "image/png, image/jpeg, image/jpg, image/webp, image/*",
        };

        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        // Fetch with credentials and Authorization header
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status} ${response.statusText}`);
        }

        // Convert to blob
        const blob = await response.blob();

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
