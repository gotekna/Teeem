"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft,
  Globe,
  Trash2,
  ShieldCheck,
} from "lucide-react";

export interface ContactHeaderProps {
  contact: {
    display_name: string;
    company_name: string | null;
    position: string | null;
    "is_supplier?": boolean;
    "is_customer?": boolean;
    is_family_member: boolean;
    xero_contact_id: string | null;
    email: string | null;
    website: string | null;
  };
  onBack: () => void;
  onDelete: () => void;
  onEnrichFromWeb: () => void;
  enrichingFromWeb: boolean;
}

export function ContactHeader({
  contact,
  onBack,
  onDelete,
  onEnrichFromWeb,
  enrichingFromWeb,
}: ContactHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-5 w-5 mr-2" />
          Contacts
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight font-serif">
              {contact.display_name}
            </h1>
            {contact["is_supplier?"] && (
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                Supplier
              </Badge>
            )}
            {contact["is_customer?"] && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                Customer
              </Badge>
            )}
            {contact.is_family_member && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Family
              </Badge>
            )}
            {contact.xero_contact_id && (
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Xero Linked
              </Badge>
            )}
          </div>
          {contact.company_name && (
            <p className="text-sm text-muted-foreground mt-1">
              {contact.position && `${contact.position} at `}
              {contact.company_name}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onEnrichFromWeb}
          disabled={enrichingFromWeb || (!contact?.email && !contact?.website)}
        >
          {enrichingFromWeb ? (
            <>
              <Spinner className="h-4 w-4 mr-2" />
              Enriching...
            </>
          ) : (
            <>
              <Globe className="h-4 w-4 mr-2" />
              Get Info from Web
            </>
          )}
        </Button>
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>
    </div>
  );
}
