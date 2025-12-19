"use client";

import React, { useCallback, useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ContactHero,
  PhonePropertyGroup,
  EmailPropertyGroup,
  AddressPropertyGroup,
} from "@/components/contact";
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
import { Link2, Users, Building2, ExternalLink, Plus, Trash2 } from "lucide-react";
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

  // Load related entities
  useEffect(() => {
    if (contact.id) {
      loadRelatedEntities();
    }
  }, [contact.id]);

  const loadRelatedEntities = useCallback(async () => {
    if (!contact.id) return;
    setLoadingRelated(true);
    try {
      const response = await api.get<{
        success: boolean;
        relationships: { outgoing: ContactRelationship[]; incoming: ContactRelationship[] };
      }>(`/api/v1/contacts/${contact.id}/relationships`);
      if (response.success) {
        const all = [...(response.relationships.outgoing || []), ...(response.relationships.incoming || [])];
        setRelatedEntities(all);
      }
    } catch {
      // Silent fail - relationships are optional
    } finally {
      setLoadingRelated(false);
    }
  }, [contact.id]);

  // Generic save function for single field updates
  const saveField = useCallback(
    async (fieldName: string, value: string | boolean): Promise<void> => {
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
            const { _tempId, ...rest } = e as ContactEmail & { _tempId?: string };
            return rest;
          });

        // Also sync primary email to legacy field
        const primaryEmail = emailsToSave.find((e) => e.is_primary && !e._destroy);

        const response = await api.patch<{ contact: Contact }>(
          `/api/v1/contacts/${contact.id}`,
          {
            contact: {
              contact_emails_attributes: emailsToSave,
              email: primaryEmail?.email || null,
            },
          }
        );
        onContactUpdate(response.contact);
      } catch (err) {
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

  // Compute display name based on entity type
  const computeDisplayName = useCallback((entityType: string, contact: Contact): string => {
    if (hasFirstLastName(entityType)) {
      const parts = [contact.first_name, contact.middle_name, contact.last_name].filter(Boolean);
      return parts.join(" ") || contact.display_name;
    }
    return contact.company_name_or_trust || contact.display_name;
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Hero Section */}
      <ContactHero
        displayName={contact.display_name}
        entityType={contact.entity_type}
        isActive={contact.is_active}
        jobsCount={contact.jobs_count}
        purchaseOrdersCount={contact.purchase_orders_count}
        quotesCount={contact.quotes_count}
        isXeroCustomer={contact["is_customer?"]}
        isXeroSupplier={contact["is_supplier?"]}
      />

      <Separator />

      {/* Identity Section */}
      <PropertySection title="Identity">
        {hasFirstLastName(contact.entity_type) ? (
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
          label="Display Name"
          value={contact.display_name}
          onSave={async () => {}}
          readonly
          hint="Auto-generated from name fields"
        />

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
          hint="Is this contact currently active?"
        />

        <PropertyRow
          label="Team Contact"
          value={contact.is_team_contact}
          onSave={(value) => saveField("is_team_contact", value)}
          type="switch"
          hint="Part of the internal team?"
        />
      </PropertySection>

      {/* Contact Section */}
      <PropertySection title="Contact">
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

        <div className="my-3" />

        <PropertyRow
          label="Website"
          value={contact.website}
          onSave={(value) => saveField("website", value)}
          type="url"
          placeholder="https://example.com"
          externalLink
        />
      </PropertySection>

      {/* Address Section */}
      <PropertySection title="Address">
        <AddressPropertyGroup
          contactId={contact.id}
          address={streetAddress}
          onSave={saveAddress}
        />
      </PropertySection>

      {/* Company Association - for Person entities */}
      {canHaveEmployer(contact.entity_type) && contact.primary_company && (
        <PropertySection title="Employment">
          <div className="py-2 px-3 -mx-3 rounded bg-muted/30">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <span className="text-xs text-muted-foreground">Works at</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Link
                    href={`/contacts/${contact.primary_company.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {contact.primary_company.name}
                  </Link>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </PropertySection>
      )}

      {/* Employees - for Company entities */}
      {canHaveEmployees(contact.entity_type) && contact.employees && contact.employees.length > 0 && (
        <PropertySection title="Employees">
          <div className="space-y-1">
            {contact.employees.map((employee) => (
              <Link
                key={employee.id}
                href={`/contacts/${employee.id}`}
                className="flex items-center gap-3 py-2 px-3 -mx-3 rounded hover:bg-muted/50"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="text-sm">{employee.display_name}</span>
                  {employee.primary_role && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {employee.primary_role}
                    </Badge>
                  )}
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </PropertySection>
      )}

      {/* Related Entities */}
      {relatedEntities.length > 0 && (
        <PropertySection title="Related Contacts">
          <div className="space-y-1">
            {relatedEntities.map((rel) => {
              const relatedContact = rel.other_contact || rel.related_contact;
              if (!relatedContact) return null;

              // Get display name from either name format
              const displayName = "display_name" in relatedContact
                ? relatedContact.display_name
                : "name" in relatedContact
                  ? relatedContact.name
                  : "Unknown";

              return (
                <Link
                  key={rel.id}
                  href={`/contacts/${relatedContact.id}`}
                  className="flex items-center gap-3 py-2 px-3 -mx-3 rounded hover:bg-muted/50"
                >
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <span className="text-sm">{displayName}</span>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {rel.relationship_type_label || rel.relationship_type}
                    </Badge>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </PropertySection>
      )}

      {/* Business & Tax - Hide for employees with primary company */}
      {!(canHaveEmployer(contact.entity_type) && contact.primary_company) && (
        <PropertySection title="Business & Tax">
          <PropertyRow
            label="ABN"
            value={contact.abn}
            onSave={(value) => saveField("abn", value)}
            format={formatABN}
            validate={validateABN}
            placeholder="00 000 000 000"
          />
          <PropertyRow
            label="ACN"
            value={contact.acn}
            onSave={(value) => saveField("acn", value)}
            format={formatACN}
            validate={validateACN}
            placeholder="000 000 000"
          />
          <PropertyRow
            label="Sync with Xero"
            value={contact.sync_with_xero}
            onSave={(value) => saveField("sync_with_xero", value)}
            type="switch"
            hint="Keep contact synced with Xero"
          />
        </PropertySection>
      )}

      {/* Notes */}
      <PropertySection title="Notes">
        <PropertyRow
          label="Notes"
          value={contact.notes}
          onSave={(value) => saveField("notes", value)}
          type="textarea"
          placeholder="Add notes about this contact..."
          labelWidth="w-0"
        />
      </PropertySection>

      {/* Contact Persons - for companies */}
      {contact.contact_persons && contact.contact_persons.length > 0 && (
        <PropertySection title="Contact Persons">
          <div className="space-y-1">
            {contact.contact_persons.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-3 py-2 px-3 -mx-3 rounded bg-muted/30"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="text-sm">
                    {person.first_name} {person.last_name}
                  </span>
                  {person.role && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({person.role})
                    </span>
                  )}
                  {person.is_primary && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Primary
                    </Badge>
                  )}
                </div>
                {person.email && (
                  <span className="text-xs text-muted-foreground">
                    {person.email}
                  </span>
                )}
              </div>
            ))}
          </div>
        </PropertySection>
      )}

      {/* Groups */}
      {contact.contact_groups && contact.contact_groups.length > 0 && (
        <PropertySection title="Groups">
          <div className="flex flex-wrap gap-2 py-2">
            {contact.contact_groups.map((group) => (
              <Badge key={group.id} variant="secondary">
                {group.name}
              </Badge>
            ))}
          </div>
        </PropertySection>
      )}

      {/* System Info Footer */}
      <Separator />
      <div className="text-xs text-muted-foreground flex items-center gap-4 py-2">
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
