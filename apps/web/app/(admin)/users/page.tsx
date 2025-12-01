"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage users, invitations, and team members
          </p>
        </div>
        <Button disabled>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>View and manage all users in the organization</CardDescription>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 border border-dashed text-muted-foreground">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">User management table will be integrated here</p>
              <p className="text-xs mt-1">Invite, edit, and manage user access</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
