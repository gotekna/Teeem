"use client";

import { useGetDuplicateGroups } from "@/lib/hooks/useDuplicateContacts";
import { DuplicateContactGroup } from "./DuplicateContactGroup";
import { CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function DuplicateContactsTab() {
  const { data, isLoading, error } = useGetDuplicateGroups();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load duplicate contacts: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold">No Duplicates Found</h3>
        <p className="text-muted-foreground mt-2">
          All contacts from Xero sync are unique. Great job!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Duplicate Contacts</h2>
          <p className="text-muted-foreground mt-1">
            Found {data.summary.total_groups} group{data.summary.total_groups !== 1 ? 's' : ''} with duplicate contacts from Xero multi-tenant sync.
            These contacts represent the same real-world entity but were created separately for each Xero organization.
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{data.summary.total_groups}</div>
          <div className="text-sm text-muted-foreground">Duplicate Groups</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{data.summary.total_duplicate_contacts}</div>
          <div className="text-sm text-muted-foreground">Total Duplicates</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {data.summary.total_contacts_after_merge}
          </div>
          <div className="text-sm text-muted-foreground">After Merge</div>
        </div>
      </div>

      {/* Duplicate Groups List */}
      <div className="space-y-4">
        {data.groups.map((group) => (
          <DuplicateContactGroup key={group.id} group={group} />
        ))}
      </div>
    </div>
  );
}
