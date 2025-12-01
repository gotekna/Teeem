"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function MinuteTemplatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight font-serif">Minute Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage meeting minute templates
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Minute Templates coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
