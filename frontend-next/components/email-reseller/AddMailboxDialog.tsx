"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useEmailMailboxes } from "@/hooks/useEmailSubscriptions";
import type { MailboxType } from "@/lib/email-reseller-types";

interface AddMailboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: number;
  domain: string;
  onSuccess: () => void;
}

export function AddMailboxDialog({
  open,
  onOpenChange,
  subscriptionId,
  domain,
  onSuccess,
}: AddMailboxDialogProps) {
  const { addMailbox, loading } = useEmailMailboxes(subscriptionId);

  const [emailLocal, setEmailLocal] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [mailboxType, setMailboxType] = React.useState<MailboxType>("user");
  const [sourceEmail, setSourceEmail] = React.useState("");
  const [startMigration, setStartMigration] = React.useState(false);

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      setEmailLocal("");
      setDisplayName("");
      setMailboxType("user");
      setSourceEmail("");
      setStartMigration(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailLocal) return;

    try {
      await addMailbox({
        email_address: `${emailLocal}@${domain}`,
        display_name: displayName || undefined,
        mailbox_type: mailboxType,
        source_email: sourceEmail || undefined,
        start_migration: sourceEmail ? startMigration : undefined,
      });
      onSuccess();
    } catch (err) {
      console.error("Failed to add mailbox:", err);
    }
  };

  const isValid = emailLocal.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Mailbox</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Address */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="flex items-center gap-2">
              <Input
                id="email"
                value={emailLocal}
                onChange={(e) => setEmailLocal(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                placeholder="user"
                className="flex-1"
              />
              <span className="text-muted-foreground">@{domain}</span>
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name (optional)</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Smith"
            />
          </div>

          {/* Mailbox Type */}
          <div className="space-y-2">
            <Label>Mailbox Type</Label>
            <Select value={mailboxType} onValueChange={(v) => setMailboxType(v as MailboxType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User Mailbox</SelectItem>
                <SelectItem value="shared">Shared Mailbox</SelectItem>
                <SelectItem value="resource">Resource (Room/Equipment)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Migration Source */}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="sourceEmail">Migration Source (optional)</Label>
            <Input
              id="sourceEmail"
              value={sourceEmail}
              onChange={(e) => setSourceEmail(e.target.value.toLowerCase())}
              placeholder="user@olddomain.com"
            />
            <p className="text-xs text-muted-foreground">
              If migrating from another provider, enter the source email address
            </p>
          </div>

          {/* Start Migration */}
          {sourceEmail && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="startMigration"
                checked={startMigration}
                onCheckedChange={(checked) => setStartMigration(!!checked)}
              />
              <Label htmlFor="startMigration" className="cursor-pointer">
                Start migration immediately after provisioning
              </Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || loading}>
              {loading ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Mailbox
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
