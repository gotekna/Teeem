"use client";

import { useGetDuplicateGroups } from "@/lib/hooks/useDuplicateContacts";
import { DuplicateContactGroup } from "./DuplicateContactGroup";
import { XeroDuplicatesSection } from "./XeroDuplicatesSection";
import { CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useGetXeroDuplicates } from "@/lib/hooks/useDuplicateContacts";

export function DuplicateContactsTab() {
  const { data, isLoading, error } = useGetDuplicateGroups();
  const { data: xeroDuplicates } = useGetXeroDuplicates();

  const teeemDuplicateCount = data?.summary?.total_groups ?? 0;
  const xeroDuplicateCount = xeroDuplicates?.data?.total_groups ?? 0;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Duplicate Contacts</h2>
        <p className="text-muted-foreground mt-1">
          Manage duplicate contacts in TEEEM and identify duplicates in Xero that need merging.
        </p>
      </div>

      {/* Sub-tabs for TEEEM vs Xero duplicates */}
      <Tabs defaultValue="xero" className="space-y-4">
        <TabsList>
          <TabsTrigger value="xero" className="flex items-center gap-2">
            Xero Duplicates
            {xeroDuplicateCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {xeroDuplicateCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="teeem" className="flex items-center gap-2">
            TEEEM Duplicates
            {teeemDuplicateCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {teeemDuplicateCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Xero Duplicates - duplicates within Xero that need merging in Xero */}
        <TabsContent value="xero">
          <XeroDuplicatesSection />
        </TabsContent>

        {/* TEEEM Duplicates - same entity across multiple Xero tenants */}
        <TabsContent value="teeem">
          {!data || data.groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">No TEEEM Duplicates Found</h3>
              <p className="text-muted-foreground mt-2">
                All contacts from Xero sync are unique. Great job!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Found {data.summary.total_groups} group{data.summary.total_groups !== 1 ? 's' : ''} with duplicate contacts from Xero multi-tenant sync.
                These contacts represent the same real-world entity but were created separately for each Xero organization.
              </p>

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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
