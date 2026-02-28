import axios from "axios";
import { getStorageItem, STORAGE_KEYS } from "./storage-utils";
import { getApiBaseUrl } from "./api";

/**
 * Portal API Client - SSoT for portal authenticated requests
 *
 * Creates an axios instance that automatically attaches the portal Bearer token
 * and resolves the backend base URL (critical for Vercel where relative URLs
 * would hit the Next.js server instead of Heroku).
 *
 * Usage:
 *   import { portalApi } from "@/lib/portal-api";
 *   const res = await portalApi.get("/api/v1/portal/jobs");
 */
export const portalApi = axios.create();

// Attach token + baseURL on every request via interceptor
portalApi.interceptors.request.use((config) => {
  const token = getStorageItem(STORAGE_KEYS.PORTAL_TOKEN, "");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Resolve baseURL dynamically so it picks up the stored api_url
  config.baseURL = getApiBaseUrl();
  return config;
});
