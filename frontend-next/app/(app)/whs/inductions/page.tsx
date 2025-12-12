"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import {
  Plus,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { api } from "@/lib/api";

// Foundation ID for WHS Inductions table

export default function WHSInductionsPage() {
  // Use foundation hook for TeeemTableView
  const { foundation, columns, records, isLoading, refresh } = useFoundationBySlug("whs_inductions");

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/whs_inductions/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update induction:", error);
      throw error;
    }
  }, [refresh]);

  // Stats from records
  const stats = {
    total: records.length,
    completed: records.filter((i) => i.status === "completed").length,
    pending: records.filter((i) => i.status === "pending").length,
    expired: records.filter((i) => i.status === "expired").length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  // Left actions - New Induction button
  const leftActions = (
    <div className="flex items-center gap-2">
      <Button variant="outline">
        <Mail className="h-4 w-4 mr-2" />
        Send Reminders
      </Button>
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        New Induction
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/whs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Site Inductions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage worker inductions and site access
              
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Mail className="h-4 w-4 mr-2" />
            Send Reminders
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Induction
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Workers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{stats.completed}</span>
            </div>
            <p className="text-sm text-muted-foreground">Inducted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="text-2xl font-bold text-orange-600">{stats.pending}</span>
            </div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{stats.expired}</span>
            </div>
            <p className="text-sm text-muted-foreground">Expired</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <TeeemTableView
        entries={records}
        columns={columns}
        foundationId="whs_inductions"
        foundationIdNumeric={foundation?.id}
        tableName={foundation?.name || "Site Inductions"}
        enableExport={true}
        onRefresh={refresh}
        onRowUpdate={handleRowUpdate}
        leftActions={leftActions}
      />
    </div>
  );
}
