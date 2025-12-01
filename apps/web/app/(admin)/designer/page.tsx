"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Paintbrush, Layout, Menu, Sparkles } from "lucide-react";

export default function DesignerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Designer</h1>
        <p className="text-muted-foreground mt-1">
          Build custom pages, configure menus, and design user experiences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layout className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Pages</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Create and configure custom pages
            </CardDescription>
            <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Menu className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Menus</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Configure navigation and menu structure
            </CardDescription>
            <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Experiences</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Design user flows and interactions
            </CardDescription>
            <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
