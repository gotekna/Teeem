"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Lock,
  Unlock,
  Calendar,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";

interface PeriodLock {
  id: number;
  period_type: string;
  period_start: string;
  period_end: string;
  period_label: string;
  status: string;
  locked_at: string | null;
  locked_by: string | null;
  lock_reason: string | null;
  unlocked_at: string | null;
  unlocked_by: string | null;
  unlock_reason: string | null;
  transactions_at_lock: number;
  balance_at_lock: number;
}

interface AvailablePeriod {
  type: string;
  period_end: string;
  label: string;
}

interface LockStatus {
  lock_date: string | null;
  locked_until: string | null;
  recent_locks: PeriodLock[];
  periods_available_to_lock: AvailablePeriod[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PeriodLocksTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [status, setStatus] = useState<LockStatus | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const statusParam = filter !== "all" ? `?status=${filter}` : "";
      const [locksRes, statusRes] = await Promise.all([
        api.get<{ success: boolean; data: { locks: PeriodLock[] } }>(`/api/v1/gl/period_locks${statusParam}`),
        api.get<{ success: boolean; data: LockStatus }>("/api/v1/gl/period_locks/status"),
      ]);

      if (locksRes?.success) setLocks(locksRes.data?.locks || []);
      if (statusRes?.success) setStatus(statusRes.data || null);
    } catch (error) {
      console.error("Failed to fetch period locks:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleUnlock = async (lock: PeriodLock) => {
    const reason = prompt("Enter reason for unlocking this period:");
    if (!reason) return;

    try {
      await api.post(`/api/v1/gl/period_locks/${lock.id}/unlock`, { reason });
      fetchData();
    } catch (error) {
      console.error("Failed to unlock period:", error);
    }
  };

  const handleRelock = async (lock: PeriodLock) => {
    try {
      await api.post(`/api/v1/gl/period_locks/${lock.id}/relock`);
      fetchData();
    } catch (error) {
      console.error("Failed to relock period:", error);
    }
  };

  const handleLockPeriod = async (period: AvailablePeriod) => {
    const reason = prompt("Enter reason for locking this period (optional):");

    try {
      await api.post("/api/v1/gl/period_locks", {
        period_type: period.type,
        period_end: period.period_end,
        reason,
      });
      fetchData();
    } catch (error) {
      console.error("Failed to lock period:", error);
    }
  };

  const getStatusBadge = (lock: PeriodLock) => {
    switch (lock.status) {
      case "locked":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <Lock className="h-3 w-3 mr-1" />
            Locked
          </Badge>
        );
      case "soft_locked":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Soft Lock
          </Badge>
        );
      case "unlocked":
        return (
          <Badge variant="secondary">
            <Unlock className="h-3 w-3 mr-1" />
            Unlocked
          </Badge>
        );
      default:
        return <Badge variant="outline">{lock.status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const lockedCount = locks.filter(l => l.status === "locked").length;
  const softLockedCount = locks.filter(l => l.status === "soft_locked").length;
  const unlockedCount = locks.filter(l => l.status === "unlocked").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Lock Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.locked_until || "Not Set"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              transactions before this are locked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Locked Periods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lockedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">fully locked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Soft Locked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{softLockedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">adjustments allowed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available to Lock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {status?.periods_available_to_lock?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">periods ready</p>
          </CardContent>
        </Card>
      </div>

      {/* Available Periods to Lock */}
      {status?.periods_available_to_lock && status.periods_available_to_lock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Available Periods to Lock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {status.periods_available_to_lock.map((period, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleLockPeriod(period)}
                  className="flex items-center gap-2"
                >
                  <Lock className="h-3 w-3" />
                  {period.label}
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {period.type}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Locks List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Period Locks
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
                <SelectItem value="soft_locked">Soft Locked</SelectItem>
                <SelectItem value="unlocked">Unlocked</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {locks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No period locks</p>
              <p className="text-sm mt-1">Lock periods to prevent changes to historical data</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Locked By</TableHead>
                  <TableHead>Locked At</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locks.map((lock) => (
                  <TableRow key={lock.id}>
                    <TableCell>
                      <div className="font-medium">{lock.period_label}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(lock.period_start)} - {formatDate(lock.period_end)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {lock.period_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lock.locked_by || "-"}
                      {lock.lock_reason && (
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-[150px]">
                          {lock.lock_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(lock.locked_at)}</TableCell>
                    <TableCell className="text-right">{lock.transactions_at_lock}</TableCell>
                    <TableCell className="text-right">{formatCurrency(lock.balance_at_lock)}</TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(lock)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {lock.status === "locked" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnlock(lock)}
                            title="Unlock Period"
                          >
                            <Unlock className="h-4 w-4" />
                          </Button>
                        )}
                        {lock.status === "unlocked" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRelock(lock)}
                            title="Re-lock Period"
                          >
                            <Lock className="h-4 w-4 mr-1" />
                            Lock
                          </Button>
                        )}
                        {lock.unlocked_at && (
                          <div className="text-xs text-muted-foreground ml-2">
                            Unlocked: {formatDateTime(lock.unlocked_at)}
                            {lock.unlock_reason && ` - ${lock.unlock_reason}`}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
