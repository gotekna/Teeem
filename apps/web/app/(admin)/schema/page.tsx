"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Plus, Settings, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SchemaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Schema Editor</h1>
          <p className="text-muted-foreground mt-1">
            Create and modify table schemas, columns, and relationships
          </p>
        </div>
        <Button disabled>
          <Plus className="h-4 w-4 mr-2" />
          New Table
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Foundation Tables</CardTitle>
              <CardDescription>Manage table structure and column definitions</CardDescription>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 border border-dashed text-muted-foreground">
            <div className="text-center">
              <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Schema editor will be integrated here</p>
              <p className="text-xs mt-1">Create columns, set types, configure relationships</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
