"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import {
  Plus,
  Users,
  CheckCircle,
  Clock,
  Star,
  ExternalLink,
  Award,
  TrendingUp,
  Calendar,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";

// Foundation ID for Portal Users table

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState("users");

  // Use foundation hook for TeeemTableView
  const { foundation, columns, records, isLoading, error, refresh } = useFoundationBySlug("portal_users");

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/portal_users/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update portal user:", error);
      throw error;
    }
  }, [refresh]);

  // Stats from records
  const stats = {
    total_users: records.length,
    active_users: records.filter((u) => u.status === "active").length,
    pending_invites: records.filter((u) => u.status === "pending").length,
    quotes_this_month: records.reduce((sum, u) => sum + (Number(u.quotes_submitted) || 0), 0),
    avg_kudos_score: Math.round(
      records.reduce((sum, u) => sum + (Number(u.kudos_score) || 0), 0) / records.length || 0
    ),
  };

  const topPerformers = [...records]
    .sort((a, b) => (Number(b.kudos_score) || 0) - (Number(a.kudos_score) || 0))
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  // Left actions - Invite Supplier button
  const leftActions = (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Invite Supplier
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Subcontractor Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage supplier access and track performance
            
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/portal/preview" target="_blank">
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview Portal
            </Link>
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Invite Supplier
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users">Portal Users</TabsTrigger>
          <TabsTrigger value="leaderboard">Kudos Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <TeeemTableView
            entries={records}
            columns={columns}
            foundationId="portal_users"
            foundationIdNumeric={foundation?.id}
            tableName={foundation?.name || "Portal Users"}
            enableExport={true}
            onRefresh={refresh}
            onRowUpdate={handleRowUpdate}
            leftActions={leftActions}
          />
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  Top Performers
                </CardTitle>
                <CardDescription>
                  Suppliers with the highest kudos scores this month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topPerformers.map((user, index) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0
                              ? "bg-yellow-100 text-yellow-700"
                              : index === 1
                              ? "bg-gray-100 text-gray-700"
                              : index === 2
                              ? "bg-orange-100 text-orange-700"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{String(user.contact_name || user.name || "")}</div>
                          <div className="text-xs text-muted-foreground">
                            {String(user.company_name || "")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="font-mono font-bold">{Number(user.kudos_score) || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Kudos Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Kudos Metrics
                </CardTitle>
                <CardDescription>How suppliers earn kudos points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/10">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>On-time completion</span>
                    </div>
                    <Badge className="bg-green-100 text-green-700">+10 pts</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span>Quote submitted on time</span>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700">+5 pts</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-purple-600" />
                      <span>5-star rating received</span>
                    </div>
                    <Badge className="bg-purple-100 text-purple-700">+15 pts</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-yellow-600" />
                      <span>Arrived on schedule</span>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-700">+5 pts</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
