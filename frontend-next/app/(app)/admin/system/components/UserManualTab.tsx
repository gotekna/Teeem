"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ExternalLink } from "lucide-react";
import Link from "next/link";

/**
 * UserManualTab - Simple redirect to /docs
 *
 * SSoT: Documentation lives in TEEEM_DOCS/TEEEM_USER_MANUAL.md
 * API: /api/v1/documentation/user-manual serves the content
 * UI: /docs page renders all documentation including user manual
 *
 * This tab was simplified to eliminate duplicate documentation UI.
 * All documentation is now accessed through the unified /docs page.
 */
export function UserManualTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">User Manual</h2>
        <p className="text-sm text-muted-foreground">
          Access the TEEEM user documentation.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BookOpen className="h-16 w-16 mb-6 opacity-50" />
          <h3 className="text-lg font-medium mb-2 text-foreground">
            Documentation Portal
          </h3>
          <p className="text-center max-w-md mb-6">
            The TEEEM User Manual is available in the Documentation Portal along with
            the Bible, Teacher, and Lexicon developer guides.
          </p>

          <div className="flex gap-4">
            <Link href="/docs" target="_blank">
              <Button>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Documentation
              </Button>
            </Link>
            <Link href="/docs?doc=user-manual" target="_blank">
              <Button variant="outline">
                <BookOpen className="h-4 w-4 mr-2" />
                User Manual Direct
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
            Documentation System
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
            All documentation is maintained in the <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">TEEEM_DOCS/</code> folder
            and served through the unified documentation API.
          </p>
          <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
            <p><strong>SSoT:</strong> TEEEM_DOCS/TEEEM_USER_MANUAL.md</p>
            <p><strong>API:</strong> /api/v1/documentation/user-manual</p>
            <p><strong>UI:</strong> /docs page</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
