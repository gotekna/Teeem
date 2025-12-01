"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  RefreshCw,
  Download,
  CheckCircle,
  AlertTriangle,
  Info,
  Database,
  FileText,
  GitCompare,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface ColumnType {
  columnName: string;
  sqlType: string;
  displayType: string;
  icon: string;
  validationRules: string;
  example: string;
  usedFor: string;
  sampleValue?: string;
}

interface SyncColumn {
  column_name: string;
  display_name: string;
  column_type: string;
  trinity_sql: string;
  backend_sql: string;
  frontend_sql: string;
  actual_db_sql: string;
  status: "match" | "mismatch" | "system" | "none";
  is_system: boolean;
}

interface SyncData {
  success: boolean;
  data: SyncColumn[];
  summary: {
    total_columns: number;
    matching: number;
    mismatched: number;
    system_columns: number;
  };
}

function GoldStandardTableTab() {
  const { toast } = useToast();
  const [columns, setColumns] = React.useState<ColumnType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dataSource, setDataSource] = React.useState("Loading...");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadColumnTypes();
  }, []);

  const loadColumnTypes = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ success: boolean; data: ColumnType[]; foundation_id: number }>(
        "/api/v1/column_types"
      );

      if (data.success && data.data) {
        // Add system columns
        const systemColumns: ColumnType[] = [
          {
            columnName: "id",
            sqlType: "INTEGER",
            displayType: "ID / Primary Key",
            icon: "🔑",
            validationRules: "Auto-increment, unique, not null",
            example: "1, 2, 3, 100",
            usedFor: "Primary key for identifying records",
          },
          ...data.data.map((col) => ({
            ...col,
            icon: col.icon || "📝",
          })),
          {
            columnName: "created_at",
            sqlType: "TIMESTAMP",
            displayType: "Date & Time (Created)",
            icon: "📅",
            validationRules: "Auto-populated on creation, not editable",
            example: "19/11/2024 14:30",
            usedFor: "Record creation timestamp",
          },
          {
            columnName: "updated_at",
            sqlType: "TIMESTAMP",
            displayType: "Date & Time (Updated)",
            icon: "📅",
            validationRules: "Auto-updated on any modification",
            example: "19/11/2024 16:45",
            usedFor: "Last modification timestamp",
          },
        ];

        setColumns(systemColumns);
        setDataSource(`Gold Standard Reference Table (ID: ${data.foundation_id})`);
        setError(null);
      } else {
        throw new Error("Invalid API response");
      }
    } catch (err) {
      console.error("Failed to fetch column types:", err);
      setError(err instanceof Error ? err.message : "Failed to load column types");
      setDataSource("Local Fallback (COLUMN_TYPES constant)");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Column Name", "SQL Type", "Display Type", "Validation Rules", "Example", "Used For"];
    const csvRows = [
      headers.join(","),
      ...columns.map((col) =>
        [
          col.columnName,
          `"${col.sqlType}"`,
          `"${col.displayType}"`,
          `"${col.validationRules.replace(/"/g, '""')}"`,
          `"${col.example.replace(/"/g, '""')}"`,
          `"${col.usedFor.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gold_standard_columns.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const data = {
      exportDate: new Date().toISOString(),
      columns: columns,
      statistics: {
        totalColumns: columns.length,
        uniqueSQLTypes: new Set(columns.map((c) => c.sqlType)).size,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gold_standard_columns.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSystemColumn = (name: string) => ["id", "created_at", "updated_at"].includes(name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gold Standard Column Reference</h2>
          <p className="text-sm text-muted-foreground">
            Complete reference of all column types with validation rules and usage guidelines
          </p>
          <Badge
            variant={error ? "secondary" : "default"}
            className={cn("mt-2", error ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800")}
          >
            {dataSource}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadColumnTypes}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportToJSON}>
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Columns</div>
            <div className="text-2xl font-bold">{columns.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardContent className="pt-6">
            <div className="text-sm text-green-700 dark:text-green-400">Unique SQL Types</div>
            <div className="text-2xl font-bold text-green-800 dark:text-green-300">
              {new Set(columns.map((c) => c.sqlType)).size}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 dark:bg-purple-900/20">
          <CardContent className="pt-6">
            <div className="text-sm text-purple-700 dark:text-purple-400">Always Live</div>
            <div className="text-sm font-bold text-purple-800 dark:text-purple-300">
              Real-time from source
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Column Types Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Column Types ({columns.length})
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
            System-Generated Columns (Auto-managed by database)
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Column Name</TableHead>
                  <TableHead>SQL Type</TableHead>
                  <TableHead>Display Type</TableHead>
                  <TableHead>Validation Rules</TableHead>
                  <TableHead>Example</TableHead>
                  <TableHead>Used For</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns.map((col, index) => (
                  <TableRow
                    key={col.columnName}
                    className={cn(isSystemColumn(col.columnName) && "bg-red-50 dark:bg-red-900/10")}
                  >
                    <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code
                          className={cn(
                            "text-sm font-mono font-semibold",
                            isSystemColumn(col.columnName)
                              ? "text-red-600 dark:text-red-400"
                              : "text-indigo-600 dark:text-indigo-400"
                          )}
                        >
                          {col.columnName}
                        </code>
                        {isSystemColumn(col.columnName) && <span>🔒</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-mono text-xs",
                          isSystemColumn(col.columnName) && "bg-red-100 text-red-700 dark:bg-red-900/30"
                        )}
                      >
                        {col.sqlType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span>{col.icon}</span>
                        <span>{col.displayType}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                      {col.validationRules}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{col.example}</code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                      {col.usedFor}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-muted/50">
        <CardContent className="flex gap-3 pt-6">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Usage Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All validation rules are enforced at the database and application level</li>
              <li>Computed fields are read-only and calculated automatically</li>
              <li>Timestamp fields (created_at, updated_at) are managed by the database</li>
              <li>Export data as CSV or JSON using the buttons above</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SyncCheckTab() {
  const [syncData, setSyncData] = React.useState<SyncData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadSyncData();
  }, []);

  const loadSyncData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<SyncData>("/api/v1/gold_table_sync");

      if (data.success) {
        setSyncData(data);
      } else {
        throw new Error("Failed to fetch sync data");
      }
    } catch (err) {
      console.error("Error fetching sync data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch sync data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">Error loading sync data</span>
          </div>
          <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
          <Button variant="outline" onClick={loadSyncData}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!syncData?.data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No sync data available
      </div>
    );
  }

  const { summary } = syncData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gold Table Sync Check</h2>
          <p className="text-sm text-muted-foreground">
            Compares column type definitions across Trinity documentation, backend code, frontend constants, and actual database schema.
          </p>
        </div>
        <Button variant="outline" onClick={loadSyncData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Columns</div>
            <div className="text-2xl font-bold">{summary.total_columns}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardContent className="pt-6">
            <div className="text-sm text-green-700 dark:text-green-400">Matching</div>
            <div className="text-2xl font-bold text-green-800 dark:text-green-300 flex items-center gap-2">
              {summary.matching}
              <CheckCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="text-sm text-yellow-700 dark:text-yellow-400">Mismatched</div>
            <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
              {summary.mismatched}
              <AlertTriangle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <div className="text-sm text-red-700 dark:text-red-400">System Columns</div>
            <div className="text-2xl font-bold text-red-800 dark:text-red-300">{summary.system_columns}</div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
              <span className="text-muted-foreground">System-generated column (id, created_at, updated_at)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
              <span className="text-muted-foreground">All sources match</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" />
              <span className="text-muted-foreground">Sources do not match</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded" />
              <span className="text-muted-foreground">No type defined (expected for relationships)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column Name</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Column Type</TableHead>
                  <TableHead>Trinity SQL</TableHead>
                  <TableHead>Backend SQL</TableHead>
                  <TableHead>Frontend SQL</TableHead>
                  <TableHead>Actual DB SQL</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncData.data.map((col, index) => (
                  <TableRow
                    key={index}
                    className={cn(
                      col.is_system && "bg-red-50 dark:bg-red-900/10",
                      col.status === "match" && !col.is_system && "bg-green-50 dark:bg-green-900/10",
                      col.status === "mismatch" && "bg-yellow-50 dark:bg-yellow-900/10"
                    )}
                  >
                    <TableCell className="font-medium">{col.column_name}</TableCell>
                    <TableCell>{col.display_name}</TableCell>
                    <TableCell>{col.column_type || "-"}</TableCell>
                    <TableCell>{col.trinity_sql}</TableCell>
                    <TableCell>{col.backend_sql}</TableCell>
                    <TableCell>{col.frontend_sql}</TableCell>
                    <TableCell>{col.actual_db_sql}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          col.status === "system" && "bg-red-100 text-red-800",
                          col.status === "match" && "bg-green-100 text-green-800",
                          col.status === "mismatch" && "bg-yellow-100 text-yellow-800"
                        )}
                      >
                        {col.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function GoldStandardTab() {
  return (
    <Tabs defaultValue="table" className="space-y-6">
      <TabsList>
        <TabsTrigger value="table" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Gold Standard Table
        </TabsTrigger>
        <TabsTrigger value="column-info" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Column Info
        </TabsTrigger>
        <TabsTrigger value="sync-check" className="flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Sync Check
        </TabsTrigger>
      </TabsList>

      <TabsContent value="table">
        <GoldStandardTableTab />
      </TabsContent>

      <TabsContent value="column-info">
        <GoldStandardTableTab />
      </TabsContent>

      <TabsContent value="sync-check">
        <SyncCheckTab />
      </TabsContent>
    </Tabs>
  );
}
