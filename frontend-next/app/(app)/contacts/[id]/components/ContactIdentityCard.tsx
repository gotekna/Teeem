"use client";

import React, { useCallback, useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyRow } from "@/components/contact";
import { hasFirstLastName } from "@/lib/entity-types";
import type { Contact } from "../types";

/**
 * SSoT: Contact Identity Card
 *
 * Shared component used in both Overview and User tabs.
 * Shows contact name fields + linked user identity (username, display name).
 * Changes made here are reflected everywhere.
 */

interface UserIdentity {
  id: number;
  name: string;
  username: string | null;
}

interface ContactIdentityCardProps {
  contact: Contact;
  onContactUpdate: (updatedContact: Contact) => void;
  /** Entity type options for the select dropdown */
  entityTypeOptions?: { value: string; label: string }[];
  /** Show entity type, active, team contact toggles (Overview tab shows these, User tab doesn't) */
  showContactSettings?: boolean;
}

export function ContactIdentityCard({
  contact,
  onContactUpdate,
  entityTypeOptions,
  showContactSettings = false,
}: ContactIdentityCardProps) {
  const { toast } = useToast();
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(null);

  const isPerson = hasFirstLastName(contact.entity_type);

  // Load linked user identity if contact has a user
  useEffect(() => {
    const loadUserIdentity = async () => {
      try {
        const response = await api.get<{ success: boolean; data: UserIdentity }>(
          `/api/v1/users/by_contact/${contact.id}/personal_details`
        );
        if (response.success) {
          setUserIdentity({
            id: response.data.id,
            name: response.data.name,
            username: response.data.username,
          });
        }
      } catch (err) {
        // No linked user - expected for contacts without a user account
        setUserIdentity(null);
      }
    };
    loadUserIdentity();
  }, [contact.id]);

  // Save contact field
  const saveContactField = useCallback(
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

  // Save user field (username, display name)
  const saveUserField = useCallback(
    async (fieldName: string, value: string | null): Promise<void> => {
      if (!userIdentity) return;
      try {
        const response = await api.patch<{ success: boolean; data: UserIdentity }>(
          `/api/v1/users/${userIdentity.id}/personal_details`,
          { [fieldName]: value }
        );
        if (response.success) {
          setUserIdentity({
            id: response.data.id,
            name: response.data.name,
            username: response.data.username,
          });
        }
      } catch (err) {
        toast({
          title: "Error saving",
          description: err instanceof Error ? err.message : "Failed to save",
          variant: "destructive",
        });
        throw err;
      }
    },
    [userIdentity, toast]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Identity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Contact name fields */}
        {isPerson ? (
          <>
            <PropertyRow
              label="First Name"
              value={contact.first_name}
              onSave={(value) => saveContactField("first_name", value)}
              placeholder="Enter first name"
            />
            <PropertyRow
              label="Middle Name"
              value={contact.middle_name}
              onSave={(value) => saveContactField("middle_name", value)}
              placeholder="Enter middle name"
            />
            <PropertyRow
              label="Last Name"
              value={contact.last_name}
              onSave={(value) => saveContactField("last_name", value)}
              placeholder="Enter last name"
            />
          </>
        ) : (
          <PropertyRow
            label="Company/Trust Name"
            value={contact.company_name_or_trust}
            onSave={(value) => saveContactField("company_name_or_trust", value)}
            placeholder="Enter company or trust name"
          />
        )}

        {/* User identity fields - only shown when contact has a linked user */}
        {userIdentity && (
          <>
            <PropertyRow
              label="Display Name"
              value={userIdentity.name}
              onSave={(value) => saveUserField("name", value as string)}
              placeholder="Enter display name"
            />
            <PropertyRow
              label="Username"
              value={userIdentity.username}
              onSave={(value) => saveUserField("username", value as string)}
              placeholder="Enter username"
            />
          </>
        )}

        {/* Date of Birth - SSoT: Contact.date_of_birth (User tab is canonical editor) */}
        <PropertyRow
          label="Date of Birth"
          value={contact.date_of_birth}
          onSave={(value) => saveContactField("date_of_birth", value)}
          placeholder="DD/MM/YYYY"
          format={(v) => {
            const d = new Date(v);
            return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-AU");
          }}
        />

        {/* Contact settings - shown in Overview tab */}
        {showContactSettings && (
          <>
            {entityTypeOptions && (
              <PropertyRow
                label="Entity Type"
                value={contact.entity_type}
                onSave={(value) => saveContactField("entity_type", value)}
                type="select"
                options={entityTypeOptions}
              />
            )}
            <PropertyRow
              label="Active"
              value={contact.is_active}
              onSave={(value) => saveContactField("is_active", value)}
              type="switch"
            />
            <PropertyRow
              label="Team Contact"
              value={contact.is_team_contact}
              onSave={(value) => saveContactField("is_team_contact", value)}
              type="switch"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ContactIdentityCard;
