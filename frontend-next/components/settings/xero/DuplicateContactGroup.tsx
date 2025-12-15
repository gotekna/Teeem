"use client";

import { useState } from "react";
import { DuplicateGroup, DuplicateContact, useMergeDuplicateGroup } from "@/lib/hooks/useDuplicateContacts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Merge, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  group: DuplicateGroup;
}

export function DuplicateContactGroup({ group }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<number>(group.recommended_ssot_id);

  const mergeMutation = useMergeDuplicateGroup();

  const handleMerge = async () => {
    try {
      const result = await mergeMutation.mutateAsync({
        groupId: group.id,
        targetId: selectedTargetId,
      });

      toast.success(result.message || "Contacts merged successfully!");
      setShowMergeDialog(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to merge contacts");
    }
  };

  const getContactBorderColor = (contact: DuplicateContact) => {
    if (contact.id === selectedTargetId) {
      return "border-green-500 border-2";
    }
    return "border-yellow-500/50";
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{group.normalized_name}</CardTitle>
              <CardDescription>
                {group.contacts.length} duplicate contact{group.contacts.length !== 1 ? 's' : ''} •
                {group.total_xero_tenants} Xero organization{group.total_xero_tenants !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowMergeDialog(true)}
                disabled={mergeMutation.isPending}
              >
                <Merge className="h-4 w-4 mr-2" />
                Merge
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Review
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent>
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <CheckCircle2 className="h-4 w-4 inline mr-2" />
                  Contact with <strong>green border</strong> will be kept (Single Source of Truth).
                  Others will be merged into it and deleted.
                </p>
              </div>

              {/* Contacts Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.contacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    isRecommended={contact.id === group.recommended_ssot_id}
                    isSelected={contact.id === selectedTargetId}
                    borderColor={getContactBorderColor(contact)}
                    onSelect={() => setSelectedTargetId(contact.id)}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Merge Confirmation Dialog */}
      <AlertDialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge Duplicate Contacts?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This will:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    Keep <strong>Contact #{selectedTargetId}</strong> as the Single Source of Truth
                  </li>
                  <li>
                    Move all {group.total_xero_tenants} Xero link{group.total_xero_tenants !== 1 ? 's' : ''} to Contact #{selectedTargetId}
                  </li>
                  <li>
                    Transfer all relationships (jobs, purchase orders, cases)
                  </li>
                  <li>
                    <strong className="text-red-600">Permanently delete</strong> the other{' '}
                    {group.contacts.length - 1} contact{group.contacts.length - 1 !== 1 ? 's' : ''}
                  </li>
                </ul>
                <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded p-3 mt-3">
                  <p className="text-sm text-yellow-900 dark:text-yellow-100 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Warning:</strong> This action cannot be undone. Make sure you've selected
                      the correct contact to keep.
                    </span>
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMerge}
              disabled={mergeMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {mergeMutation.isPending ? "Merging..." : "Confirm Merge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Contact Card Component
interface ContactCardProps {
  contact: DuplicateContact;
  isRecommended: boolean;
  isSelected: boolean;
  borderColor: string;
  onSelect: () => void;
}

function ContactCard({ contact, isRecommended, isSelected, borderColor, onSelect }: ContactCardProps) {
  return (
    <Card
      className={`${borderColor} cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-green-500" : ""
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header with ID and Badge */}
        <div className="flex items-start justify-between">
          <div className="font-mono text-sm text-muted-foreground">
            ID: {contact.id}
          </div>
          {isRecommended && (
            <Badge variant="default" className="bg-green-600">
              Recommended
            </Badge>
          )}
        </div>

        {/* Name */}
        <div>
          <div className="font-semibold text-base">{contact.display_name}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Created {format(new Date(contact.created_at), 'MMM d, yyyy')}
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email:</span>
            <span className="font-mono text-xs">{contact.email || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">ABN:</span>
            <span className="font-mono text-xs">{contact.abn || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Phone:</span>
            <span className="font-mono text-xs">
              {contact.mobile_phone || contact.office_phone || "—"}
            </span>
          </div>
        </div>

        {/* Score */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Quality Score:</span>
            <Badge variant="outline">{contact.score}</Badge>
          </div>
        </div>

        {/* Xero Tenants */}
        {contact.xero_tenants.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-1">Xero Orgs:</div>
            <div className="flex flex-wrap gap-1">
              {contact.xero_tenants.map((tenant, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tenant.tenant_name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Relationships */}
        {(contact.relationships.jobs > 0 ||
          contact.relationships.purchase_orders > 0 ||
          contact.relationships.cases > 0) && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-1">Related:</div>
            <div className="flex gap-2 text-xs">
              {contact.relationships.jobs > 0 && (
                <Badge variant="outline">{contact.relationships.jobs} Jobs</Badge>
              )}
              {contact.relationships.purchase_orders > 0 && (
                <Badge variant="outline">{contact.relationships.purchase_orders} POs</Badge>
              )}
              {contact.relationships.cases > 0 && (
                <Badge variant="outline">{contact.relationships.cases} Cases</Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
