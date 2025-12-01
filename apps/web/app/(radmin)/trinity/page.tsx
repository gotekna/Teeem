"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, BookMarked, GraduationCap, Library } from "lucide-react";

export default function TrinityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Trinity Documentation</h1>
        <p className="text-muted-foreground mt-1">
          Bible, Teacher, and Lexicon - the knowledge management system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookMarked className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base">Bible</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Core documentation and system specifications
            </CardDescription>
            <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-green-500" />
              <CardTitle className="text-base">Teacher</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Training materials and how-to guides
            </CardDescription>
            <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Library className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-base">Lexicon</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Terminology, definitions, and glossary
            </CardDescription>
            <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
