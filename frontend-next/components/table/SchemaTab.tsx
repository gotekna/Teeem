"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getColumnTypeEmoji, getColumnTypeLabel } from "@/lib/column-type-registry";
import { isChoiceColumn } from "@/lib/constants/column-types";
import { copyToClipboard } from "@/utils/formatters";
import { Key, Link, Calculator, Copy, Check } from "lucide-react";
import { TableColumn } from "./types";

interface SchemaTabProps {
  foundationId: number;
  columns: TableColumn[];
  tableName: string;
  onRefresh?: () => void;
}

// SQL type mapping
const SQL_TYPE_MAP: Record<string, string> = {
  single_line_text: "VARCHAR(255)",
  multiple_lines_text: "TEXT",
  email: "VARCHAR(255)",
  phone: "VARCHAR(20)",
  mobile: "VARCHAR(20)",
  url: "VARCHAR(500)",
  whole_number: "INTEGER",
  number: "NUMERIC(10,2)",
  currency: "NUMERIC(10,2)",
  percentage: "NUMERIC(5,2)",
  date: "DATE",
  date_and_time: "TIMESTAMP",
  boolean: "BOOLEAN",
  choice: "VARCHAR(50)",
  lookup: "VARCHAR(255)",
  multiple_lookups: "TEXT",
  user: "INTEGER",
  computed: "VIRTUAL/COMPUTED",
  file_upload: "TEXT",
};

export function SchemaTab({ foundationId, columns, tableName, onRefresh }: SchemaTabProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [foundations, setFoundations] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [schemaDetails, setSchemaDetails] = useState<Record<string, Record<string, unknown>>>({});

  // Fetch full schema details from API
  useEffect(() => {
    const fetchSchemaDetails = async () => {
      try {
        const response = await api.get(`/api/v1/foundations/${foundationId}/schema`) as { columns?: Record<string, unknown>[] };
        if (response?.columns) {
          const details: Record<string, Record<string, unknown>> = {};
          for (const col of response.columns) {
            // Use name or key as identifier
            const colKey = (col.name as string) || (col.key as string);
            if (colKey) {
              details[colKey] = col;
            }
          }
          setSchemaDetails(details);
        }
      } catch (error) {
        console.error("Failed to fetch schema details:", error);
      }
    };

    fetchSchemaDetails();
  }, [foundationId]);

  // Fetch foundation names for lookup columns
  useEffect(() => {
    const fetchFoundationNames = async () => {
      try {
        // Get lookup target IDs from lookup_foundation_id
        const lookupFoundationIds = columns
          .filter((c) => c.lookup_foundation_id)
          .map((c) => c.lookup_foundation_id)
          .filter((id, index, self) => id && self.indexOf(id) === index) as number[];

        if (lookupFoundationIds.length === 0) {
          setLoading(false);
          return;
        }

        const foundationMap: Record<number, string> = {};
        for (const id of lookupFoundationIds) {
          try {
            const response = await api.get(`/api/v1/foundations/${id}`) as { foundation?: { name?: string } };
            if (response?.foundation?.name) {
              foundationMap[id] = response.foundation.name;
            }
          } catch {
            foundationMap[id] = `Table #${id}`;
          }
        }
        setFoundations(foundationMap);
      } catch (error) {
        console.error("Failed to fetch foundation names:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFoundationNames();
  }, [columns]);

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filter out system columns like select/actions
  const displayColumns = columns.filter(
    (c) => c.key && !["select", "actions"].includes(c.key.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Schema Definition</h3>
          <Badge variant="outline">{displayColumns.length} columns</Badge>
        </div>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
        )}
      </div>

      {/* Schema Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-48">Column Name</TableHead>
              <TableHead className="w-36">Type</TableHead>
              <TableHead className="w-40">SQL Type</TableHead>
              <TableHead className="w-24">Constraints</TableHead>
              <TableHead className="w-48">Lookup Target</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayColumns.map((column, index) => {
              const colType = column.column_type || "single_line_text";
              const sqlType = SQL_TYPE_MAP[colType] || "VARCHAR(255)";
              const emoji = getColumnTypeEmoji(colType);
              const typeLabel = getColumnTypeLabel(colType);

              // Get additional schema details
              const details = schemaDetails[column.key] || {};
              const isTitle = details.is_title as boolean | undefined;
              const required = details.required as boolean | undefined;
              const isUnique = details.is_unique as boolean | undefined;
              const maxLength = details.max_length as number | undefined;
              const description = details.description as string | undefined;
              const lookupFoundationId = (details.lookup_foundation_id as number) || column.lookup_foundation_id;
              const isMultiple = details.is_multiple as boolean | undefined;

              return (
                <TableRow key={column.key} className="hover:bg-muted/30">
                  {/* Position */}
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {index + 1}
                  </TableCell>

                  {/* Column Name */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{column.label}</span>
                      {isTitle && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-xs">
                                Title
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Primary display column</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{column.key}</div>
                  </TableCell>

                  {/* Type with Emoji */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{emoji}</span>
                      <span className="text-sm">{typeLabel}</span>
                    </div>
                  </TableCell>

                  {/* SQL Type */}
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                      {sqlType}
                    </code>
                  </TableCell>

                  {/* Constraints */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {required && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="destructive" className="text-xs px-1">
                                REQ
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Required field</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {isUnique && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Key className="h-3 w-3 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent>Unique constraint</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {colType === "computed" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Calculator className="h-3 w-3 text-purple-500 dark:text-purple-400" />
                            </TooltipTrigger>
                            <TooltipContent>Computed/Formula field</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {maxLength && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs px-1">
                                max:{maxLength}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Maximum length: {maxLength}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>

                  {/* Lookup Target */}
                  <TableCell>
                    {lookupFoundationId ? (
                      <div className="flex items-center gap-2">
                        <Link className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                        <span className="text-sm">
                          {foundations[lookupFoundationId] || `Table #${lookupFoundationId}`}
                        </span>
                        {isMultiple && (
                          <Badge variant="outline" className="text-xs">
                            Multiple
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>

                  {/* Description */}
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {description || "-"}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(column.key)}
                          >
                            {copiedKey === column.key ? (
                              <Check className="h-3 w-3 text-green-500 dark:text-green-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy column key</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Choice Columns Summary */}
      {displayColumns.filter((c) => isChoiceColumn(c.column_type) && c.choices?.length).length > 0 && (
        <div className="border rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-sm">Choice Column Options</h4>
          <div className="grid gap-3">
            {displayColumns
              .filter((c) => isChoiceColumn(c.column_type) && c.choices?.length)
              .map((column) => (
                <div key={column.key} className="flex items-start gap-3">
                  <span className="font-medium text-sm min-w-32">{column.label}:</span>
                  <div className="flex flex-wrap gap-1">
                    {column.choices?.map((choice, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {choice}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SchemaTab;
