"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import { TablePage } from "@/components/ui/page-wrappers";
import {
  Plus,
  CheckCircle,
  Star,
  ExternalLink,
  Award,
  TrendingUp,
  Calendar,
  FileText,
  CloudOff,
} from "lucide-react";
import { OfflineSyncManager } from "@/components/offline";

// Foundation ID for Portal Users table

export default function PortalPage() {
  const pathname = usePathname();
  const router = useRouter();

  // Parse tab from path: /portal/users → "users", /portal → "users"
  const activeTab = useMemo(() => {
    const parts = (pathname ?? "").replace("/portal", "").split("/").filter(Boolean);
    return parts[0] || "users";
  }, [pathname]);

  const handleTabChange = useCallback((tabId: string) => {
    // Path-based navigation: /portal/users, /portal/analytics
    const url = tabId === "users" ? "/portal" : `/portal/${tabId}`;
    router.push(url, { scroll: false });
  }, [router]);

  // Fetch records for leaderboard calculations only
  // TeeemTableView uses autoFetchRecords for the table
  const { records, isLoading: leaderboardLoading } = useFoundationBySlug("portal_users");

  const topPerformers = useMemo(() =>
    [...records]
      .sort((a, b) => (Number(b.kudos_score) || 0) - (Number(a.kudos_score) || 0))
      .slice(0, 5),
    [records]
  );

  // Left actions with Preview Portal button
  const leftActions = (
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
  );

  return (
    <TablePage>
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full">
        <div className="px-4 shrink-0">
          <TabsList>
            <TabsTrigger value="users">Portal Users</TabsTrigger>
            <TabsTrigger value="leaderboard">Kudos Leaderboard</TabsTrigger>
            <TabsTrigger value="offline" className="flex items-center gap-1.5">
              <CloudOff className="h-3.5 w-3.5" />
              Offline
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users" className="flex-1 min-h-0 mt-4">
          <TeeemTableView
            foundationId="portal_users"
            autoFetchRecords={true}
            tableName="Portal Users"
            enableExport={true}
            leftActions={leftActions}
            hideFooter={true}
          />
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          {leaderboardLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <Spinner />
            </div>
          ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
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
                              ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                              : index === 1
                              ? "bg-muted text-foreground"
                              : index === 2
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
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
                        <Star className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
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
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Kudos Metrics
                </CardTitle>
                <CardDescription>How suppliers earn kudos points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/10">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span>On-time completion</span>
                    </div>
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">+10 pts</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>Quote submitted on time</span>
                    </div>
                    <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">+5 pts</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span>5-star rating received</span>
                    </div>
                    <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">+15 pts</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <span>Arrived on schedule</span>
                    </div>
                    <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">+5 pts</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          )}
        </TabsContent>

        <TabsContent value="offline" className="mt-4 px-4">
          <OfflineSyncManager />
        </TabsContent>
      </Tabs>
    </TablePage>
  );
}
