"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Data Imports</h1>
          <p className="text-muted-foreground mt-1">
            Bulk import data from CSV, Excel, and external systems
          </p>
        </div>
        <Button disabled>
          <Upload className="h-4 w-4 mr-2" />
          New Import
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-500" />
              <CardTitle className="text-base">CSV/Excel Import</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Upload spreadsheet files with column mapping
            </CardDescription>
            <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base">System Migration</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Import from other construction software
            </CardDescription>
            <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
