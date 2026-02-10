/**
 * Job Role Constants (SSoT)
 *
 * Internal team roles used across Job-related components.
 * These are the roles assigned to internal team members on a job.
 */

export const INTERNAL_ROLES = [
  { key: "supervisor", label: "Supervisor" },
  { key: "site_coordinator", label: "Site Coordinator" },
  { key: "estimator", label: "Estimator" },
  { key: "internal_sales", label: "Internal Sales" },
  { key: "coordinator", label: "Client Coordinator" },
] as const;

export type InternalRoleKey = typeof INTERNAL_ROLES[number]['key'];

export const INTERNAL_ROLE_KEYS: readonly InternalRoleKey[] = INTERNAL_ROLES.map(r => r.key);
