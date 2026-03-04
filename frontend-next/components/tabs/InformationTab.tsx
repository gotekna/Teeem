"use client";

/**
 * InformationTab - Displays basic company information
 *
 * Extracted from corporate page for unified tab system.
 * Shows: Entity identity (type, group, contact), details (ACN, ABN, dates, addresses), directors.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyableField, CopyableLink } from "@/components/ui/copyable";
import { CheckCircle, AlertTriangle, Mail, Phone, Building2, Users, Link2 } from "lucide-react";
import { format } from "date-fns";
import type { Corporate } from "@/lib/types/corporate";
import { DATE_DISPLAY } from "@/lib/constants/date-formats";

// Entity type → badge color mapping
const ENTITY_TYPE_COLORS: Record<string, string> = {
  "Company": "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  "Trust": "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  "Superfund": "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  "Charity": "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300",
  "Corporate Trustee": "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
  "Sole Trader": "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
};

interface InformationTabProps {
  company: Corporate;
  // TabComponentProps compatibility
  entityId?: string;
  companyId?: string;
}

export function InformationTab({ company }: InformationTabProps) {
  const router = useRouter();
  const entityType = company.entity_type || "Company";
  const groupName = company.company_group
    ? (typeof company.company_group === "string" ? company.company_group : company.company_group.name)
    : company.group_name;

  // Full formal name from backend: "Company Pty Ltd (ACN xxx)" or "Trustee Pty Ltd (ACN xxx) ATF Fund Name"
  const fullLegalName = company.full_legal_name;
  // Only show if it differs from just the name (adds value with ACN or trustee info)
  const showFullName = fullLegalName && fullLegalName !== company.name;

  return (
    <div className="space-y-6">
      {/* Full legal name with copy button */}
      {showFullName && (
        <CopyableField label="Full Name" value={fullLegalName} />
      )}

      {/* Identity Section - Entity type, group, linked contact */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge className={`text-sm px-3 py-1 ${ENTITY_TYPE_COLORS[entityType] || "bg-muted text-muted-foreground"}`}>
          {entityType}
        </Badge>
        {groupName && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{groupName}</span>
          </div>
        )}
        {company.contact_id ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
            onClick={() => router.push(`/contacts/${company.contact_id}`)}
          >
            <Link2 className="h-4 w-4 mr-1" />
            {company.contact?.display_name || "Linked Contact"}
            {company.contact?.entity_type && (
              <span className="text-muted-foreground ml-1">({company.contact.entity_type})</span>
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <span>No linked contact</span>
          </div>
        )}
        {company.status && company.status !== "active" && (
          <Badge variant="outline" className="text-xs">
            {company.status}
          </Badge>
        )}
      </div>

      {/* Company Details */}
      <div>
        <h3 className="text-lg font-medium mb-4">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <CopyableField label="Legal Name" value={company.name} />
            {company.code && (
              <p className="text-xs text-muted-foreground mt-1">
                Code: <span className="font-mono">{company.code}</span>
              </p>
            )}
            {company.previous_names && (
              <p className="text-xs text-muted-foreground mt-1">
                Previously: {company.previous_names}
              </p>
            )}
            {company.business_names && (
              <p className="text-xs text-muted-foreground mt-1">
                Trading as: {company.business_names}
              </p>
            )}
          </div>
          <CopyableField
            label="Date Incorporated"
            value={
              company.date_incorporated
                ? format(new Date(company.date_incorporated), DATE_DISPLAY)
                : null
            }
          />
          <CopyableField
            label="ACN"
            value={company.formatted_acn || company.acn}
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CopyableField
                label="ABN"
                value={company.formatted_abn || company.abn}
              />
              {company.contact && company.contact.abn && (
                <>
                  {company.contact.abn_valid ? (
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : company.contact.abn_valid === false ? (
                    <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Invalid
                    </Badge>
                  ) : null}
                </>
              )}
            </div>
            {company.contact?.abn_entity_name && (
              <p className="text-xs text-muted-foreground ml-0">
                {company.contact.abn_entity_name}
              </p>
            )}
          </div>
          <CopyableField
            label="Registered Office"
            value={company.registered_office_address}
          />
          <CopyableField
            label="Principal Place of Business"
            value={company.principal_place_of_business}
          />
          {company.purpose && (
            <div className="md:col-span-2">
              <CopyableField label="Purpose" value={company.purpose} />
            </div>
          )}
        </div>
      </div>

      {company.current_directors && company.current_directors.length > 0 && (
        <div className="pt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            Current Directors
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {company.current_directors.map((director) => (
              <div
                key={director.id}
                className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium text-sm">
                    {(director.contact?.display_name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {director.contact?.display_name || "Unknown"}
                    </p>
                    {director.formatted_position && (
                      <p className="text-xs text-muted-foreground">
                        {director.formatted_position}
                      </p>
                    )}
                  </div>
                </div>
                {(director.contact?.email || director.contact?.mobile_phone) && (
                  <div className="space-y-1 text-xs">
                    {director.contact?.email && (
                      <CopyableLink
                        icon={<Mail className="h-3 w-3" />}
                        value={director.contact.email}
                        href={`mailto:${director.contact.email}`}
                      />
                    )}
                    {director.contact?.mobile_phone && (
                      <CopyableLink
                        icon={<Phone className="h-3 w-3" />}
                        value={director.contact.mobile_phone}
                        href={`tel:${director.contact.mobile_phone}`}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default InformationTab;
