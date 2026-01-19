"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  HashtagIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  LinkIcon,
  DocumentIcon,
  ArrowPathRoundedSquareIcon,
  UserIcon,
  CalculatorIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

// Types
interface Column {
  id: number;
  name: string;
  column_type: string;
  is_title: boolean;
}

interface ColumnType {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const COLUMN_TYPES: ColumnType[] = [
  // Text Types
  { value: "single_line_text", label: "Single line of Text", icon: DocumentTextIcon, category: "Text" },
  { value: "email", label: "Email", icon: EnvelopeIcon, category: "Text" },
  { value: "multiple_lines_text", label: "Multiple lines of Text", icon: DocumentIcon, category: "Text" },
  { value: "phone", label: "Phone", icon: PhoneIcon, category: "Text" },
  { value: "url", label: "URL", icon: LinkIcon, category: "Text" },

  // Date/Time Types
  { value: "date", label: "Date", icon: CalendarIcon, category: "Date/Time" },
  { value: "date_and_time", label: "Date and Time", icon: ClockIcon, category: "Date/Time" },

  // Selection Types
  { value: "choice", label: "Choice", icon: ChevronDownIcon, category: "Selection" },
  { value: "boolean", label: "Boolean", icon: CheckCircleIcon, category: "Selection" },

  // Number Types
  { value: "number", label: "Number", icon: HashtagIcon, category: "Number" },
  { value: "whole_number", label: "Whole Number", icon: HashtagIcon, category: "Number" },
  { value: "percentage", label: "Percentage", icon: HashtagIcon, category: "Number" },
  { value: "currency", label: "Currency", icon: CurrencyDollarIcon, category: "Number" },

  // Relationship Types
  { value: "lookup", label: "Lookup", icon: ArrowPathRoundedSquareIcon, category: "Relationship" },
  { value: "multiple_lookups", label: "Multiple Lookups", icon: ArrowPathRoundedSquareIcon, category: "Relationship" },
  { value: "user", label: "User", icon: UserIcon, category: "Relationship" },

  // Advanced Types
  { value: "computed", label: "Computed", icon: CalculatorIcon, category: "Advanced" },
  { value: "subquery", label: "Subquery", icon: FunnelIcon, category: "Advanced" },
];

const CATEGORIES = ["Text", "Date/Time", "Selection", "Number", "Relationship", "Advanced"];

export default function TableBuilder() {
  const router = useRouter();
  const { toast } = useToast();
  const [tableName, setTableName] = useState("Untitled Table");
  const [isEditingName, setIsEditingName] = useState(false);
  const [columns, setColumns] = useState<Column[]>([
    { id: 1, name: "Name", column_type: "single_line_text", is_title: true },
    { id: 2, name: "Email", column_type: "email", is_title: false },
    { id: 3, name: "Phone", column_type: "single_line_text", is_title: false },
    { id: 4, name: "Status", column_type: "single_line_text", is_title: false },
    { id: 5, name: "Created Date", column_type: "date", is_title: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addColumn = () => {
    const newColumn: Column = {
      id: Date.now(),
      name: `Column ${columns.length}`,
      column_type: "single_line_text",
      is_title: false,
    };
    setColumns([...columns, newColumn]);
  };

  const removeColumn = (id: number) => {
    if (columns.length === 1) {
      toast({ title: "Validation Error", description: "Tables must have at least one column", variant: "destructive" });
      return;
    }
    setColumns(columns.filter((col) => col.id !== id));
  };

  const updateColumn = (id: number, updates: Partial<Column>) => {
    setColumns(columns.map((col) => (col.id === id ? { ...col, ...updates } : col)));
  };

  const getTypeIcon = (type: string) => {
    const typeInfo = COLUMN_TYPES.find((t) => t.value === type);
    const IconComponent = typeInfo?.icon || DocumentTextIcon;
    return <IconComponent className="h-4 w-4 text-muted-foreground" />;
  };

  const handleSave = async () => {
    if (!tableName.trim()) {
      setError("Table name is required");
      return;
    }

    if (columns.length === 0) {
      setError("At least one column is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Step 1: Create the table
      const tableResponse = await api.post<{
        success: boolean;
        foundation?: { id: number; slug: string };
        table?: { id: number; slug: string };
      }>("/api/v1/foundations", {
        foundation: {
          name: tableName,
          searchable: true,
        },
      });

      const tableData = tableResponse?.foundation || tableResponse?.table;
      if (!tableResponse?.success || !tableData) {
        setError("Failed to create table");
        return;
      }

      const foundationId = tableData.id;
      const tableSlug = tableData.slug;

      // Step 2: Create each column
      for (let index = 0; index < columns.length; index++) {
        const col = columns[index];
        const columnData = {
          name: col.name,
          column_name: col.name
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, ""),
          column_type: col.column_type,
          is_title: index === 0,
          searchable: true,
          required: false,
        };

        const columnResponse = await api.post<{ success: boolean }>(
          `/api/v1/foundations/${foundationId}/columns`,
          { column: columnData }
        );

        if (!columnResponse?.success) {
          setError(`Failed to create column: ${col.name}`);
          return;
        }
      }

      // Step 3: Navigate to the spreadsheet view
      router.push(`/tables/${tableSlug}`);
    } catch (err) {
      console.error("Table creation error:", err);
      setError((err as Error).message || "Failed to create table");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header - Google Sheets style */}
      <div className="border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-4">
            {isEditingName ? (
              <Input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setIsEditingName(false);
                }}
                autoFocus
                className="text-lg font-normal"
              />
            ) : (
              <h1
                onClick={() => setIsEditingName(true)}
                className="cursor-pointer rounded px-2 py-1 text-lg font-normal hover:bg-muted"
              >
                {tableName}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-x-2">
            <Button variant="ghost" onClick={() => router.push("/designer")}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Creating..." : "Create Table"}
            </Button>
          </div>
        </div>
        {error && <div className="mt-2 text-sm text-destructive">{error}</div>}
      </div>

      {/* Spreadsheet Grid - Google Sheets style */}
      <div className="flex-1 overflow-auto bg-background">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-muted/50">
                {/* Row number header */}
                <th className="sticky left-0 z-20 w-12 border-b border-r bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground"></span>
                </th>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className="group relative min-w-[200px] border-b border-r px-3 py-2.5 text-left"
                  >
                    <div className="flex items-center gap-x-2">
                      {/* Column Type Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-auto gap-x-1 px-1.5 py-1">
                            {getTypeIcon(column.column_type)}
                            <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-96 overflow-y-auto">
                          {CATEGORIES.map((category) => (
                            <div key={category}>
                              <DropdownMenuLabel className="text-xs uppercase tracking-wider">
                                {category}
                              </DropdownMenuLabel>
                              {COLUMN_TYPES.filter((type) => type.category === category).map(
                                (type) => {
                                  const Icon = type.icon;
                                  return (
                                    <DropdownMenuItem
                                      key={type.value}
                                      onClick={() =>
                                        updateColumn(column.id, { column_type: type.value })
                                      }
                                    >
                                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                      <span>{type.label}</span>
                                    </DropdownMenuItem>
                                  );
                                }
                              )}
                              <DropdownMenuSeparator />
                            </div>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Column Name Input */}
                      <Input
                        value={column.name}
                        onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                        placeholder="Column name"
                        className="h-auto flex-1 border-none bg-transparent p-0 text-sm font-medium focus-visible:ring-0"
                      />

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeColumn(column.id)}
                        className="h-auto w-auto p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <TrashIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </th>
                ))}

                {/* Add Column Button */}
                <th className="w-12 border-b border-r px-3 py-2">
                  <Button variant="ghost" size="icon" onClick={addColumn} title="Add column">
                    <PlusIcon className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody className="bg-background">
              {/* Sample Rows */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rowNum) => (
                <tr key={rowNum} className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                  <td className="sticky left-0 z-10 h-11 border-b border-r bg-muted/50 px-3 text-center group-hover:bg-blue-100/50 dark:group-hover:bg-blue-900/20">
                    <span className="text-xs text-muted-foreground">{rowNum}</span>
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className="h-11 border-b border-r bg-background px-3 text-sm text-muted-foreground group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10"
                    />
                  ))}
                  <td className="h-11 border-b border-r" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer hint */}
      <div className="border-t bg-background px-4 py-2">
        <p className="text-xs text-muted-foreground">
          Click column headers to edit names and types. Add data after creating the table.
        </p>
      </div>
    </div>
  );
}
