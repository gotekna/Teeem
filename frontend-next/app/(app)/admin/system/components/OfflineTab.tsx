"use client";

/**
 * Offline Tab - Settings Page
 *
 * Instructions and guide for testing offline PWA functionality.
 * Also provides access to offline sync management.
 */

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Smartphone,
  Wifi,
  WifiOff,
  Camera,
  FileText,
  Calendar,
  Download,
  CheckCircle2,
  Cloud,
  CloudOff,
  RefreshCw,
  Zap,
  TestTube,
  BookOpen,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OfflineSyncManager } from "@/components/offline";
import { useIsOnline } from "@/lib/offline";

export function OfflineTab() {
  const isOnline = useIsOnline();
  const [showSyncManager, setShowSyncManager] = React.useState(false);

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card className={cn(
        "border-2",
        isOnline ? "border-green-200 bg-green-50/50 dark:bg-green-950/20" : "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20"
      )}>
        <CardContent className="flex items-center gap-4 py-4">
          {isOnline ? (
            <>
              <Cloud className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div>
                <div className="font-semibold text-green-700 dark:text-green-400">You are Online</div>
                <div className="text-sm text-green-600 dark:text-green-400">All features available. Data syncing normally.</div>
              </div>
            </>
          ) : (
            <>
              <CloudOff className="h-8 w-8 text-amber-600" />
              <div>
                <div className="font-semibold text-amber-700 dark:text-amber-400">You are Offline</div>
                <div className="text-sm text-amber-600 dark:text-amber-500">Using cached data. Changes will sync when back online.</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* What is Offline Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            What is Offline Mode?
          </CardTitle>
          <CardDescription>
            TEEEM works even without internet connection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            TEEEM is a Progressive Web App (PWA) that can be installed on your phone, tablet, or computer.
            Once installed, you can access key features even when you have no internet connection - perfect for
            construction sites with poor connectivity.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <div className="font-medium text-sm">Gantt Schedules</div>
                <div className="text-xs text-muted-foreground">View job schedules offline</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
              <div>
                <div className="font-medium text-sm">Documents</div>
                <div className="text-xs text-muted-foreground">Access synced PDFs & files</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Camera className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <div className="font-medium text-sm">Photo Capture</div>
                <div className="text-xs text-muted-foreground">Take photos that auto-sync</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How to Install */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            How to Install TEEEM as an App
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* iPhone/iPad */}
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">iPhone / iPad</Badge>
              </div>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">1</span>
                  <span>Open TEEEM in <strong>Safari</strong> (required)</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">2</span>
                  <span>Tap the <strong>Share</strong> button (box with arrow)</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">3</span>
                  <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">4</span>
                  <span>Tap <strong>Add</strong> in the top right</span>
                </li>
              </ol>
            </div>

            {/* Android */}
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">Android</Badge>
              </div>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">1</span>
                  <span>Open TEEEM in <strong>Chrome</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">2</span>
                  <span>Tap the <strong>menu</strong> (3 dots) in top right</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">3</span>
                  <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">4</span>
                  <span>Tap <strong>Install</strong></span>
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How to Test Offline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            How to Test Offline Mode
          </CardTitle>
          <CardDescription>
            Step-by-step testing guide
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test 1: Gantt Offline */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 dark:bg-blue-900/50 dark:text-blue-300">Test 1</Badge>
              <span className="font-medium">Gantt Schedule Offline</span>
            </div>
            <ol className="space-y-2 text-sm ml-4">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Go to any Job → Schedule → Gantt</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Wait for "Synced" indicator in top right</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Turn on <strong>Airplane Mode</strong> on your device</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Refresh the page - Gantt should still load from cache</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Status should show "Offline • Last synced X mins ago"</span>
              </li>
            </ol>
          </div>

          <Separator />

          {/* Test 2: Documents Offline */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 dark:bg-purple-900/50 dark:text-purple-300">Test 2</Badge>
              <span className="font-medium">Documents Offline</span>
            </div>
            <ol className="space-y-2 text-sm ml-4">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Go to Portal → Offline tab (or click button below)</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Click <strong>Sync</strong> on a job to download its documents</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Wait for sync to complete (shows progress bar)</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Turn on <strong>Airplane Mode</strong></span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Go to that job's Documents tab - files should open from cache</span>
              </li>
            </ol>
            <Button variant="outline" size="sm" className="ml-4" onClick={() => setShowSyncManager(true)}>
              <Download className="h-4 w-4 mr-2" />
              Open Sync Manager
            </Button>
          </div>

          <Separator />

          {/* Test 3: Photo Capture */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/50 dark:text-green-300">Test 3</Badge>
              <span className="font-medium">Photo Capture Offline</span>
            </div>
            <ol className="space-y-2 text-sm ml-4">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Go to any Job → Field tab</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Select a task, then tap the <strong>Photos</strong> tab</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Turn on <strong>Airplane Mode</strong></span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Tap <strong>Open Camera</strong> and take a photo</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Photo saves locally with "Pending" badge</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>Turn off Airplane Mode - photo auto-syncs, badge changes to "Synced"</span>
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            <Button variant="outline" className="justify-start" asChild>
              <a href="/portal?tab=offline">
                <CloudOff className="h-4 w-4 mr-2" />
                Portal → Offline Sync
                <ArrowRight className="h-4 w-4 ml-auto" />
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href="/jobs">
                <Calendar className="h-4 w-4 mr-2" />
                Jobs → Select a Job → Field
                <ArrowRight className="h-4 w-4 ml-auto" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inline Sync Manager */}
      {showSyncManager && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Offline Sync Manager
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowSyncManager(false)}>
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <OfflineSyncManager />
          </CardContent>
        </Card>
      )}

      {/* Technical Details (collapsed) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Technical Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Storage:</strong> IndexedDB (browser storage, persists across sessions)</p>
            <p><strong>Gantt Cache TTL:</strong> 24 hours (auto-refreshes when online)</p>
            <p><strong>Document Cache TTL:</strong> 7 days</p>
            <p><strong>Photo Compression:</strong> JPEG, max 1920px, ~2MB per photo</p>
            <p><strong>Service Worker:</strong> Caches static assets for instant loading</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default OfflineTab;
