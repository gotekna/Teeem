"use client";

import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { LiveWorkerMap } from "@/components/site-presence/LiveWorkerMap";

export default function LiveTrackingPage() {
  return (
    <div className="flex flex-col h-full -mx-4 -mt-4">
      <div className="px-6 py-4 border-b bg-background">
        <h1 className="text-2xl font-semibold">Live Worker Tracking</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time GPS locations of field workers currently checked in
        </p>
      </div>

      <div className="flex-1 p-4">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <Spinner size={32} />
            </div>
          }
        >
          <LiveWorkerMap height="calc(100vh - 200px)" showAlerts={true} />
        </Suspense>
      </div>
    </div>
  );
}
