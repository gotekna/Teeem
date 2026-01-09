/**
 * Contact Choices - Single Source of Truth
 *
 * This file provides choice definitions for Contact fields fetched from the backend API.
 * The backend's Contact model constants are the true SSoT:
 * - Contact::ENTITY_TYPES
 * - Contact::EMPLOYMENT_STATUSES
 * - Contact::ROLES
 *
 * API Endpoints:
 * - GET /api/v1/contacts/entity_types
 * - GET /api/v1/contacts/employment_statuses
 * - GET /api/v1/contacts/roles
 *
 * IMPORTANT: Do NOT hardcode these values elsewhere in the frontend.
 * Always import from this file.
 */

import { api } from "@/lib/api";

// Generic choice metadata
export interface ChoiceMetadata {
  value: string;
  label: string;
}

// Response types
export interface EmploymentStatusesResponse {
  success: boolean;
  employment_statuses: string[];
  metadata: ChoiceMetadata[];
}

export interface RolesResponse {
  success: boolean;
  roles: string[];
  metadata: ChoiceMetadata[];
}

// Caches
let cachedEmploymentStatuses: EmploymentStatusesResponse | null = null;
let employmentStatusesPromise: Promise<EmploymentStatusesResponse> | null = null;

let cachedRoles: RolesResponse | null = null;
let rolesPromise: Promise<RolesResponse> | null = null;

/**
 * Fetch employment statuses from the backend API (with caching)
 */
export async function fetchEmploymentStatuses(): Promise<EmploymentStatusesResponse> {
  if (cachedEmploymentStatuses) {
    return cachedEmploymentStatuses;
  }

  if (employmentStatusesPromise) {
    return employmentStatusesPromise;
  }

  employmentStatusesPromise = api.get<EmploymentStatusesResponse>("/api/v1/contacts/employment_statuses")
    .then((response) => {
      if (response) {
        cachedEmploymentStatuses = response;
        return response;
      }
      return getDefaultEmploymentStatuses();
    })
    .catch((error) => {
      console.error("Failed to fetch employment statuses:", error);
      return getDefaultEmploymentStatuses();
    })
    .finally(() => {
      employmentStatusesPromise = null;
    });

  return employmentStatusesPromise;
}

/**
 * Fetch roles from the backend API (with caching)
 */
export async function fetchRoles(): Promise<RolesResponse> {
  if (cachedRoles) {
    return cachedRoles;
  }

  if (rolesPromise) {
    return rolesPromise;
  }

  rolesPromise = api.get<RolesResponse>("/api/v1/contacts/roles")
    .then((response) => {
      if (response) {
        cachedRoles = response;
        return response;
      }
      return getDefaultRoles();
    })
    .catch((error) => {
      console.error("Failed to fetch roles:", error);
      return getDefaultRoles();
    })
    .finally(() => {
      rolesPromise = null;
    });

  return rolesPromise;
}

/**
 * Clear all contact choices caches
 */
export function clearContactChoicesCache(): void {
  cachedEmploymentStatuses = null;
  employmentStatusesPromise = null;
  cachedRoles = null;
  rolesPromise = null;
}

// Fallback defaults (should match Contact model constants)
function getDefaultEmploymentStatuses(): EmploymentStatusesResponse {
  const statuses = ["active", "contractor", "inactive"];
  return {
    success: true,
    employment_statuses: statuses,
    metadata: statuses.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))
  };
}

function getDefaultRoles(): RolesResponse {
  const roles = ["Employee", "sales", "land_agent", "Director", "Company_Secretary", "Public_Officer", "CEO", "GM", "Owner"];
  return {
    success: true,
    roles: roles,
    metadata: roles.map(r => ({ value: r, label: r.replace(/_/g, " ") }))
  };
}
