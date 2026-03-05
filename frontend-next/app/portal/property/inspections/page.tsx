"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { ChevronRight, Download, FileText, PenTool } from "lucide-react";

interface Inspection {
  id: number;
  inspection_type: string;
  inspection_number: string | null;
  status: string;
  scheduled_date: string;
  completed_date: string | null;
  overall_condition: string | null;
  inspector: string | null;
  property: { id: number; name: string; address: string };
  has_report: boolean;
  signed_by_tenant: boolean;
  signed_by_inspector: boolean;
}

function portalFetch(path: string) {
  const baseUrl = getApiBaseUrl();
  const token = getStorageItem<string>(STORAGE_KEYS.PORTAL_TOKEN, "");
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then((r) => r.json());
}

const conditionColors: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  good: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  fair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  poor: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  damaged: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function InspectionsPage() {
  const router = useRouter();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalFetch("/api/v1/portal/property/inspections")
      .then((res) => { if (res.success) setInspections(res.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const upcoming = inspections.filter((i) => i.status === "scheduled" || i.status === "in_progress");
  const needsSignature = inspections.filter((i) => i.status === "completed" && !i.signed_by_tenant);
  const completed = inspections.filter((i) => i.status === "completed" && i.signed_by_tenant);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Inspections</h1>

      {/* Action Required */}
      {needsSignature.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader>
            <CardTitle className="text-amber-600 flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Signature Required ({needsSignature.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {needsSignature.map((inspection) => (
                <InspectionRow key={inspection.id} inspection={inspection} onView={() => router.push(`/portal/property/inspections/${inspection.id}`)} highlight />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Upcoming</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcoming.map((inspection) => (
                <InspectionRow key={inspection.id} inspection={inspection} onView={() => router.push(`/portal/property/inspections/${inspection.id}`)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed */}
      <Card>
        <CardHeader><CardTitle>Completed</CardTitle></CardHeader>
        <CardContent>
          {completed.length === 0 ? (
            <p className="text-muted-foreground text-sm">No completed inspections yet</p>
          ) : (
            <div className="space-y-3">
              {completed.map((inspection) => (
                <InspectionRow key={inspection.id} inspection={inspection} onView={() => router.push(`/portal/property/inspections/${inspection.id}`)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InspectionRow({ inspection, onView, highlight }: { inspection: Inspection; onView: () => void; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
        highlight ? "bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20" : "bg-muted/50 hover:bg-muted"
      }`}
      onClick={onView}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">
            {inspection.inspection_type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} Inspection
          </p>
          <Badge className={statusColors[inspection.status] || ""} variant="outline">
            {inspection.status.replace("_", " ")}
          </Badge>
          {inspection.overall_condition && (
            <Badge className={conditionColors[inspection.overall_condition] || ""} variant="outline">
              {inspection.overall_condition}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {formatDate(inspection.completed_date || inspection.scheduled_date)}
          {inspection.inspector && ` | Inspector: ${inspection.inspector}`}
          {inspection.inspection_number && ` | ${inspection.inspection_number}`}
        </p>
        <p className="text-xs text-muted-foreground">{inspection.property.address}</p>
      </div>
      <div className="flex items-center gap-2">
        {inspection.has_report && <FileText className="h-4 w-4 text-muted-foreground" />}
        {highlight && <Badge variant="destructive" className="text-xs">Sign</Badge>}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
