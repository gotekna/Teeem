"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Build and manage automated workflows, triggers, and actions
          </p>
        </div>
        <Button disabled>
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workflow Builder</CardTitle>
              <CardDescription>Create automated workflows with triggers and actions</CardDescription>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 border border-dashed text-muted-foreground">
            <div className="text-center">
              <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Workflow builder will be integrated here</p>
              <p className="text-xs mt-1">Define triggers, conditions, and automated actions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
