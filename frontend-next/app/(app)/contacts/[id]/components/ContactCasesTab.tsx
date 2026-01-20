"use client";

import Link from "next/link";
import { Briefcase, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { CaseRelationship } from "../types";

interface ContactCasesTabProps {
  caseRelationships: CaseRelationship[];
  loadingCaseRelationships: boolean;
}

export function ContactCasesTab({
  caseRelationships,
  loadingCaseRelationships,
}: ContactCasesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Case Involvement History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loadingCaseRelationships ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : caseRelationships && caseRelationships.length > 0 ? (
          <div className="space-y-4">
            {caseRelationships.map((rel) => (
              <CaseRelationshipCard key={rel.id} relationship={rel} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            This contact has not been linked to any cases yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Sub-component for individual case relationship card
interface CaseRelationshipCardProps {
  relationship: CaseRelationship;
}

function CaseRelationshipCard({ relationship: rel }: CaseRelationshipCardProps) {
  return (
    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Link
            href={`/cases/${rel.case_id}`}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            {rel.case_number}: {rel.case_title}
            <ExternalLink className="h-3 w-3" />
          </Link>
          <div className="mt-2 space-y-1 text-sm">
            {rel.relationship_type && (
              <div>
                <strong>Relationship:</strong> {rel.formatted_relationship_type || rel.relationship_type}
              </div>
            )}
            {rel.alignment && (
              <div className="flex items-center gap-2">
                <strong>Alignment:</strong>
                <Badge
                  variant={
                    rel.alignment === 'friendly' ? 'default' :
                    rel.alignment === 'opposing' ? 'destructive' :
                    'secondary'
                  }
                >
                  {rel.alignment}
                </Badge>
              </div>
            )}
            {rel.role && (
              <div><strong>Role:</strong> {rel.role}</div>
            )}
            {rel.reason && (
              <div>
                <strong>Reason:</strong> {rel.reason}
              </div>
            )}
            {rel.notes && (
              <div className="text-muted-foreground">
                <strong>Notes:</strong> {rel.notes}
              </div>
            )}
            {rel.is_primary && (
              <Badge variant="outline" className="mt-1">Primary Contact</Badge>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {rel.added_at && (
            <>
              Added {new Date(rel.added_at).toLocaleDateString()}<br/>
              {rel.added_by && `by ${rel.added_by}`}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
