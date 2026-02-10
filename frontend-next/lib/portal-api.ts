import axios from "axios";
import { getStorageItem, STORAGE_KEYS } from "./storage-utils";

/**
 * Portal API Client - SSoT for portal authenticated requests
 *
 * Creates an axios instance that automatically attaches the portal Bearer token.
 * Replaces the repeated pattern of:
 *   const token = getStorageItem(STORAGE_KEYS.PORTAL_TOKEN, "");
 *   axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
 *
 * Usage:
 *   import { portalApi } from "@/lib/portal-api";
 *   const res = await portalApi.get("/api/v1/portal/jobs");
 */
export const portalApi = axios.create();

// Attach token on every request via interceptor
portalApi.interceptors.request.use((config) => {
  const token = getStorageItem(STORAGE_KEYS.PORTAL_TOKEN, "");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
