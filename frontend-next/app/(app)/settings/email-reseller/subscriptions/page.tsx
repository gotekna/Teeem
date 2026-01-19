"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Plus,
  Search,
  RefreshCw,
  MoreVertical,
  Mail,
  Send,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmailSubscriptions } from "@/hooks/useEmailSubscriptions";
import { AddSubscriptionDialog } from "@/components/email-reseller/AddSubscriptionDialog";
import { cn } from "@/lib/utils";
import { formatCurrencyWhole } from "@/utils/formatters";
import type { EmailSubscription, SubscriptionStatus } from "@/lib/email-reseller-types";

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400",
  pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400",
  cancelled: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const { confirm } = useConfirm();
  const {
    subscriptions,
    loading,
    fetchSubscriptions,
    sendInvite,
    cancelSubscription,
  } = useEmailSubscriptions();

  const [search, setSearch] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [sendingInvite, setSendingInvite] = React.useState<number | null>(null);

  // Fetch subscriptions on mount
  React.useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSubscriptions();
    setRefreshing(false);
  };

  const handleSendInvite = async (id: number) => {
    setSendingInvite(id);
    try {
      await sendInvite(id);
    } finally {
      setSendingInvite(null);
    }
  };

  const handleCancel = async (id: number) => {
    if (await confirm("Are you sure you want to cancel this subscription?")) {
      await cancelSubscription(id);
      await fetchSubscriptions();
    }
  };

  // Filter subscriptions by search
  const filteredSubscriptions = React.useMemo(() => {
    if (!search) return subscriptions;
    const searchLower = search.toLowerCase();
    return subscriptions.filter(
      (sub) =>
        sub.contact_name?.toLowerCase().includes(searchLower) ||
        sub.domain?.toLowerCase().includes(searchLower)
    );
  }, [subscriptions, search]);

  // Calculate totals
  const totals = React.useMemo(() => {
    const active = filteredSubscriptions.filter((s) => s.status === "active");
    return {
      count: filteredSubscriptions.length,
      activeCount: active.length,
      totalRevenue: active.reduce((sum, s) => sum + (s.monthly_retail || s.retail_price || 0), 0),
      totalMailboxes: active.reduce((sum, s) => sum + (s.mailbox_count || 0), 0),
    };
  }, [filteredSubscriptions]);

  if (loading && subscriptions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Subscription
          </Button>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {totals.count} subscriptions • {totals.activeCount} active • {totals.totalMailboxes} mailboxes • {formatCurrencyWhole(totals.totalRevenue)}/mo revenue
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Mailboxes</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="text-muted-foreground">
                    {search ? "No subscriptions match your search" : "No subscriptions yet"}
                  </div>
                  {!search && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowAddDialog(true)}
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add your first subscription
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredSubscriptions.map((subscription) => (
                <TableRow
                  key={subscription.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/settings/email-reseller/subscriptions/${subscription.id}`)}
                >
                  <TableCell className="font-medium">
                    {subscription.contact_name || "Unknown"}
                  </TableCell>
                  <TableCell>{subscription.domain}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn("capitalize", STATUS_COLORS[subscription.status])}
                    >
                      {subscription.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {subscription.mailbox_count}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrencyWhole(subscription.monthly_retail || subscription.retail_price || 0)}
                    <span className="text-muted-foreground">/mo</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {subscription.margin_percentage || 50}%
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/settings/email-reseller/subscriptions/${subscription.id}`);
                          }}
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendInvite(subscription.id);
                          }}
                          disabled={sendingInvite === subscription.id}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {sendingInvite === subscription.id ? "Sending..." : "Send Invite"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancel(subscription.id);
                          }}
                          className="text-destructive"
                          disabled={subscription.status === "cancelled"}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel Subscription
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Subscription Dialog */}
      <AddSubscriptionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          setShowAddDialog(false);
          fetchSubscriptions();
        }}
      />
    </div>
  );
}
