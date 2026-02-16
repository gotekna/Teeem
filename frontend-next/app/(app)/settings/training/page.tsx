"use client";

import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function TrainingSettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-16 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium text-lg mb-2">Training configuration coming soon</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Manage training modules, assign required courses, and track team progress. This feature is currently in development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
