"use client";

/**
 * InformationTab - Displays basic company information
 *
 * Extracted from corporate page for unified tab system.
 * Shows: Legal name, ACN, ABN, dates, addresses, current directors.
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { CopyableField, CopyableLink } from "@/components/ui/copyable";
import { CheckCircle, AlertTriangle, Mail, Phone } from "lucide-react";
import { format } from "date-fns";
import type { Corporate } from "@/lib/types/corporate";

interface InformationTabProps {
  company: Corporate;
  // TabComponentProps compatibility
  entityId?: string;
  companyId?: string;
}

export function InformationTab({ company }: InformationTabProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Company Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <div>
          <CopyableField label="Legal Name" value={company.name} />
          {company.code && (
            <p className="text-xs text-muted-foreground mt-1">
              Code: <span className="font-mono">{company.code}</span>
            </p>
          )}
          {company.company_group && (
            <p className="text-xs text-muted-foreground mt-1">
              Group: {typeof company.company_group === 'string'
                ? company.company_group
                : company.company_group.name}
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
              ? format(new Date(company.date_incorporated), "dd/MM/yyyy")
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
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/30 dark:text-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                ) : company.contact.abn_valid === false ? (
                  <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 dark:bg-red-900/30 dark:text-red-300">
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
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm">
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
