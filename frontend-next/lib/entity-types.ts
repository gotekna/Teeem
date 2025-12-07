/**
 * Entity Types - Single Source of Truth
 *
 * This file provides entity type definitions that are fetched from the backend API.
 * The backend's Contact::ENTITY_TYPES is the true SSoT.
 *
 * API Endpoint: GET /api/v1/contacts/entity_types
 *
 * IMPORTANT: Do NOT hardcode entity types elsewhere in the frontend.
 * Always import from this file.
 */

import { api } from "@/lib/api";

// TypeScript interface matching backend metadata
export interface EntityTypeMetadata {
  value: string;
  label: string;
  description: string;
  icon: "user" | "building" | "dollar";
  has_first_last_name: boolean;
  can_have_employer: boolean;
  can_have_employees: boolean;
  show_in_create_form: boolean;
}

export interface EntityTypesResponse {
  success: boolean;
  entity_types: string[];
  metadata: EntityTypeMetadata[];
}

// Cache for entity types to avoid repeated API calls
let cachedEntityTypes: EntityTypesResponse | null = null;
let cachePromise: Promise<EntityTypesResponse> | null = null;

/**
 * Fetch entity types from the backend API (with caching)
 */
export async function fetchEntityTypes(): Promise<EntityTypesResponse> {
  // Return cached data if available
  if (cachedEntityTypes) {
    return cachedEntityTypes;
  }

  // If a fetch is already in progress, wait for it
  if (cachePromise) {
    return cachePromise;
  }

  // Start the fetch
  cachePromise = api.get<EntityTypesResponse>("/api/v1/contacts/entity_types")
    .then((response) => {
      if (response) {
        cachedEntityTypes = response;
        return response;
      }
      // Fallback to hardcoded values if API fails
      return getDefaultEntityTypes();
    })
    .catch((error) => {
      console.error("Failed to fetch entity types:", error);
      // Fallback to hardcoded values if API fails
      return getDefaultEntityTypes();
    })
    .finally(() => {
      cachePromise = null;
    });

  return cachePromise;
}

/**
 * Clear the entity types cache (useful for testing or after updates)
 */
export function clearEntityTypesCache(): void {
  cachedEntityTypes = null;
  cachePromise = null;
}

/**
 * Fallback entity types if API is unavailable
 * These should match Contact::ENTITY_TYPES in the backend
 */
function getDefaultEntityTypes(): EntityTypesResponse {
  return {
    success: true,
    entity_types: ["person", "company", "trust", "sole_trader", "price_only"],
    metadata: [
      {
        value: "person",
        label: "Person",
        description: "Individual contact",
        icon: "user",
        has_first_last_name: true,
        can_have_employer: true,
        can_have_employees: false,
        show_in_create_form: true
      },
      {
        value: "company",
        label: "Company",
        description: "Business entity (Pty Ltd, Ltd, Inc)",
        icon: "building",
        has_first_last_name: false,
        can_have_employer: false,
        can_have_employees: true,
        show_in_create_form: true
      },
      {
        value: "sole_trader",
        label: "Sole Trader",
        description: "Individual trading as a business",
        icon: "user",
        has_first_last_name: true,
        can_have_employer: false,
        can_have_employees: true,
        show_in_create_form: true
      },
      {
        value: "trust",
        label: "Trust",
        description: "Trust entity (Family Trust, Unit Trust)",
        icon: "building",
        has_first_last_name: false,
        can_have_employer: false,
        can_have_employees: true,
        show_in_create_form: true
      },
      {
        value: "price_only",
        label: "Price Only",
        description: "Contact used only for pricebook pricing (no other info)",
        icon: "dollar",
        has_first_last_name: false,
        can_have_employer: false,
        can_have_employees: false,
        show_in_create_form: false
      }
    ]
  };
}

// ============================================
// Helper functions for common entity type checks
// ============================================

/**
 * Check if entity type is a person (individual with first/last name)
 */
export function isPerson(entityType: string | null | undefined): boolean {
  return entityType === "person";
}

/**
 * Check if entity type is a sole trader (individual trading as business)
 */
export function isSoleTrader(entityType: string | null | undefined): boolean {
  return entityType === "sole_trader";
}

/**
 * Check if entity type is a company
 */
export function isCompany(entityType: string | null | undefined): boolean {
  return entityType === "company";
}

/**
 * Check if entity type is a trust
 */
export function isTrust(entityType: string | null | undefined): boolean {
  return entityType === "trust";
}

/**
 * Check if entity type is price_only (legacy/internal)
 */
export function isPriceOnly(entityType: string | null | undefined): boolean {
  return entityType === "price_only";
}

/**
 * Check if entity type uses first/last name fields
 */
export function hasFirstLastName(entityType: string | null | undefined): boolean {
  return entityType === "person" || entityType === "sole_trader";
}

/**
 * Check if entity type uses company_name_or_trust field
 */
export function hasCompanyName(entityType: string | null | undefined): boolean {
  return entityType === "company" || entityType === "trust";
}

/**
 * Check if entity type can have employees
 */
export function canHaveEmployees(entityType: string | null | undefined): boolean {
  return entityType === "company" || entityType === "trust" || entityType === "sole_trader";
}

/**
 * Check if entity type can have an employer (be linked to a company)
 * Only persons (employees) can have an employer - sole traders trade/do business, they don't work FOR companies
 */
export function canHaveEmployer(entityType: string | null | undefined): boolean {
  return entityType === "person";
}

/**
 * Get the icon name for an entity type
 */
export function getEntityTypeIcon(entityType: string | null | undefined): "user" | "building" | "dollar" {
  switch (entityType) {
    case "person":
    case "sole_trader":
      return "user";
    case "company":
    case "trust":
      return "building";
    case "price_only":
      return "dollar";
    default:
      return "user";
  }
}

/**
 * Get display label for an entity type
 */
export function getEntityTypeLabel(entityType: string | null | undefined): string {
  switch (entityType) {
    case "person":
      return "Person";
    case "company":
      return "Company";
    case "trust":
      return "Trust";
    case "sole_trader":
      return "Sole Trader";
    case "price_only":
      return "Price Only";
    default:
      return entityType || "Unknown";
  }
}

/**
 * Get emoji badge for entity type (for display in lists/badges)
 */
export function getEntityTypeBadge(entityType: string | null | undefined): string {
  switch (entityType) {
    case "person":
      return "👤 Person";
    case "company":
      return "🏢 Company";
    case "trust":
      return "🏛️ Trust";
    case "sole_trader":
      return "👷 Sole Trader";
    case "price_only":
      return "💲 Price Only";
    default:
      return entityType || "Unknown";
  }
}
