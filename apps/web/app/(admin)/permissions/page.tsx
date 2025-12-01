"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Key } from "lucide-react";

export default function PermissionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Permissions</h1>
        <p className="text-muted-foreground mt-1">
          Configure role-based access control and table protection
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-base">Roles</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Define roles and their permissions
            </CardDescription>
            <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-500" />
              <CardTitle className="text-base">Table Protection</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Lock tables and restrict access
            </CardDescription>
            <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
