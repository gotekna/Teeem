"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Loader2,
  RefreshCw,
  Database,
  Code,
  Search,
  ExternalLink,
  Copy,
  Check,
  Table as TableIcon,
  Columns,
  Bot,
  Terminal,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TableInfo {
  name: string;
  row_count: number;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  default_value: string | null;
}

interface AgentInfo {
  name: string;
  description: string;
  status: "active" | "inactive" | "error";
  last_run: string | null;
  run_count: number;
}

export function DeveloperToolsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [tables, setTables] = React.useState<TableInfo[]>([]);
  const [agents, setAgents] = React.useState<AgentInfo[]>([]);
  const [searchTables, setSearchTables] = React.useState("");
  const [searchColumns, setSearchColumns] = React.useState("");
  const [copiedTable, setCopiedTable] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load tables
      const tablesData = await api.get<TableInfo[]>("/api/v1/developer/tables");
      setTables(tablesData);
    } catch (error) {
      console.error("Failed to load tables:", error);
      // Mock data
      setTables([
        {
          name: "jobs",
          row_count: 156,
          columns: [
            { name: "id", data_type: "integer", is_nullable: false, default_value: "nextval" },
            { name: "name", data_type: "varchar(255)", is_nullable: false, default_value: null },
            { name: "status", data_type: "varchar(50)", is_nullable: true, default_value: "'draft'" },
            { name: "job_type_id", data_type: "integer", is_nullable: true, default_value: null },
            { name: "customer_id", data_type: "integer", is_nullable: true, default_value: null },
            { name: "created_at", data_type: "timestamp", is_nullable: false, default_value: "now()" },
            { name: "updated_at", data_type: "timestamp", is_nullable: false, default_value: "now()" },
          ],
        },
        {
          name: "contacts",
          row_count: 432,
          columns: [
            { name: "id", data_type: "integer", is_nullable: false, default_value: "nextval" },
            { name: "name", data_type: "varchar(255)", is_nullable: false, default_value: null },
            { name: "email", data_type: "varchar(255)", is_nullable: true, default_value: null },
            { name: "phone", data_type: "varchar(20)", is_nullable: true, default_value: null },
            { name: "contact_type", data_type: "varchar(50)", is_nullable: true, default_value: null },
          ],
        },
        {
          name: "schedule_tasks",
          row_count: 1289,
          columns: [
            { name: "id", data_type: "integer", is_nullable: false, default_value: "nextval" },
            { name: "name", data_type: "varchar(255)", is_nullable: false, default_value: null },
            { name: "job_id", data_type: "integer", is_nullable: false, default_value: null },
            { name: "start_date", data_type: "date", is_nullable: true, default_value: null },
            { name: "end_date", data_type: "date", is_nullable: true, default_value: null },
            { name: "duration_days", data_type: "integer", is_nullable: true, default_value: "1" },
          ],
        },
        {
          name: "foundations",
          row_count: 12,
          columns: [
            { name: "id", data_type: "integer", is_nullable: false, default_value: "nextval" },
            { name: "name", data_type: "varchar(255)", is_nullable: false, default_value: null },
            { name: "table_name", data_type: "varchar(255)", is_nullable: false, default_value: null },
          ],
        },
        {
          name: "users",
          row_count: 8,
          columns: [
            { name: "id", data_type: "integer", is_nullable: false, default_value: "nextval" },
            { name: "email", data_type: "varchar(255)", is_nullable: false, default_value: null },
            { name: "name", data_type: "varchar(255)", is_nullable: true, default_value: null },
            { name: "role", data_type: "varchar(50)", is_nullable: true, default_value: "'user'" },
          ],
        },
      ]);
    }

    try {
      // Load agents
      const agentsData = await api.get<AgentInfo[]>("/api/v1/developer/agents");
      setAgents(agentsData);
    } catch (error) {
      console.error("Failed to load agents:", error);
      // Mock data
      setAgents([
        { name: "Backend Developer", description: "Rails API, database, models", status: "active", last_run: new Date().toISOString(), run_count: 156 },
        { name: "Frontend Developer", description: "React/Next.js components", status: "active", last_run: new Date().toISOString(), run_count: 234 },
        { name: "Bug Hunter", description: "Production error analysis", status: "active", last_run: new Date(Date.now() - 3600000).toISOString(), run_count: 45 },
        { name: "Deploy Manager", description: "Heroku/Vercel deployments", status: "active", last_run: new Date(Date.now() - 7200000).toISOString(), run_count: 89 },
        { name: "Trinity Sync Validator", description: "Documentation sync check", status: "inactive", last_run: null, run_count: 12 },
        { name: "UI Compliance Auditor", description: "UI/UX standards check", status: "inactive", last_run: null, run_count: 8 },
      ]);
    }

    setLoading(false);
  };

  const handleCopyTable = (tableName: string) => {
    navigator.clipboard.writeText(tableName);
    setCopiedTable(tableName);
    setTimeout(() => setCopiedTable(null), 2000);
    toast({ title: "Copied", description: `"${tableName}" copied to clipboard` });
  };

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchTables.toLowerCase())
  );

  const allColumns = tables.flatMap((t) =>
    t.columns.map((c) => ({ ...c, tableName: t.name }))
  );

  const filteredColumns = searchColumns
    ? allColumns.filter(
        (c) =>
          c.name.toLowerCase().includes(searchColumns.toLowerCase()) ||
          c.tableName.toLowerCase().includes(searchColumns.toLowerCase())
      )
    : [];

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
            Database schema, agent status, and developer utilities.
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="tables" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tables" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database Tables
          </TabsTrigger>
          <TabsTrigger value="columns" className="flex items-center gap-2">
            <Columns className="h-4 w-4" />
            Column Search
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Utilities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables">
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tables..."
                value={searchTables}
                onChange={(e) => setSearchTables(e.target.value)}
                className="pl-9"
              />
            </div>

            <Card>
              <CardContent className="p-0">
                <Accordion type="multiple" className="w-full">
                  {filteredTables.map((table) => (
                    <AccordionItem key={table.name} value={table.name}>
                      <AccordionTrigger className="px-4 hover:no-underline">
                        <div className="flex items-center gap-3 flex-1">
                          <TableIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{table.name}</span>
                          <Badge variant="secondary" className="ml-auto mr-4">
                            {table.row_count.toLocaleString()} rows
                          </Badge>
                          <Badge variant="outline">{table.columns.length} columns</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm text-muted-foreground">
                            Table columns and data types
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyTable(table.name)}
                          >
                            {copiedTable === table.name ? (
                              <Check className="h-4 w-4 mr-1" />
                            ) : (
                              <Copy className="h-4 w-4 mr-1" />
                            )}
                            Copy name
                          </Button>
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Column</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Nullable</TableHead>
                                <TableHead>Default</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {table.columns.map((col) => (
                                <TableRow key={col.name}>
                                  <TableCell className="font-mono text-sm">{col.name}</TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground">
                                    {col.data_type}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={col.is_nullable ? "secondary" : "outline"}>
                                      {col.is_nullable ? "YES" : "NO"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground">
                                    {col.default_value || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground">
              {filteredTables.length} of {tables.length} tables
              {searchTables && " (filtered)"}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="columns">
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search columns across all tables..."
                value={searchColumns}
                onChange={(e) => setSearchColumns(e.target.value)}
                className="pl-9"
              />
            </div>

            {searchColumns ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table</TableHead>
                        <TableHead>Column</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Nullable</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredColumns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No columns found matching &quot;{searchColumns}&quot;
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredColumns.map((col, index) => (
                          <TableRow key={`${col.tableName}-${col.name}-${index}`}>
                            <TableCell className="font-mono text-sm">{col.tableName}</TableCell>
                            <TableCell className="font-mono text-sm font-medium">{col.name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {col.data_type}
                            </TableCell>
                            <TableCell>
                              <Badge variant={col.is_nullable ? "secondary" : "outline"}>
                                {col.is_nullable ? "YES" : "NO"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Columns className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Start typing to search for columns across all tables.</p>
                  <p className="text-sm mt-2">
                    Total: {allColumns.length} columns across {tables.length} tables
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

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
          </div>
        </TabsContent>

        <TabsContent value="tools">
          <div className="grid gap-4 md:grid-cols-2">
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link
                  href="/admin/system?tab=gold-standard"
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium">Gold Standard Table</p>
                    <p className="text-xs text-muted-foreground">Column type reference</p>
                  </div>
                  <Code className="h-4 w-4 text-muted-foreground" />
                </Link>
                <Link
                  href="/documentation"
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium">Trinity Documentation</p>
                    <p className="text-xs text-muted-foreground">Bible, Teacher, Lexicon</p>
                  </div>
                  <Code className="h-4 w-4 text-muted-foreground" />
                </Link>
                <Link
                  href="/api/v1/health"
                  target="_blank"
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium">API Health Check</p>
                    <p className="text-xs text-muted-foreground">/api/v1/health</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
