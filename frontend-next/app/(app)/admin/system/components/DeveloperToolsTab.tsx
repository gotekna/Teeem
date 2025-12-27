"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  RefreshCw,
  Database,
  Search,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  XCircle,
  GitBranch,
  Bot,
  Columns,
  FileCode,
  X,
  ChevronUp,
  ChevronDown,
  Ban,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmailBlacklistTab } from "./EmailBlacklistTab";

// Types
interface TableInfo {
  id: number;
  name: string;
  plural_name?: string;
  database_table_name: string;
  slug?: string;
  icon?: string;
  feature?: string;
  type: "user" | "import" | "system";
  usage_status?: string;
  column_count?: number;
  columns_count?: number;
  record_count?: number;
  is_live?: boolean;
  has_ui?: boolean;
}

interface AgentInfo {
  name: string;
  description: string;
  status: "active" | "inactive" | "error";
  last_run: string | null;
  run_count: number;
}

interface GitBranchInfo {
  name: string;
  current: boolean;
  lastCommit?: string;
  behind?: number;
  ahead?: number;
}

interface SyncResult {
  name: string;
  icon?: string;
  status: "synced" | "warning" | "error";
  warnings?: string[];
  issues?: string[];
  foundation_id?: number;
  db_exists?: boolean;
  registered_columns_count?: number;
  db_columns_count?: number;
}

interface SyncResults {
  results?: SyncResult[];
  summary?: {
    synced: number;
    warnings: number;
    errors: number;
  };
  timestamp?: string;
}


// No mock data - we want real data from the API

const MOCK_AGENTS: AgentInfo[] = [
  { name: "Backend Developer", description: "Rails API, database, models", status: "active", last_run: new Date().toISOString(), run_count: 156 },
  { name: "Frontend Developer", description: "React/Next.js components", status: "active", last_run: new Date().toISOString(), run_count: 234 },
  { name: "Bug Hunter", description: "Production error analysis", status: "active", last_run: new Date(Date.now() - 3600000).toISOString(), run_count: 45 },
  { name: "Deploy Manager", description: "Heroku/Vercel deployments", status: "active", last_run: new Date(Date.now() - 7200000).toISOString(), run_count: 89 },
  { name: "Trinity Sync Validator", description: "Documentation sync check", status: "inactive", last_run: null, run_count: 12 },
  { name: "UI Compliance Auditor", description: "UI/UX standards check", status: "inactive", last_run: null, run_count: 8 },
];

const MOCK_BRANCHES: GitBranchInfo[] = [
  { name: "Live", current: false, lastCommit: "4d8d408e", behind: 0, ahead: 0 },
  { name: "rob", current: true, lastCommit: "4d8d408e", behind: 0, ahead: 5 },
  { name: "jake", current: false, lastCommit: "557ba494", behind: 2, ahead: 0 },
];

export function DeveloperToolsTab() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [tables, setTables] = React.useState<TableInfo[]>([]);
  const [agents, setAgents] = React.useState<AgentInfo[]>([]);
  const [branches, setBranches] = React.useState<GitBranchInfo[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<"all" | "user" | "import" | "system">("all");
  const [featureFilter, setFeatureFilter] = React.useState("all");
  const [sortColumn, setSortColumn] = React.useState<string>("feature");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [syncing, setSyncing] = React.useState(false);
  const [syncResults, setSyncResults] = React.useState<SyncResults | null>(null);
  const [creatingSetupViews, setCreatingSetupViews] = React.useState(false);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newTableName, setNewTableName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [columnSearchQuery, setColumnSearchQuery] = React.useState("");

  // Sort icon helper component
  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-1 h-4 w-4" />
    );
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadError(null);

    try {
      // Load tables from API
      const tablesData = await api.get<{ tables: TableInfo[] }>("/api/v1/schema/tables");
      setTables(tablesData.tables || []);
    } catch (error) {
      console.error("Failed to load tables:", error);
      setLoadError("Failed to load tables. Please ensure you are logged in.");
      setTables([]);
    }

    // Load agents - mock for now (no API endpoint yet)
    setAgents(MOCK_AGENTS);

    // Load branches - mock for now (no API endpoint yet)
    setBranches(MOCK_BRANCHES);

    setLoading(false);
  };

  const handleRefresh = async () => {
    setSyncing(true);
    setSyncResults(null);
    await loadData();
    setSyncing(false);
    toast({ title: "Refreshed", description: "Data updated successfully" });
  };

  const handleCreateSetupViews = async () => {
    try {
      setCreatingSetupViews(true);
      const response = await api.post<{ success: boolean; message: string }>("/api/v1/foundation_views/create_all_setup_views");
      if (response?.success) {
        toast({ title: "Success", description: response.message || "Setup views created" });
        await loadData();
      }
    } catch (error) {
      console.error("Failed to create setup views:", error);
      toast({ title: "Error", description: "Failed to create setup views", variant: "destructive" });
    } finally {
      setCreatingSetupViews(false);
    }
  };

  const handleCreateTable = async () => {
    if (!newTableName.trim()) {
      toast({ title: "Error", description: "Please enter a table name", variant: "destructive" });
      return;
    }

    try {
      setCreating(true);
      const response = await api.post<{ success: boolean; foundation?: TableInfo }>("/api/v1/foundations", {
        foundation: {
          name: newTableName,
          is_live: false,
        },
      });

      if (response?.success && response?.foundation) {
        toast({ title: "Success", description: "Table created successfully" });
        setShowCreateModal(false);
        setNewTableName("");
        await loadData();
        // Navigate to the new table
        router.push(`/tables/${response.foundation.id}/${response.foundation.slug}`);
      }
    } catch (error) {
      console.error("Failed to create table:", error);
      toast({ title: "Error", description: "Failed to create table", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };



  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Filter and sort tables
  const uniqueFeatures = [...new Set(tables.map(t => t.feature).filter((f): f is string => Boolean(f)))].sort();

  const filteredTables = tables.filter(table => {
    const matchesSearch = !searchQuery ||
      table.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.database_table_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.feature?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = activeFilter === "all" || table.type === activeFilter;

    const matchesFeature = featureFilter === "all" ||
      (featureFilter === "none" && !table.feature) ||
      table.feature === featureFilter;

    return matchesSearch && matchesType && matchesFeature;
  }).sort((a, b) => {
    const multiplier = sortDirection === "asc" ? 1 : -1;

    if (sortColumn === "id") return (a.id - b.id) * multiplier;
    if (sortColumn === "columns") return ((a.column_count || 0) - (b.column_count || 0)) * multiplier;
    if (sortColumn === "records") return ((a.record_count || 0) - (b.record_count || 0)) * multiplier;

    const stringColumns: Record<string, keyof TableInfo> = {
      database_table: "database_table_name",
      name: "name",
      feature: "feature",
      type: "type",
    };

    if (stringColumns[sortColumn]) {
      const field = stringColumns[sortColumn];
      const aVal = String(a[field] || "");
      const bVal = String(b[field] || "");
      return aVal.localeCompare(bVal) * multiplier;
    }

    return 0;
  });

  // Calculate counts
  const allCount = tables.length;
  const userCount = tables.filter(t => t.type === "user").length;
  const importCount = tables.filter(t => t.type === "import").length;
  const systemCount = tables.filter(t => t.type === "system").length;



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Developer Tools</h2>
          <p className="text-sm text-muted-foreground">
            Database tables, schema, and developer utilities.
          </p>
        </div>
      </div>

      <Tabs defaultValue="tables" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="tables" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database Tables
          </TabsTrigger>
          <TabsTrigger value="columns" className="flex items-center gap-2">
            <Columns className="h-4 w-4" />
            Columns
          </TabsTrigger>
          <TabsTrigger value="schema" className="flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Database Schema
          </TabsTrigger>
          <TabsTrigger value="blacklist" className="flex items-center gap-2">
            <Ban className="h-4 w-4" />
            Email Blacklist
          </TabsTrigger>
          <TabsTrigger value="branches" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Git Branches
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agent Status
          </TabsTrigger>
        </TabsList>

        {/* Database Tables Tab */}
        <TabsContent value="tables">
          <div className="space-y-4">
            {/* Header with buttons */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Heroku Backend Table View</h3>
                <p className="text-sm text-muted-foreground">
                  All database tables from the Heroku backend, including user-created tables, imported data, and system tables.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-500"
                  onClick={handleCreateSetupViews}
                  disabled={creatingSetupViews}
                >
                  {creatingSetupViews ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Create Setup Views
                </Button>
                <Button
                  variant="default"
                  className="bg-purple-600 hover:bg-purple-500"
                  onClick={handleRefresh}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex gap-2">
              <Button
                variant={activeFilter === "all" ? "default" : "outline"}
                onClick={() => setActiveFilter("all")}
              >
                All ({allCount})
              </Button>
              <Button
                variant={activeFilter === "user" ? "default" : "outline"}
                className={activeFilter === "user" ? "bg-blue-600 hover:bg-blue-500" : ""}
                onClick={() => setActiveFilter("user")}
              >
                User ({userCount})
              </Button>
              <Button
                variant={activeFilter === "import" ? "default" : "outline"}
                className={activeFilter === "import" ? "bg-green-600 hover:bg-green-500" : ""}
                onClick={() => setActiveFilter("import")}
              >
                Import ({importCount})
              </Button>
              <Button
                variant={activeFilter === "system" ? "default" : "outline"}
                className={activeFilter === "system" ? "bg-purple-600 hover:bg-purple-500" : ""}
                onClick={() => setActiveFilter("system")}
              >
                System ({systemCount})
              </Button>
            </div>

            {/* Search and Feature Filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tables by name, database table, or feature..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={featureFilter} onValueChange={setFeatureFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Features" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Features</SelectItem>
                  <SelectItem value="none">No Feature</SelectItem>
                  {uniqueFeatures.map(feature => (
                    <SelectItem key={feature} value={feature}>{feature}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sync Results Panel */}
            {syncResults && (
              <Card className="border-gray-200">
                <CardHeader className="py-3 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <CardTitle className="text-sm">System Tables Sync Results</CardTitle>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          {syncResults.summary?.synced || 0} Synced
                        </span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          {syncResults.summary?.warnings || 0} Warnings
                        </span>
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          {syncResults.summary?.errors || 0} Errors
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSyncResults(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="py-3">
                  <div className="text-sm text-muted-foreground space-y-1">
                    {syncResults.results?.map((result, idx) => (
                      <div key={idx}>
                        <span className="font-medium">{result.icon} {result.name}:</span>{" "}
                        {result.status === "synced" && <span className="text-green-600">✓ Synced</span>}
                        {result.status === "warning" && <span className="text-amber-600">⚠ {result.warnings?.join(", ")}</span>}
                        {result.status === "error" && <span className="text-red-600">✗ {result.issues?.join(", ")}</span>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tables Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="w-16 cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("id")}
                        >
                          <div className="flex items-center">
                            ID
                            <SortIcon column="id" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("database_table")}
                        >
                          <div className="flex items-center">
                            Database Table
                            <SortIcon column="database_table" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("name")}
                        >
                          <div className="flex items-center">
                            Table Name
                            <SortIcon column="name" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("feature")}
                        >
                          <div className="flex items-center">
                            Feature
                            <SortIcon column="feature" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("type")}
                        >
                          <div className="flex items-center">
                            Type
                            <SortIcon column="type" />
                          </div>
                        </TableHead>
                        <TableHead>Usage Status</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("columns")}
                        >
                          <div className="flex items-center">
                            Columns
                            <SortIcon column="columns" />
                          </div>
                        </TableHead>
                        <TableHead>Virtual</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("records")}
                        >
                          <div className="flex items-center">
                            Records
                            <SortIcon column="records" />
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadError ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12">
                            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                            <p className="text-red-600 font-medium">{loadError}</p>
                            <p className="text-sm text-muted-foreground mt-2">
                              Make sure you are logged in and the backend is running.
                            </p>
                            <Button variant="outline" className="mt-4" onClick={handleRefresh}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Retry
                            </Button>
                          </TableCell>
                        </TableRow>
                      ) : filteredTables.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>{searchQuery ? "No tables match your search." : "No database tables found."}</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTables.map((table) => {
                          const isSystem = table.type === "system";
                          return (
                            <TableRow
                              key={table.id}
                              className={cn(
                                "cursor-pointer transition-colors",
                                isSystem
                                  ? "bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20"
                                  : "hover:bg-muted/50"
                              )}
                              onClick={() => {
                                if (table.slug) {
                                  router.push(`/tables/${table.id}/${table.slug}`);
                                }
                              }}
                            >
                              <TableCell className="text-muted-foreground">{table.id}</TableCell>
                              <TableCell>
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {table.database_table_name}
                                </code>
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center">
                                  {table.icon && <span className="mr-2">{table.icon}</span>}
                                  {table.plural_name || table.name}
                                </div>
                              </TableCell>
                              <TableCell>
                                {table.feature ? (
                                  <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">
                                    {table.feature}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    table.type === "system" && "bg-purple-100 text-purple-800",
                                    table.type === "user" && "bg-blue-100 text-blue-800",
                                    table.type === "import" && "bg-green-100 text-green-800"
                                  )}
                                >
                                  {table.type.charAt(0).toUpperCase() + table.type.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {table.usage_status ? (
                                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                    {table.usage_status}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{table.column_count || table.columns_count || 0}</TableCell>
                              <TableCell>
                                <span className="text-muted-foreground">-</span>
                              </TableCell>
                              <TableCell>{(table.record_count || 0).toLocaleString()}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Columns Tab */}
        <TabsContent value="columns">
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search columns across all tables..."
                value={columnSearchQuery}
                onChange={(e) => setColumnSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Columns className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Start typing to search for columns across all tables.</p>
                <p className="text-sm mt-2">
                  Total: {tables.reduce((acc, t) => acc + (t.column_count || 0), 0)} columns across {tables.length} tables
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Database Schema Tab */}
        <TabsContent value="schema">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Database Schema</CardTitle>
                <CardDescription>
                  View the full database schema and relationships.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link
                  href="https://dbdiagram.io"
                  target="_blank"
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium">DB Diagram</p>
                    <p className="text-xs text-muted-foreground">Visual database schema</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Link>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Schema information would be loaded from the backend. This tab provides
                    tools to explore and visualize the database structure.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Git Branches Tab */}
        <TabsContent value="branches">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Git Branches</CardTitle>
                <CardDescription>
                  View branch status for both backend and frontend repositories.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Commit</TableHead>
                      <TableHead>Behind/Ahead</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((branch) => (
                      <TableRow key={branch.name}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                            {branch.name}
                            {branch.current && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                Current
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">Active</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {branch.lastCommit}
                        </TableCell>
                        <TableCell>
                          {branch.behind !== undefined && branch.ahead !== undefined && (
                            <span className="text-sm">
                              {branch.behind > 0 && <span className="text-red-600">↓{branch.behind}</span>}
                              {branch.behind > 0 && branch.ahead > 0 && " / "}
                              {branch.ahead > 0 && <span className="text-green-600">↑{branch.ahead}</span>}
                              {branch.behind === 0 && branch.ahead === 0 && <span className="text-muted-foreground">Up to date</span>}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Email Blacklist Tab */}
        <TabsContent value="blacklist">
          <EmailBlacklistTab />
        </TabsContent>

        {/* Agent Status Tab */}
        <TabsContent value="agents">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Claude Code Agents</CardTitle>
                <CardDescription>
                  Status and statistics for AI development agents.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead>Run Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.name}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {agent.description}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              agent.status === "active" && "bg-green-100 text-green-800",
                              agent.status === "inactive" && "bg-gray-100 text-gray-800",
                              agent.status === "error" && "bg-red-100 text-red-800"
                            )}
                          >
                            {agent.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {agent.last_run
                            ? new Date(agent.last_run).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell>{agent.run_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* External Tools */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">External Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link
                  href="https://dashboard.heroku.com/apps/teeemlive"
                  target="_blank"
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium">Heroku Dashboard</p>
                    <p className="text-xs text-muted-foreground">teeemlive</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Link>
                <Link
                  href="https://vercel.com/abodable-dev/teeem"
                  target="_blank"
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium">Vercel Dashboard</p>
                    <p className="text-xs text-muted-foreground">Frontend deployments</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Link>
                <Link
                  href="https://sentry.io"
                  target="_blank"
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium">Sentry</p>
                    <p className="text-xs text-muted-foreground">Error tracking</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Table Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Table</DialogTitle>
            <DialogDescription>
              Create a custom table to store and manage your data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="table-name" className="text-sm font-medium">
                Table Name
              </label>
              <Input
                id="table-name"
                placeholder="e.g., Customers, Products, Invoices"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !creating) {
                    handleCreateTable();
                  }
                }}
              />
              <p className="text-sm text-muted-foreground">
                Choose a descriptive name for your table. You&apos;ll be able to add columns after creation.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTable} disabled={creating || !newTableName.trim()}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Table"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Table Modal - TODO: Implement preview functionality
         State variables (previewTable, previewColumns, loadingPreview) need to be added
      <Dialog open={!!previewTable} onOpenChange={() => setPreviewTable(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewTable?.name}</DialogTitle>
            <DialogDescription>
              Table: <code className="text-xs bg-muted px-2 py-1 rounded">{previewTable?.database_table_name}</code>
              {" • "}
              {previewColumns.length} columns • {(previewTable?.record_count || 0).toLocaleString()} records
            </DialogDescription>
          </DialogHeader>
          {loadingPreview ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Column Name</TableHead>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Nullable</TableHead>
                    <TableHead>Default</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewColumns.map((column, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{column.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{column.type}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={column.nullable ? "secondary" : "outline"} className={column.nullable ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {column.nullable ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {column.default ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">{column.default}</code>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setPreviewTable(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      */}
    </div>
  );
}
