"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  BookOpen,
  TrendingUp,
  Building2,
  FileText,
  PiggyBank,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";

export default function GlPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/financial">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">TEEEM GL</h1>
          <p className="text-muted-foreground">General Ledger & Accounting System</p>
        </div>
      </div>

      {/* Coming Soon Banner */}
      <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0">
        <CardContent className="py-8">
          <div className="flex items-center gap-4">
            <Calculator className="h-12 w-12" />
            <div>
              <h2 className="text-2xl font-bold">TEEEM Accounting System</h2>
              <p className="text-indigo-100">
                A complete double-entry accounting system built into TEEEM
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              Chart of Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Synced from Xero. All your accounts in one place with proper categorization.
            </p>
            <Button variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Journal Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Every transaction converted to proper double-entry journal entries.
            </p>
            <Button variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Financial Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              P&L, Balance Sheet, Trial Balance - generated instantly from local data.
            </p>
            <Button variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-amber-600" />
              Bank Reconciliation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Running balances and smart matching for quick bank reconciliation.
            </p>
            <Button variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              Job Costing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Track actual costs vs budget for every job, directly from accounting data.
            </p>
            <Button variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-red-600" />
              BAS Preparation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              GST calculations, BAS reports ready to lodge with the ATO.
            </p>
            <Button variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>Development Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Database Schema</span>
              <span className="text-green-600 font-medium">Complete</span>
            </div>
            <div className="flex items-center justify-between">
              <span>GL Models</span>
              <span className="text-green-600 font-medium">Complete</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Xero Account Sync</span>
              <span className="text-yellow-600 font-medium">In Progress</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Journal Entry Engine</span>
              <span className="text-muted-foreground">Planned</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Balance Calculator</span>
              <span className="text-muted-foreground">Planned</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Reports UI</span>
              <span className="text-muted-foreground">Planned</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
