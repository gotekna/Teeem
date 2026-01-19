"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, ArrowLeft, Link2, ExternalLink, Database } from "lucide-react";
import NextLink from "next/link";
import { urls } from "@/lib/url-utils";
import { isLookupColumn } from "@/lib/constants/column-types";
import { TableColumn } from "./types";

interface Foundation {
  id: number;
  name: string;
  table_type?: string;
}

interface SchemaColumn {
  id: number;
  name: string;
  key?: string;
  column_type: string;
  lookup_foundation_id?: number;
  lookup_display_column?: string;
  is_multiple?: boolean;
  foundation_id?: number;
}

interface Connection {
  type: "outgoing" | "incoming";
  columnKey: string;
  columnName: string;
  targetFoundationId: number;
  targetFoundationName: string;
  targetColumnName?: string;
  isMultiple: boolean;
  sourceFoundationId?: number;
  sourceFoundationName?: string;
}

interface ConnectionsTabProps {
  foundationId: number;
  columns: TableColumn[];
  tableName: string;
}

export function ConnectionsTab({ foundationId, columns, tableName }: ConnectionsTabProps) {
  const [loading, setLoading] = useState(true);
  const [foundations, setFoundations] = useState<Foundation[]>([]);
  const [allColumns, setAllColumns] = useState<SchemaColumn[]>([]);
  const [schemaDetails, setSchemaDetails] = useState<Record<string, SchemaColumn>>({});

  // Fetch schema details for current table and all other tables
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        setLoading(true);

        // Fetch all foundations
        const foundationsResponse = await api.get("/api/v1/foundations") as { foundations?: Foundation[] } | Foundation[];
        const foundationsList: Foundation[] = (foundationsResponse as { foundations?: Foundation[] })?.foundations || (foundationsResponse as Foundation[]) || [];
        setFoundations(foundationsList);

        // Fetch schema for current table to get lookup_foundation_id
        try {
          const currentSchema = await api.get(`/api/v1/foundations/${foundationId}/schema`) as { columns?: SchemaColumn[] };
          if (currentSchema?.columns) {
            const details: Record<string, SchemaColumn> = {};
            for (const col of currentSchema.columns) {
              const colKey = col.name || col.key;
              if (colKey) {
                details[colKey] = col;
              }
            }
            setSchemaDetails(details);
          }
        } catch {
          // Continue without schema details
        }

        // Fetch columns from all other foundations to find incoming connections
        const allColumnsData: SchemaColumn[] = [];
        for (const foundation of foundationsList) {
          if (foundation.id === foundationId) continue;

          try {
            const response = await api.get(`/api/v1/foundations/${foundation.id}/schema`) as { columns?: SchemaColumn[] };
            if (response?.columns) {
              const columnsWithFoundation = response.columns.map((c: SchemaColumn) => ({
                ...c,
                foundation_id: foundation.id,
              }));
              allColumnsData.push(...columnsWithFoundation);
            }
          } catch {
            // Silently skip tables we can't access
          }
        }

        setAllColumns(allColumnsData);
      } catch (error) {
        console.error("Failed to fetch connections:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, [foundationId]);

  // Build connection list
  const connections = useMemo<Connection[]>(() => {
    const result: Connection[] = [];

    // Outgoing connections (columns in this table that link to other tables)
    columns.forEach((column) => {
      // Get lookup target from schema details or column properties
      const details = schemaDetails[column.key];
      const lookupFoundationId = details?.lookup_foundation_id || column.lookup_foundation_id;

      if (lookupFoundationId) {
        const targetFoundation = foundations.find((f) => f.id === lookupFoundationId);
        const isMultiple = details?.is_multiple || column.column_type === 'multiple_lookups'; // Note: This is an explicit check for the specific type, not a general lookup check

        result.push({
          type: "outgoing",
          columnKey: column.key,
          columnName: column.label,
          targetFoundationId: lookupFoundationId,
          targetFoundationName: targetFoundation?.name || `Table #${lookupFoundationId}`,
          targetColumnName: details?.lookup_display_column || column.lookup_display_column,
          isMultiple: !!isMultiple,
        });
      }
    });

    // Incoming connections (columns from other tables that link to this table)
    allColumns.forEach((column) => {
      if (column.lookup_foundation_id === foundationId) {
        const sourceFoundation = foundations.find((f) => f.id === column.foundation_id);
        result.push({
          type: "incoming",
          columnKey: column.name,
          columnName: column.name,
          targetFoundationId: foundationId,
          targetFoundationName: tableName,
          targetColumnName: column.lookup_display_column,
          isMultiple: column.is_multiple || column.column_type === 'multiple_lookups',
          sourceFoundationId: column.foundation_id,
          sourceFoundationName: sourceFoundation?.name || `Table #${column.foundation_id}`,
        });
      }
    });

    return result;
  }, [columns, allColumns, foundations, foundationId, tableName, schemaDetails]);

  const outgoingConnections = connections.filter((c) => c.type === "outgoing");
  const incomingConnections = connections.filter((c) => c.type === "incoming");

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <h3 className="text-lg font-semibold">Table Connections</h3>
        <Badge variant="outline">
          {outgoingConnections.length} outgoing
        </Badge>
        <Badge variant="outline">
          {incomingConnections.length} incoming
        </Badge>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="font-semibold text-lg mb-2">No Connections</h4>
            <p className="text-muted-foreground max-w-md">
              This table has no lookup columns connecting it to other tables,
              and no other tables reference this one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Outgoing Connections */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-blue-500" />
                Outgoing Connections
              </CardTitle>
              <CardDescription>
                Columns in this table that link to other tables
              </CardDescription>
            </CardHeader>
            <CardContent>
              {outgoingConnections.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No outgoing connections
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Column</TableHead>
                      <TableHead>Target Table</TableHead>
                      <TableHead className="w-20">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outgoingConnections.map((conn) => (
                      <TableRow key={`out-${conn.columnKey}`}>
                        <TableCell className="font-medium">
                          {conn.columnName}
                        </TableCell>
                        <TableCell>
                          <NextLink
                            href={urls.table(conn.targetFoundationId, conn.targetFoundationName.toLowerCase().replace(/\s+/g, "-"))}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {conn.targetFoundationName}
                            <ExternalLink className="h-3 w-3" />
                          </NextLink>
                          {conn.targetColumnName && (
                            <span className="text-xs text-muted-foreground block">
                              Display: {conn.targetColumnName}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={conn.isMultiple ? "default" : "secondary"} className="text-xs">
                            {conn.isMultiple ? "Many" : "One"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Incoming Connections */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeft className="h-4 w-4 text-green-500" />
                Incoming Connections
              </CardTitle>
              <CardDescription>
                Other tables that link to this table
              </CardDescription>
            </CardHeader>
            <CardContent>
              {incomingConnections.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No incoming connections
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source Table</TableHead>
                      <TableHead>Column</TableHead>
                      <TableHead className="w-20">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomingConnections.map((conn) => (
                      <TableRow key={`in-${conn.columnKey}-${conn.sourceFoundationId}`}>
                        <TableCell>
                          <NextLink
                            href={urls.table(conn.sourceFoundationId!, conn.sourceFoundationName!.toLowerCase().replace(/\s+/g, "-"))}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {conn.sourceFoundationName}
                            <ExternalLink className="h-3 w-3" />
                          </NextLink>
                        </TableCell>
                        <TableCell className="font-medium">
                          {conn.columnName}
                        </TableCell>
                        <TableCell>
                          <Badge variant={conn.isMultiple ? "default" : "secondary"} className="text-xs">
                            {conn.isMultiple ? "Many" : "One"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Visual Diagram */}
      {connections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Connection Diagram
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-8 py-6">
              {/* Incoming sources */}
              {incomingConnections.length > 0 && (
                <div className="flex flex-col gap-2">
                  {incomingConnections.slice(0, 5).map((conn) => (
                    <div
                      key={`diag-in-${conn.columnKey}-${conn.sourceFoundationId}`}
                      className="px-3 py-1.5 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded text-sm"
                    >
                      {conn.sourceFoundationName}
                    </div>
                  ))}
                  {incomingConnections.length > 5 && (
                    <Badge variant="outline">+{incomingConnections.length - 5} more</Badge>
                  )}
                </div>
              )}

              {/* Arrows in */}
              {incomingConnections.length > 0 && (
                <div className="flex flex-col items-center">
                  <ArrowRight className="h-6 w-6 text-green-500" />
                </div>
              )}

              {/* Current table */}
              <div className="px-6 py-4 bg-primary/10 border-2 border-primary rounded-lg font-semibold">
                {tableName}
              </div>

              {/* Arrows out */}
              {outgoingConnections.length > 0 && (
                <div className="flex flex-col items-center">
                  <ArrowRight className="h-6 w-6 text-blue-500" />
                </div>
              )}

              {/* Outgoing targets */}
              {outgoingConnections.length > 0 && (
                <div className="flex flex-col gap-2">
                  {outgoingConnections.slice(0, 5).map((conn) => (
                    <div
                      key={`diag-out-${conn.columnKey}`}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-sm"
                    >
                      {conn.targetFoundationName}
                    </div>
                  ))}
                  {outgoingConnections.length > 5 && (
                    <Badge variant="outline">+{outgoingConnections.length - 5} more</Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ConnectionsTab;
