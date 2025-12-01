"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";

export default function HealthReportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight font-serif">Health Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View company data health and compliance status
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Heart className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Health Report coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
