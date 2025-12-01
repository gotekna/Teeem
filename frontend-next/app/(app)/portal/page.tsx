"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Search,
  Users,
  Building2,
  CheckCircle,
  Clock,
  Star,
  MoreHorizontal,
  Eye,
  Mail,
  Key,
  Trash,
  ExternalLink,
  Award,
  TrendingUp,
  Calendar,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

interface PortalUser {
  id: number;
  contact_id: number;
  contact_name: string;
  company_name: string;
  email: string;
  status: "active" | "pending" | "suspended";
  last_login: string | null;
  created_at: string;
  jobs_assigned: number;
  quotes_submitted: number;
  kudos_score: number;
  kudos_rank: number | null;
}

interface PortalStats {
  total_users: number;
  active_users: number;
  pending_invites: number;
  quotes_this_month: number;
  avg_kudos_score: number;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500",
  suspended: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400",
};

export default function PortalPage() {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("users");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await api.get<{ users: PortalUser[] }>("/api/v1/portal/users");
        setUsers(response.users || []);
      } catch (error) {
        console.error("Failed to load portal users:", error);
        setUsers(getMockUsers());
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const stats: PortalStats = {
    total_users: users.length,
    active_users: users.filter((u) => u.status === "active").length,
    pending_invites: users.filter((u) => u.status === "pending").length,
    quotes_this_month: users.reduce((sum, u) => sum + u.quotes_submitted, 0),
    avg_kudos_score: Math.round(
      users.reduce((sum, u) => sum + u.kudos_score, 0) / users.length || 0
    ),
  };

  const filteredUsers = users.filter(
    (user) =>
      user.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const topPerformers = [...users]
    .sort((a, b) => b.kudos_score - a.kudos_score)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Total Users</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.total_users}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2 text-green-600">
              {stats.active_users}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2 text-yellow-600">
              {stats.pending_invites}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Quotes (Month)</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.quotes_this_month}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Avg Kudos</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.avg_kudos_score}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users">Portal Users</TabsTrigger>
          <TabsTrigger value="leaderboard">Kudos Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Users Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Jobs</TableHead>
                  <TableHead>Quotes</TableHead>
                  <TableHead>Kudos</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {user.contact_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.contact_name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {user.company_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[user.status]}>{user.status}</Badge>
                    </TableCell>
                    <TableCell>{user.jobs_assigned}</TableCell>
                    <TableCell>{user.quotes_submitted}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        {user.kudos_score}
                        {user.kudos_rank && user.kudos_rank <= 3 && (
                          <Badge
                            className={
                              user.kudos_rank === 1
                                ? "bg-yellow-100 text-yellow-700"
                                : user.kudos_rank === 2
                                ? "bg-gray-100 text-gray-700"
                                : "bg-orange-100 text-orange-700"
                            }
                          >
                            #{user.kudos_rank}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.last_login
                        ? new Date(user.last_login).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Activity
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Message
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Key className="h-4 w-4 mr-2" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash className="h-4 w-4 mr-2" />
                            Suspend Access
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
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
                          <div className="font-medium">{user.contact_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {user.company_name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="font-mono font-bold">{user.kudos_score}</span>
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

function getMockUsers(): PortalUser[] {
  return [
    {
      id: 1,
      contact_id: 3,
      contact_name: "Sarah Johnson",
      company_name: "Boral Timber",
      email: "sarah@boral.com.au",
      status: "active",
      last_login: new Date(Date.now() - 86400000).toISOString(),
      created_at: "2023-06-15",
      jobs_assigned: 12,
      quotes_submitted: 28,
      kudos_score: 485,
      kudos_rank: 1,
    },
    {
      id: 2,
      contact_id: 5,
      contact_name: "Mike Williams",
      company_name: "BlueScope Steel",
      email: "mike@bluescope.com.au",
      status: "active",
      last_login: new Date(Date.now() - 172800000).toISOString(),
      created_at: "2023-07-20",
      jobs_assigned: 8,
      quotes_submitted: 15,
      kudos_score: 420,
      kudos_rank: 2,
    },
    {
      id: 3,
      contact_id: 8,
      contact_name: "Tom Roberts",
      company_name: "Reece Plumbing",
      email: "tom@reece.com.au",
      status: "active",
      last_login: new Date(Date.now() - 3600000).toISOString(),
      created_at: "2023-08-10",
      jobs_assigned: 15,
      quotes_submitted: 42,
      kudos_score: 395,
      kudos_rank: 3,
    },
    {
      id: 4,
      contact_id: 10,
      contact_name: "Dave Brown",
      company_name: "L&H Electrical",
      email: "dave@lhelectrical.com.au",
      status: "pending",
      last_login: null,
      created_at: "2024-11-25",
      jobs_assigned: 0,
      quotes_submitted: 0,
      kudos_score: 0,
      kudos_rank: null,
    },
    {
      id: 5,
      contact_id: 12,
      contact_name: "Emma Chen",
      company_name: "Hanson Concrete",
      email: "emma@hanson.com.au",
      status: "active",
      last_login: new Date(Date.now() - 604800000).toISOString(),
      created_at: "2023-09-05",
      jobs_assigned: 6,
      quotes_submitted: 18,
      kudos_score: 310,
      kudos_rank: 4,
    },
  ];
}
