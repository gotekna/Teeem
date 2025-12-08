/**
 * React hooks for contact choices (SSoT)
 *
 * Usage:
 * const { employmentStatuses, roles, loading } = useContactChoices();
 */

import { useState, useEffect } from "react";
import {
  fetchEmploymentStatuses,
  fetchRoles,
  ChoiceMetadata,
  EmploymentStatusesResponse,
  RolesResponse
} from "@/lib/contact-choices";

interface UseContactChoicesResult {
  /** Employment statuses from Contact::EMPLOYMENT_STATUSES */
  employmentStatuses: string[];
  employmentStatusMetadata: ChoiceMetadata[];
  /** Roles from Contact::ROLES */
  roles: string[];
  roleMetadata: ChoiceMetadata[];
  /** Loading state */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
}

export function useContactChoices(): UseContactChoicesResult {
  const [employmentData, setEmploymentData] = useState<EmploymentStatusesResponse | null>(null);
  const [rolesData, setRolesData] = useState<RolesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [empResponse, rolesResponse] = await Promise.all([
          fetchEmploymentStatuses(),
          fetchRoles()
        ]);
        setEmploymentData(empResponse);
        setRolesData(rolesResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load contact choices");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return {
    employmentStatuses: employmentData?.employment_statuses || [],
    employmentStatusMetadata: employmentData?.metadata || [],
    roles: rolesData?.roles || [],
    roleMetadata: rolesData?.metadata || [],
    loading,
    error
  };
}
