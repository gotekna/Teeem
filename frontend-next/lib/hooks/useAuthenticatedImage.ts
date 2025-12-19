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
        console.log("[useAuthenticatedImage] Fetching:", url);

        // Get JWT token from localStorage (same as api.ts does)
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

        // Build headers with JWT token
        const headers: HeadersInit = {
          Accept: "image/png, image/jpeg, image/jpg, image/webp, image/*",
        };

        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
          console.log("[useAuthenticatedImage] Added Authorization header");
        } else {
          console.warn("[useAuthenticatedImage] No auth token found in localStorage");
        }

        // Fetch with credentials and Authorization header
        const response = await fetch(url, {
          method: "GET",
          credentials: "include", // Send cookies for cross-origin requests
          headers,
        });

        console.log("[useAuthenticatedImage] Response status:", response.status, response.statusText);

        if (!response.ok) {
          const errorMsg = `Failed to load image: ${response.status} ${response.statusText}`;
          console.error("[useAuthenticatedImage]", errorMsg);
          throw new Error(errorMsg);
        }

        // Convert to blob
        const blob = await response.blob();
        console.log("[useAuthenticatedImage] Blob created:", blob.size, "bytes");

        // Check if the component is still mounted
        if (cancelled) {
          console.log("[useAuthenticatedImage] Component unmounted, skipping");
          return;
        }

        // Create object URL
        objectUrl = URL.createObjectURL(blob);
        console.log("[useAuthenticatedImage] Object URL created:", objectUrl);
        setImageUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          console.error("[useAuthenticatedImage] Error:", err);
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (!cancelled) {
          console.log("[useAuthenticatedImage] Setting loading to false");
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
