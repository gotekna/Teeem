"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import {
  Plus,
  Calendar,
  Clock,
  Copy,
  Star,
  MoreHorizontal,
  Edit,
  Trash,
  Eye,
  CheckCircle,
  ListTodo,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

// Foundation ID for Schedule Templates table

export default function ScheduleTemplatesPage() {
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Use foundation hook for TeeemTableView
  const { foundation, columns, records, isLoading, error, refresh } = useFoundationBySlug("schedule_templates");

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/schedule_templates/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update schedule template:", error);
      throw error;
    }
  }, [refresh]);

  // Stats from records
  const defaultTemplateRecord = records.find((t) => t.is_default);
  const stats = {
    total: records.length,
    defaultTemplate: (defaultTemplateRecord?.name as string) || "None",
    totalTasks: records.reduce((sum, t) => sum + (Number(t.total_tasks) || 0), 0),
    timesUsed: records.reduce((sum, t) => sum + (Number(t.used_count) || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  // Left actions - Create Template button
  const leftActions = (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Create Template
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Schedule Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-built schedules to quickly set up new jobs
            
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "cards" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("cards")}
        >
          <LayoutGrid className="h-4 w-4 mr-1" />
          Cards
        </Button>
        <Button
          variant={viewMode === "table" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("table")}
        >
          <List className="h-4 w-4 mr-1" />
          Table
        </Button>
      </div>

      {/* Content */}
      {viewMode === "table" ? (
        <TeeemTableView
          entries={records}
          columns={columns}
          foundationId="schedule_templates"
          foundationIdNumeric={foundation?.id}
          tableName={foundation?.name || "Schedule Templates"}
          enableExport={true}
          onRefresh={refresh}
          onRowUpdate={handleRowUpdate}
          leftActions={leftActions}
        />
      ) : (
        /* Templates Grid - Card View */
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer transition-all hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {String(template.name || "")}
                      {Boolean(template.is_default) && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">{String(template.description || "")}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Star className="h-4 w-4 mr-2" />
                        Set as Default
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <ListTodo className="h-4 w-4" />
                    {Number(template.total_tasks) || 0} tasks
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {Number(template.estimated_duration_days) || 0} days
                  </div>
                </div>

                <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400">
                  {String(template.job_type || "General")}
                </Badge>

                <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                  Used {Number(template.used_count) || 0} times
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
