import type { ListingsResponse, FiltersResponse, SdaListing, EnquiryFormData } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  const json = await res.json();
  if (json.success === false) {
    throw new Error(json.error || "Unknown API error");
  }
  return json.data;
}

export async function getListings(params?: Record<string, string>): Promise<ListingsResponse> {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<ListingsResponse>(`/api/v1/public/sda_listings${query}`);
}

export async function getFeaturedListings(): Promise<SdaListing[]> {
  return apiFetch<SdaListing[]>("/api/v1/public/sda_listings/featured");
}

export async function getFilters(): Promise<FiltersResponse> {
  return apiFetch<FiltersResponse>("/api/v1/public/sda_listings/filters");
}

export async function getListing(slug: string): Promise<SdaListing> {
  return apiFetch<SdaListing>(`/api/v1/public/sda_listings/${slug}`);
}

export async function submitEnquiry(slug: string, data: EnquiryFormData): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/public/sda_listings/${slug}/enquire`, {
    method: "POST",
    body: JSON.stringify({ enquiry: data }),
  });
}
