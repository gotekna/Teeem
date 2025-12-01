"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function AssetsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight font-serif">Assets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage company assets and equipment
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Assets management coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
