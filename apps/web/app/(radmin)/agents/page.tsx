"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Activity, CheckCircle2, AlertCircle } from "lucide-react";

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">AI Agents</h1>
        <p className="text-muted-foreground mt-1">
          Monitor AI agent tasks, review outputs, and manage automations
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm">Active Tasks</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <CardDescription className="text-xs">Currently running</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <CardTitle className="text-sm">Completed Today</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <CardDescription className="text-xs">Successfully processed</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <CardTitle className="text-sm">Failed</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <CardDescription className="text-xs">Needs attention</CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agent Task Queue</CardTitle>
              <CardDescription>Monitor and manage AI agent tasks</CardDescription>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 border border-dashed text-muted-foreground">
            <div className="text-center">
              <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Agent monitoring dashboard will be integrated here</p>
              <p className="text-xs mt-1">View task queue, logs, and AI outputs</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
