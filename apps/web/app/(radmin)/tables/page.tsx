"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table2, Search, Filter, Columns, Save, Download } from "lucide-react";

export default function TablesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Gold Standard Tables</h1>
        <p className="text-muted-foreground mt-1">
          Dynamic table viewer with saved views, custom columns, and advanced filtering
        </p>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Server-side Search</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Debounced search across all columns with backend filtering
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Advanced Filters</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Per-column filters with type-aware controls
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Columns className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Custom Columns</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Add computed fields, formulas, and custom column types
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Saved Views</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Save and share custom table configurations
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Export</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Export to CSV and Excel with current filters applied
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for table list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available Tables</CardTitle>
              <CardDescription>Select a table to view and manage</CardDescription>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 border border-dashed text-muted-foreground">
            <div className="text-center">
              <Table2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Gold Standard Table component will be integrated here</p>
              <p className="text-xs mt-1">This connects to the foundation tables API</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
