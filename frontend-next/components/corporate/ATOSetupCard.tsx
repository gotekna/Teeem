"use client";

/**
 * ATOSetupCard - ATO Registration status card
 *
 * Shows ATO/GST registration info sourced from linked Contact record.
 * Displays warning if company is not linked to a Contact.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileText, Pencil } from "lucide-react";
import type { CorporateCompany } from "@/lib/types/corporate";

interface ATOSetupCardProps {
  company: CorporateCompany;
}

export function ATOSetupCard({ company }: ATOSetupCardProps) {
  const router = useRouter();

  if (!company.contact_id) {
    return (
      <Card className="mb-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-5 w-5" />
            Contact Not Linked
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            This company is not linked to a Contact record. Link to a Contact for centralised data management.
          </p>
          <Button variant="outline" size="sm" onClick={() => router.push("/contacts")}>
            Link to Contact
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            ATO Registration
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/contacts/${company.contact_id}?edit=true`)}
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Data sourced from linked Contact record
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">ABN</p>
            <p className="font-medium">{company.formatted_abn || company.abn || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">TFN</p>
            <p className="font-medium">{company.tfn ? "••• ••• •••" : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">GST Status</p>
            <Badge
              variant="outline"
              className={company.gst_registration_status === "registered"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground"
              }
            >
              {company.gst_registration_status === "registered" ? "Registered" : "Not Registered"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Source</p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-blue-600"
              onClick={() => router.push(`/contacts/${company.contact_id}`)}
            >
              View Contact →
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ATOSetupCard;
