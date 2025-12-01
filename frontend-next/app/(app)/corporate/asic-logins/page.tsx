"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Key } from "lucide-react";

export default function AsicLoginsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight font-serif">ASIC Logins</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage ASIC login credentials for companies
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Key className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">ASIC Logins management coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
