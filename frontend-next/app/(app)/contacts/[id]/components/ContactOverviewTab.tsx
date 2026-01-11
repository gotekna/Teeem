"use client";

import React, { useCallback, useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PAGE_SIZE_AUTOCOMPLETE } from "@/lib/constants/pagination-constants";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  hasFirstLastName,
  canHaveEmployees,
  canHaveEmployer,
  type EntityTypeMetadata,
} from "@/lib/entity-types";
import {
  PropertyRow,
  PropertySection,
  PhonePropertyGroup,
  EmailPropertyGroup,
  AddressPropertyGroup,
} from "@/components/contact";
import { SortableList, SortableItem } from "@/components/ui/dnd";
import type {
  Contact,
  ContactEmail,
  ContactPhone,
  ContactAddress,
  ContactRelationship,
  RelationshipTypeMetadata,
} from "../types";
import {
  formatABN,
  formatACN,
  validateABN,
  validateACN,
} from "../types";
import {
  Link2,
  Users,
  Building2,
  ExternalLink,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

// Simplified props - component manages its own state
interface ContactOverviewTabProps {
  contact: Contact;
  onContactUpdate: (updatedContact: Contact) => void;
  entityTypeMetadata: EntityTypeMetadata[];
}

/**
 * ContactOverviewTab - Redesigned property panel layout
 *
 * Key changes from legacy:
 * - Single-column property panel layout (Notion/Linear-style)
 * - Click-to-edit for all fields
 * - Auto-save on blur with visual feedback
 * - No separate Save button needed
 * - State managed internally per field
 */
export function ContactOverviewTab({
  contact,
  onContactUpdate,
  entityTypeMetadata,
}: ContactOverviewTabProps) {
  const { toast } = useToast();
  const [relatedEntities, setRelatedEntities] = useState<ContactRelationship[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Employer/company link state
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [companySearchResults, setCompanySearchResults] = useState<{ id: number; name: string; entity_type: string }[]>([]);
  const [searchingCompany, setSearchingCompany] = useState(false);
  const [savingCompanyLink, setSavingCompanyLink] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [companyRelationships, setCompanyRelationships] = useState<ContactRelationship[]>([]);
  const [availableRoles, setAvailableRoles] = useState<{ id: number; name: string }[]>([]);
  const [editingRelationshipId, setEditingRelationshipId] = useState<number | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<number[]>([]);

  // Employee/person link state (for companies)
  const [showPersonSearch, setShowPersonSearch] = useState(false);
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [personSearchResults, setPersonSearchResults] = useState<{ id: number; name: string; entity_type: string }[]>([]);
  const [searchingPerson, setSearchingPerson] = useState(false);
  const [savingPersonLink, setSavingPersonLink] = useState(false);

  // Load related entities
  useEffect(() => {
    if (contact.id) {
      loadRelatedEntities();
    }
  }, [contact.id]);

  // Load available contact roles from contact_types API (SSoT - same as ContactTypesTab)
  useEffect(() => {
    const loadRoles = async () => {
      try {
        // Use same API as ContactTypesTab: /api/v1/contact_types
        const response = await api.get<Array<{ id: number; name: string; display_name: string; active: boolean }>>("/api/v1/contact_types");
        // Filter to active only, map to id/name format using display_name for user-friendly labels
        const roles = (response || [])
          .filter(r => r.active)
          .map(r => ({
            id: r.id,
            name: r.display_name || r.name
          }));
        setAvailableRoles(roles);
      } catch {
        // Fallback to empty - will just show employee link without role selection
        setAvailableRoles([]);
      }
    };
    loadRoles();
  }, []);

  const loadRelatedEntities = useCallback(async () => {
    if (!contact.id) return;
    setLoadingRelated(true);
    try {
      const response = await api.get<{
        success: boolean;
        relationships: { outgoing: ContactRelationship[]; incoming: ContactRelationship[] };
      }>(`/api/v1/contacts/${contact.id}/relationships`);
      if (response.success) {
        const outgoing = response.relationships.outgoing || [];
        const incoming = response.relationships.incoming || [];

        // Extract company relationships (person → company links)
        const companyRelTypes = ["employee_of", "contractor_for", "owner_of", "beneficial_owner_of", "partner_in"];
        const companyRels = outgoing.filter(r => companyRelTypes.includes(r.relationship_type));
        setCompanyRelationships(companyRels);

        // Other relationships (excluding company links to avoid duplication)
        const otherRels = [...outgoing, ...incoming].filter(r => !companyRelTypes.includes(r.relationship_type));
        setRelatedEntities(otherRels);
      }
    } catch {
      // Silent fail - relationships are optional
    } finally {
      setLoadingRelated(false);
    }
  }, [contact.id]);

  // Search for companies to link
  const searchCompanies = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setCompanySearchResults([]);
      return;
    }
    setSearchingCompany(true);
    try {
      // SSoT: Uses PAGE_SIZE_AUTOCOMPLETE from pagination-constants.ts
      const response = await api.get<{ contacts?: Array<{ id: number; display_name?: string; company_name_or_trust?: string; entity_type: string }> }>("/api/v1/contacts", {
        params: {
          search: query,
          per_page: PAGE_SIZE_AUTOCOMPLETE,
          entity_types: "company,trust,partnership,sole_trader"
        },
      });
      // Exclude self and already-linked companies
      const linkedCompanyIds = companyRelationships.map(r => r.related_contact_id);
      const companies = (response.contacts || [])
        .filter(c => c.id !== contact.id && !linkedCompanyIds.includes(c.id))
        .map(c => ({
          id: c.id,
          name: c.display_name || c.company_name_or_trust || "Unknown",
          entity_type: c.entity_type,
        }));
      setCompanySearchResults(companies);
    } catch {
      setCompanySearchResults([]);
    } finally {
      setSearchingCompany(false);
    }
  }, [contact.id, companyRelationships]);

  // Debounced company search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (companySearchQuery) {
        searchCompanies(companySearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [companySearchQuery, searchCompanies]);

  // Add company link - always employee_of, with optional roles (multi-select)
  const addCompanyLink = useCallback(async (companyId: number) => {
    setSavingCompanyLink(true);
    try {
      // Ensure role_ids are integers (API requires whole numbers)
      const intRoleIds = selectedRoleIds.map(id => parseInt(String(id), 10)).filter(id => !isNaN(id));
      await api.post(`/api/v1/contacts/${contact.id}/relationships`, {
        contact_relationship: {
          related_contact_id: companyId,
          relationship_type: "employee_of", // Always employee_of
          role_ids: intRoleIds, // Multi-role support - array of ContactType IDs
        },
      });

      // Refresh contact and relationships
      const [contactRes] = await Promise.all([
        api.get<{ contact: Contact }>(`/api/v1/contacts/${contact.id}`),
        loadRelatedEntities(),
      ]);
      onContactUpdate(contactRes.contact);

      // Reset search state
      setShowCompanySearch(false);
      setCompanySearchQuery("");
      setCompanySearchResults([]);
      setSelectedRoleIds([]);

      const roleNames = selectedRoleIds.length > 0
        ? availableRoles.filter(r => selectedRoleIds.includes(r.id)).map(r => r.name).join(", ")
        : "Employee";
      toast({
        title: "Company linked",
        description: `Added as ${roleNames}`,
      });
    } catch (err) {
      toast({
        title: "Error linking company",
        description: err instanceof Error ? err.message : "Failed to link company",
        variant: "destructive",
      });
    } finally {
      setSavingCompanyLink(false);
    }
  }, [contact.id, selectedRoleIds, availableRoles, onContactUpdate, loadRelatedEntities, toast]);

  // Update roles for existing relationship
  const updateRelationshipRoles = useCallback(async (relationshipId: number, newRoleIds: number[]) => {
    setSavingCompanyLink(true);
    try {
      // Ensure role_ids are integers (API requires whole numbers)
      const intRoleIds = newRoleIds.map(id => parseInt(String(id), 10)).filter(id => !isNaN(id));
      await api.patch(`/api/v1/contacts/${contact.id}/relationships/${relationshipId}`, {
        contact_relationship: {
          role_ids: intRoleIds,
        },
      });

      // Refresh relationships
      await loadRelatedEntities();

      setEditingRelationshipId(null);
      setEditRoleIds([]);

      toast({
        title: "Roles updated",
        description: "Relationship roles have been updated",
      });
    } catch (err) {
      toast({
        title: "Error updating roles",
        description: err instanceof Error ? err.message : "Failed to update roles",
        variant: "destructive",
      });
    } finally {
      setSavingCompanyLink(false);
    }
  }, [contact.id, loadRelatedEntities, toast]);

  // Toggle role selection (for multi-select)
  const toggleRoleId = (roleId: number, currentIds: number[], setter: (ids: number[]) => void) => {
    if (currentIds.includes(roleId)) {
      setter(currentIds.filter(id => id !== roleId));
    } else {
      setter([...currentIds, roleId]);
    }
  };

  // Remove company relationship
  const removeCompanyLink = useCallback(async (relationshipId: number) => {
    setSavingCompanyLink(true);
    try {
      await api.delete(`/api/v1/contacts/${contact.id}/relationships/${relationshipId}`);

      // Refresh contact and relationships
      const [contactRes] = await Promise.all([
        api.get<{ contact: Contact }>(`/api/v1/contacts/${contact.id}`),
        loadRelatedEntities(),
      ]);
      onContactUpdate(contactRes.contact);

      toast({
        title: "Link removed",
        description: "Company relationship removed",
      });
    } catch (err) {
      toast({
        title: "Error removing link",
        description: err instanceof Error ? err.message : "Failed to remove link",
        variant: "destructive",
      });
    } finally {
      setSavingCompanyLink(false);
    }
  }, [contact.id, onContactUpdate, loadRelatedEntities, toast]);

  // Search for people to add as employees (for companies)
  const searchPeople = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setPersonSearchResults([]);
      return;
    }
    setSearchingPerson(true);
    try {
      // SSoT: Uses PAGE_SIZE_AUTOCOMPLETE from pagination-constants.ts
      const response = await api.get<{ contacts?: Array<{ id: number; display_name?: string; first_name?: string; last_name?: string; entity_type: string }> }>("/api/v1/contacts", {
        params: {
          search: query,
          per_page: PAGE_SIZE_AUTOCOMPLETE,
          entity_type: "person"
        },
      });
      // Exclude self and already-linked employees
      const employeeIds = contact.employees?.map(e => e.id) || [];
      const people = (response.contacts || [])
        .filter(c => c.id !== contact.id && !employeeIds.includes(c.id))
        .map(c => ({
          id: c.id,
          name: c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || "Unknown",
          entity_type: c.entity_type,
        }));
      setPersonSearchResults(people);
    } catch {
      setPersonSearchResults([]);
    } finally {
      setSearchingPerson(false);
    }
  }, [contact.id, contact.employees]);

  // Debounce person search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (personSearchQuery) {
        searchPeople(personSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [personSearchQuery, searchPeople]);

  // Add person as employee (for companies)
  const addPersonAsEmployee = useCallback(async (personId: number) => {
    setSavingPersonLink(true);
    try {
      // Create relationship FROM person TO this company (employee_of)
      await api.post(`/api/v1/contacts/${personId}/relationships`, {
        contact_relationship: {
          related_contact_id: contact.id,
          relationship_type: "employee_of",
          is_active: true,
        },
      });

      // Refresh contact to get updated employees list
      const contactRes = await api.get<{ contact: Contact }>(`/api/v1/contacts/${contact.id}`);
      onContactUpdate(contactRes.contact);

      // Reset search state
      setShowPersonSearch(false);
      setPersonSearchQuery("");
      setPersonSearchResults([]);

      toast({
        title: "Person linked",
        description: "Added as employee",
      });
    } catch (err) {
      toast({
        title: "Error linking person",
        description: err instanceof Error ? err.message : "Failed to add employee",
        variant: "destructive",
      });
    } finally {
      setSavingPersonLink(false);
    }
  }, [contact.id, onContactUpdate, toast]);

  // Create a new person and add as employee (for companies)
  const createAndAddPersonAsEmployee = useCallback(async () => {
    if (!personSearchQuery.trim()) return;
    setSavingPersonLink(true);
    try {
      // Parse name - assume "First Last" format
      const nameParts = personSearchQuery.trim().split(/\s+/);
      const firstName = nameParts[0] || personSearchQuery.trim();
      const lastName = nameParts.slice(1).join(" ") || "";

      // Create the new person contact linked to this company
      const response = await api.post<{ contact: { id: number; display_name: string } }>("/api/v1/contacts", {
        contact: {
          first_name: firstName,
          last_name: lastName,
          display_name: personSearchQuery.trim(),
          entity_type: "person",
          primary_company_id: contact.id,
        },
      });

      if (response?.contact) {
        // Refresh contact to get updated employees list
        const contactRes = await api.get<{ contact: Contact }>(`/api/v1/contacts/${contact.id}`);
        onContactUpdate(contactRes.contact);

        toast({
          title: "Person created and linked",
          description: `Created "${response.contact.display_name}" as employee`,
        });
      }

      // Reset search state
      setShowPersonSearch(false);
      setPersonSearchQuery("");
      setPersonSearchResults([]);
    } catch (err) {
      toast({
        title: "Error creating person",
        description: err instanceof Error ? err.message : "Failed to create person",
        variant: "destructive",
      });
    } finally {
      setSavingPersonLink(false);
    }
  }, [contact.id, personSearchQuery, onContactUpdate, toast]);

  // Reorder company relationships (for DnD)
  const reorderCompanyLinks = useCallback(async (newOrder: ContactRelationship[]) => {
    // Update local state immediately for responsive UI
    setCompanyRelationships(newOrder);

    // Call backend API to persist the order
    try {
      const companyIds = newOrder.map((rel) => {
        const company = rel.related_contact || rel.other_contact;
        return company?.id;
      }).filter(Boolean);

      await api.post(`/api/v1/contacts/relationships/${contact.id}/reorder_companies`, {
        company_ids: companyIds,
      });

      // Refresh contact to get updated primary_company_id
      onContactUpdate({ ...contact });
    } catch (err) {
      toast({
        title: "Error reordering",
        description: err instanceof Error ? err.message : "Failed to save order",
        variant: "destructive",
      });
    }
  }, [contact, onContactUpdate, toast]);

  // Handle position change from typing a number in the badge
  const handleCompanyPositionChange = useCallback(
    async (currentIndex: number, newPosition: number) => {
      // newPosition is 1-indexed from UI, convert to 0-indexed
      const newIndex = newPosition - 1;
      if (newIndex === currentIndex || newIndex < 0 || newIndex >= companyRelationships.length) {
        return;
      }

      // Create new order by moving item from currentIndex to newIndex
      const newOrder = [...companyRelationships];
      const [movedItem] = newOrder.splice(currentIndex, 1);
      newOrder.splice(newIndex, 0, movedItem);

      // Trigger the reorder
      await reorderCompanyLinks(newOrder);
    },
    [companyRelationships, reorderCompanyLinks]
  );

  // Generic save function for single field updates
  const saveField = useCallback(
    async (fieldName: string, value: string | boolean | number | null): Promise<void> => {
      try {
        const response = await api.patch<{ contact: Contact }>(
          `/api/v1/contacts/${contact.id}`,
          { contact: { [fieldName]: value } }
        );
        onContactUpdate(response.contact);
      } catch (err) {
        toast({
          title: "Error saving",
          description: err instanceof Error ? err.message : "Failed to save",
          variant: "destructive",
        });
        throw err;
      }
    },
    [contact.id, onContactUpdate, toast]
  );

  // Save phones
  const savePhones = useCallback(
    async (phones: ContactPhone[]): Promise<void> => {
      try {
        // Filter out destroyed items that were never saved
        const phonesToSave = phones
          .filter((p) => !(p._destroy && !p.id))
          .map((p) => {
            const { _tempId, ...rest } = p as ContactPhone & { _tempId?: string };
            return rest;
          });

        const response = await api.patch<{ contact: Contact }>(
          `/api/v1/contacts/${contact.id}`,
          { contact: { contact_phones_attributes: phonesToSave } }
        );
        onContactUpdate(response.contact);
      } catch (err) {
        toast({
          title: "Error saving phones",
          description: err instanceof Error ? err.message : "Failed to save",
          variant: "destructive",
        });
        throw err;
      }
    },
    [contact.id, onContactUpdate, toast]
  );

  // Save emails
  const saveEmails = useCallback(
    async (emails: ContactEmail[]): Promise<void> => {
      try {
        // Filter out destroyed items that were never saved
        const emailsToSave = emails
          .filter((e) => !(e._destroy && !e.id))
          .map((e) => {
            // Only include valid ContactEmail fields - filter out any extra/empty keys
            return {
              ...(e.id && { id: e.id }),
              email: e.email,
              is_primary: e.is_primary,
              label: e.label,
              position: e.position,
              ...(e._destroy && { _destroy: e._destroy }),
            };
          });

        // Also sync primary email to legacy field
        const primaryEmail = emailsToSave.find((e) => e.is_primary && !e._destroy);

        console.log("[saveEmails] Saving emails:", { emailsToSave, primaryEmail: primaryEmail?.email, contactId: contact.id });

        const response = await api.patch<{ contact: Contact }>(
          `/api/v1/contacts/${contact.id}`,
          {
            contact: {
              contact_emails_attributes: emailsToSave,
              email: primaryEmail?.email || null,
            },
          }
        );
        console.log("[saveEmails] Success:", response);
        onContactUpdate(response.contact);
      } catch (err) {
        console.error("[saveEmails] Error:", err);
        toast({
          title: "Error saving emails",
          description: err instanceof Error ? err.message : "Failed to save",
          variant: "destructive",
        });
        throw err;
      }
    },
    [contact.id, onContactUpdate, toast]
  );

  // Save address
  const saveAddress = useCallback(
    async (address: ContactAddress): Promise<void> => {
      try {
        // Get existing addresses and update/add the street address
        const existingAddresses = contact.contact_addresses || [];
        const streetIndex = existingAddresses.findIndex(
          (a) => a.address_type === "STREET" && !a._destroy
        );

        let addressesToSave: ContactAddress[];
        if (streetIndex >= 0) {
          // Update existing
          addressesToSave = existingAddresses.map((a, i) =>
            i === streetIndex ? { ...a, ...address } : a
          );
        } else {
          // Add new
          addressesToSave = [...existingAddresses, address];
        }

        const response = await api.patch<{ contact: Contact }>(
          `/api/v1/contacts/${contact.id}`,
          { contact: { contact_addresses_attributes: addressesToSave } }
        );
        onContactUpdate(response.contact);
      } catch (err) {
        toast({
          title: "Error saving address",
          description: err instanceof Error ? err.message : "Failed to save",
          variant: "destructive",
        });
        throw err;
      }
    },
    [contact.id, contact.contact_addresses, onContactUpdate, toast]
  );

  // Get entity type options
  const entityTypeOptions = entityTypeMetadata.map((et) => ({
    value: et.value,
    label: et.label,
  }));

  // Get street address
  const streetAddress = contact.contact_addresses?.find(
    (a) => a.address_type === "STREET" && !a._destroy
  ) || null;

  // Helper: check if this is a person (not a company/trust)
  const isPerson = hasFirstLastName(contact.entity_type);

  // Calculate relationship counts for display
  const employeeCount = contact.employees?.length || 0;
  const relatedCount = relatedEntities.length;
  const hasRelationships = employeeCount > 0 || relatedCount > 0 || contact.primary_company;

  return (
    <div className="space-y-6">
      {/* Two-column grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Identity Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Identity</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isPerson ? (
                <>
                  <PropertyRow
                    label="First Name"
                    value={contact.first_name}
                    onSave={(value) => saveField("first_name", value)}
                    placeholder="Enter first name"
                  />
                  <PropertyRow
                    label="Middle Name"
                    value={contact.middle_name}
                    onSave={(value) => saveField("middle_name", value)}
                    placeholder="Enter middle name"
                  />
                  <PropertyRow
                    label="Last Name"
                    value={contact.last_name}
                    onSave={(value) => saveField("last_name", value)}
                    placeholder="Enter last name"
                  />
                </>
              ) : (
                <PropertyRow
                  label="Company/Trust Name"
                  value={contact.company_name_or_trust}
                  onSave={(value) => saveField("company_name_or_trust", value)}
                  placeholder="Enter company or trust name"
                />
              )}

              <PropertyRow
                label="Entity Type"
                value={contact.entity_type}
                onSave={(value) => saveField("entity_type", value)}
                type="select"
                options={entityTypeOptions}
              />

              <PropertyRow
                label="Active"
                value={contact.is_active}
                onSave={(value) => saveField("is_active", value)}
                type="switch"
              />

              <PropertyRow
                label="Team Contact"
                value={contact.is_team_contact}
                onSave={(value) => saveField("is_team_contact", value)}
                type="switch"
              />
            </CardContent>
          </Card>

          {/* Business & Tax Card - Hide for employees with primary company */}
          {!(canHaveEmployer(contact.entity_type) && contact.primary_company) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Business & Tax</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <PropertyRow
                  label="ABN"
                  value={contact.abn}
                  onSave={(value) => saveField("abn", value === "" ? null : value)}
                  format={formatABN}
                  validate={validateABN}
                  placeholder="00 000 000 000"
                  clearable
                />
                {/* ACN only for companies/trusts */}
                {!isPerson && (
                  <PropertyRow
                    label="ACN"
                    value={contact.acn}
                    onSave={(value) => saveField("acn", value === "" ? null : value)}
                    format={formatACN}
                    validate={validateACN}
                    placeholder="000 000 000"
                    clearable
                  />
                )}
                <PropertyRow
                  label="Sync with Xero"
                  value={contact.sync_with_xero}
                  onSave={(value) => saveField("sync_with_xero", value)}
                  type="switch"
                  hint="Keep contact synced with Xero"
                />
              </CardContent>
            </Card>
          )}

          {/* Supplier Settings Card - only for suppliers */}
          {contact["is_supplier?"] && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Team Configuration</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <PropertyRow
                  label="Team Size"
                  value={contact.team_size?.toString() || ""}
                  onSave={(value) => saveField("team_size", value ? parseInt(value.toString()) : null)}
                  placeholder="Number of workers"
                  hint="Used to auto-calculate task duration from PO amount"
                />
                <PropertyRow
                  label="Daily Rate"
                  value={contact.daily_rate_per_person?.toString() || "800"}
                  onSave={(value) => saveField("daily_rate_per_person", value ? parseFloat(value.toString()) : 800)}
                  placeholder="800"
                  hint="$ per person per day (default: $800)"
                />
              </CardContent>
            </Card>
          )}

          {/* Notes Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <PropertyRow
                label="Notes"
                value={contact.notes}
                onSave={(value) => saveField("notes", value)}
                type="textarea"
                placeholder="Add notes about this contact..."
                labelWidth="w-0"
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Contact Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Contact</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <EmailPropertyGroup
                contactId={contact.id}
                emails={contact.contact_emails || []}
                onSave={saveEmails}
              />

              <div className="my-3" />

              <PhonePropertyGroup
                contactId={contact.id}
                phones={contact.contact_phones || []}
                onSave={savePhones}
              />

              {/* Direct Line - dedicated field for person's direct phone number */}
              <PropertyRow
                label="Direct Line"
                value={contact.direct_line}
                onSave={(value) => saveField("direct_line", value)}
                placeholder="Direct phone number"
              />

              {/* Company Phones - show when person has a linked company */}
              {contact.primary_company?.contact_phones && contact.primary_company.contact_phones.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dashed">
                  <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {contact.primary_company.name} Phones
                  </div>
                  <div className="space-y-1">
                    {contact.primary_company.contact_phones.map((phone, idx) => (
                      <div key={phone.id || idx} className="flex items-center gap-2 text-sm py-1">
                        <span className="text-muted-foreground capitalize text-xs w-14">
                          {phone.phone_type}
                        </span>
                        <a
                          href={`tel:${phone.phone_number}`}
                          className="text-foreground hover:underline"
                        >
                          {phone.phone_number}
                        </a>
                        {phone.is_primary && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1">
                            Primary
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Website only for companies/trusts */}
              {!isPerson && (
                <>
                  <div className="my-3" />
                  <PropertyRow
                    label="Website"
                    value={contact.website}
                    onSave={(value) => saveField("website", value)}
                    type="url"
                    placeholder="https://example.com"
                    externalLink
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Address Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Address</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <AddressPropertyGroup
                contactId={contact.id}
                address={streetAddress}
                onSave={saveAddress}
              />
            </CardContent>
          </Card>

          {/* Relationships Card - shows company links, employees, and related contacts */}
          {/* Always show for persons (to add company links), companies (to add employees), or when there are relationships */}
          {(canHaveEmployer(contact.entity_type) || canHaveEmployees(contact.entity_type) || hasRelationships || companyRelationships.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Relationships
                  {(employeeCount + relatedCount + companyRelationships.length) > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {employeeCount + relatedCount + companyRelationships.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Company Links - for persons (with DnD reordering) */}
                {canHaveEmployer(contact.entity_type) && (
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Companies
                      {companyRelationships.length > 0 && (
                        <span className="ml-1">({companyRelationships.length})</span>
                      )}
                    </div>

                    {/* Show linked companies with DnD */}
                    {companyRelationships.length > 0 && (
                      <SortableList
                        items={companyRelationships}
                        onReorder={reorderCompanyLinks}
                        className="space-y-1 mb-3"
                      >
                        {companyRelationships.map((rel, index) => {
                          const company = rel.related_contact || rel.other_contact;
                          const companyName = company
                            ? ("display_name" in company ? company.display_name : "name" in company ? company.name : "Unknown")
                            : "Unknown";
                          // Display multiple roles from role_names array, fallback to role_in_relationship
                          const roleLabel = rel.role_names && rel.role_names.length > 0
                            ? rel.role_names.join(", ")
                            : rel.role_in_relationship || "Employee";
                          const isPrimary = index === 0;
                          const isEditing = editingRelationshipId === rel.id;

                          return (
                            <SortableItem
                              key={rel.id}
                              id={rel.id}
                              position={index + 1}
                              editableBadge
                              onPositionChange={(newPos) => handleCompanyPositionChange(index, newPos)}
                              maxPosition={companyRelationships.length}
                              className="flex flex-col gap-2 py-2 px-2 -mx-2 rounded-md bg-muted/30 group"
                            >
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-green-100 dark:bg-green-900/30">
                                  <Building2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Link
                                      href={`/contacts/${company?.id}`}
                                      className="text-sm font-medium truncate hover:underline"
                                    >
                                      {companyName}
                                    </Link>
                                    {isPrimary && (
                                      <Badge variant="default" className="text-[10px] h-4 px-1.5 bg-green-600">
                                        Primary
                                      </Badge>
                                    )}
                                  </div>
                                  {!isEditing && (
                                    <button
                                      className="text-xs text-muted-foreground hover:text-foreground hover:underline text-left"
                                      onClick={() => {
                                        setEditingRelationshipId(rel.id);
                                        setEditRoleIds(rel.role_ids || []);
                                      }}
                                    >
                                      {roleLabel}
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Link href={`/contacts/${company?.id}`}>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                  </Link>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeCompanyLink(rel.id)}
                                    disabled={savingCompanyLink}
                                  >
                                    {savingCompanyLink ? (
                                      <Spinner size={12} />
                                    ) : (
                                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                    )}
                                  </Button>
                                </div>
                              </div>

                              {/* Inline role editor */}
                              {isEditing && (
                                <div className="ml-10 space-y-2">
                                  <div className="flex flex-wrap gap-1">
                                    {availableRoles.map((role) => (
                                      <Button
                                        key={role.id}
                                        variant={editRoleIds.includes(role.id) ? "default" : "outline"}
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => toggleRoleId(role.id, editRoleIds, setEditRoleIds)}
                                      >
                                        {editRoleIds.includes(role.id) && "✓ "}
                                        {role.name}
                                      </Button>
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => updateRelationshipRoles(rel.id, editRoleIds)}
                                      disabled={savingCompanyLink}
                                    >
                                      {savingCompanyLink ? <Spinner size={12} /> : "Save"}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => {
                                        setEditingRelationshipId(null);
                                        setEditRoleIds([]);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </SortableItem>
                          );
                        })}
                      </SortableList>
                    )}

                    {/* Add company link interface */}
                    {showCompanySearch ? (
                      <div className="space-y-3">
                        {/* Role selector - multi-select from contact_types Foundation (SSoT) */}
                        {availableRoles.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              Select roles (optional):
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {availableRoles.map((role) => (
                                <Button
                                  key={role.id}
                                  variant={selectedRoleIds.includes(role.id) ? "default" : "outline"}
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => toggleRoleId(role.id, selectedRoleIds, setSelectedRoleIds)}
                                >
                                  {selectedRoleIds.includes(role.id) && "✓ "}
                                  {role.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Company search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search for a company..."
                            value={companySearchQuery}
                            onChange={(e) => setCompanySearchQuery(e.target.value)}
                            className="pl-9 pr-8"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                            onClick={() => {
                              setShowCompanySearch(false);
                              setCompanySearchQuery("");
                              setCompanySearchResults([]);
                              setSelectedRoleIds([]);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Search results */}
                        {searchingCompany ? (
                          <div className="flex items-center justify-center py-4">
                            <Spinner size={16} className="text-muted-foreground" />
                          </div>
                        ) : companySearchResults.length > 0 ? (
                          <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
                            {companySearchResults.map((company) => (
                              <button
                                key={company.id}
                                onClick={() => addCompanyLink(company.id)}
                                disabled={savingCompanyLink}
                                className="w-full text-left px-3 py-2 hover:bg-muted rounded-md transition-colors flex items-center gap-3"
                              >
                                <div className="h-7 w-7 rounded-full bg-muted dark:bg-slate-800 flex items-center justify-center shrink-0">
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground dark:text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{company.name}</div>
                                  <div className="text-xs text-muted-foreground capitalize">{company.entity_type}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : companySearchQuery.length >= 2 ? (
                          <div className="text-sm text-muted-foreground text-center py-3">
                            No companies found
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground text-center py-2">
                            Type at least 2 characters to search
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Add company button */
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowCompanySearch(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-2" />
                        Link Company
                      </Button>
                    )}
                  </div>
                )}

                {/* People/Employees - for companies */}
                {canHaveEmployees(contact.entity_type) && (
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      People {employeeCount > 0 && `(${employeeCount})`}
                    </div>
                    <div className="space-y-2">
                      {/* Existing employees */}
                      {employeeCount > 0 && (
                        <div className="space-y-1">
                          {contact.employees?.slice(0, 5).map((employee) => (
                            <Link
                              key={employee.id}
                              href={`/contacts/${employee.id}`}
                              className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-md hover:bg-muted/50 transition-colors"
                            >
                              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{employee.display_name}</div>
                                {employee.primary_role && (
                                  <div className="text-xs text-muted-foreground">{employee.primary_role}</div>
                                )}
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            </Link>
                          ))}
                          {employeeCount > 5 && (
                            <div className="text-xs text-muted-foreground text-center py-2">
                              +{employeeCount - 5} more people
                            </div>
                          )}
                        </div>
                      )}

                      {/* Person search interface */}
                      {showPersonSearch ? (
                        <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search for a person..."
                              value={personSearchQuery}
                              onChange={(e) => setPersonSearchQuery(e.target.value)}
                              className="pl-9 pr-8"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                              onClick={() => {
                                setShowPersonSearch(false);
                                setPersonSearchQuery("");
                                setPersonSearchResults([]);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* Search results */}
                          {searchingPerson ? (
                            <div className="flex items-center justify-center py-4">
                              <Spinner size={16} className="text-muted-foreground" />
                            </div>
                          ) : personSearchResults.length > 0 ? (
                            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
                              {personSearchResults.map((person) => (
                                <button
                                  key={person.id}
                                  onClick={() => addPersonAsEmployee(person.id)}
                                  disabled={savingPersonLink}
                                  className="w-full text-left px-3 py-2 hover:bg-muted rounded-md transition-colors flex items-center gap-3"
                                >
                                  <div className="h-7 w-7 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center shrink-0">
                                    <Users className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{person.name}</div>
                                  </div>
                                </button>
                              ))}
                              {/* Create new option at bottom of results */}
                              <button
                                onClick={createAndAddPersonAsEmployee}
                                disabled={savingPersonLink}
                                className="w-full text-left px-3 py-2 hover:bg-muted rounded-md transition-colors flex items-center gap-3 border-t border-dashed mt-1 pt-2"
                              >
                                <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                  {savingPersonLink ? (
                                    <Spinner size={12} className="text-blue-600 dark:text-blue-400" />
                                  ) : (
                                    <Plus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">Create "{personSearchQuery}"</div>
                                  <div className="text-xs text-muted-foreground">Add as new contact</div>
                                </div>
                              </button>
                            </div>
                          ) : personSearchQuery.length >= 2 ? (
                            <div className="text-sm text-muted-foreground text-center py-3 space-y-2">
                              <div>No people found</div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={createAndAddPersonAsEmployee}
                                disabled={savingPersonLink}
                                className="text-xs"
                              >
                                {savingPersonLink ? (
                                  <Spinner size={12} className="mr-1" />
                                ) : (
                                  <Plus className="h-3 w-3 mr-1" />
                                )}
                                Create "{personSearchQuery}"
                              </Button>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground text-center py-2">
                              Type at least 2 characters to search
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Add person button */
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setShowPersonSearch(true)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-2" />
                          Add Person
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Related Contacts */}
                {relatedCount > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Related Contacts ({relatedCount})
                    </div>
                    <div className="space-y-1">
                      {relatedEntities.slice(0, 5).map((rel) => {
                        const relatedContact = rel.other_contact || rel.related_contact;
                        if (!relatedContact) return null;

                        const displayName = "display_name" in relatedContact
                          ? relatedContact.display_name
                          : "name" in relatedContact
                            ? relatedContact.name
                            : "Unknown";

                        return (
                          <Link
                            key={rel.id}
                            href={`/contacts/${relatedContact.id}`}
                            className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-md hover:bg-muted/50 transition-colors"
                          >
                            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                              <Link2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{displayName}</div>
                              <div className="text-xs text-muted-foreground">
                                {rel.relationship_type_label || rel.relationship_type}
                              </div>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </Link>
                        );
                      })}
                      {relatedCount > 5 && (
                        <div className="text-xs text-muted-foreground text-center py-2">
                          +{relatedCount - 5} more contacts
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contact Persons Card - for companies */}
          {contact.contact_persons && contact.contact_persons.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Contact Persons
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {contact.contact_persons.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {contact.contact_persons.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-md bg-muted/30"
                    >
                      <div className="h-8 w-8 rounded-full bg-muted dark:bg-slate-800 flex items-center justify-center">
                        <Users className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {person.first_name} {person.last_name}
                          </span>
                          {person.is_primary && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              Primary
                            </Badge>
                          )}
                        </div>
                        {(person.role || person.email) && (
                          <div className="text-xs text-muted-foreground truncate">
                            {person.role && <span>{person.role}</span>}
                            {person.role && person.email && <span> · </span>}
                            {person.email && <span>{person.email}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Groups Card */}
          {contact.contact_groups && contact.contact_groups.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Groups</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {contact.contact_groups.map((group) => (
                    <Badge key={group.id} variant="secondary">
                      {group.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* System Info Footer - spans full width */}
      <Separator />
      <div className="text-[11px] text-muted-foreground flex items-center gap-4 py-2">
        <span>ID: {contact.id}</span>
        <span>
          Created:{" "}
          {new Date(contact.created_at).toLocaleDateString("en-AU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </span>
        <span>
          Updated:{" "}
          {new Date(contact.updated_at).toLocaleDateString("en-AU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

export default ContactOverviewTab;
