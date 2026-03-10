"use client";

import { useEffect, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import {
  inspectionDataAtom,
  activeRoomIdAtom,
  inspectionDirtyAtom,
  completionPercentageAtom,
  type InspectionData,
  type InspectionPhoto,
} from "@/lib/inspection-atoms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/ui/back-button";
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Save,
  WifiOff,
  Wifi,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { InspectionRoomSidebar } from "@/components/inspections/InspectionRoomSidebar";
import { InspectionItemChecklist } from "@/components/inspections/InspectionItemChecklist";
import { InspectionProgressBar } from "@/components/inspections/InspectionProgressBar";

const TYPE_LABELS: Record<string, string> = {
  entry: "Entry Inspection",
  routine: "Routine Inspection",
  exit: "Exit Inspection",
  maintenance: "Maintenance Inspection",
  sda_compliance: "SDA Compliance Inspection",
};

export default function InspectionConductPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const propertyId = params.id as string;
  const inspectionId = Number(params.inspectionId);

  // Full-height layout for iPad experience
  useSetLayoutMode("full-height");

  const [data, setData] = useAtom(inspectionDataAtom);
  const setActiveRoomId = useSetAtom(activeRoomIdAtom);
  const dirty = useAtomValue(inspectionDirtyAtom);
  const completion = useAtomValue(completionPercentageAtom);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [annotatingPhoto, setAnnotatingPhoto] = useState<InspectionPhoto | null>(null);

  // Track online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const fetchInspection = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: InspectionData }>(
        `/api/v1/property_inspections/${inspectionId}`
      );
      if (res.success) {
        setData(res.data);
        // Auto-select first room if none selected
        if (res.data.inspection_rooms.length > 0) {
          setActiveRoomId(prev => prev || res.data.inspection_rooms[0].id);
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to load inspection", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [inspectionId, setData, setActiveRoomId, toast]);

  useEffect(() => {
    fetchInspection();
    // Cleanup atoms on unmount
    return () => {
      setData(null);
      setActiveRoomId(null);
    };
  }, [fetchInspection, setData, setActiveRoomId]);

  // Navigation warning if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleComplete = useCallback(async () => {
    if (completion < 100) {
      const confirmed = confirm(
        `Only ${completion}% of items are checked. Complete inspection anyway?`
      );
      if (!confirmed) return;
    }

    setCompleting(true);
    try {
      await api.patch(`/api/v1/property_inspections/${inspectionId}/complete`);
      toast({ title: "Inspection completed" });
      router.push(`/properties/${propertyId}/inspections`);
    } catch {
      toast({ title: "Error", description: "Failed to complete inspection", variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  }, [inspectionId, completion, propertyId, router, toast]);

  const handleGenerateReport = useCallback(async () => {
    try {
      await api.post(`/api/v1/property_inspections/${inspectionId}/generate_report`);
      toast({ title: "Report generation started" });
    } catch {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    }
  }, [inspectionId, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Inspection not found</p>
        <Button variant="outline" onClick={() => router.push(`/properties/${propertyId}/inspections`)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Inspections
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref={`/properties/${propertyId}/inspections`} />
          <div>
            <h1 className="text-sm font-semibold">
              {TYPE_LABELS[data.inspection_type] || data.inspection_type}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{data.property.property_code}</span>
              {data.inspection_number && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span className="font-mono">{data.inspection_number}</span>
                </>
              )}
              {data.inspector_contact && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span>{data.inspector_contact.display_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Online/Offline indicator */}
          {!isOnline && (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <WifiOff className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          )}

          {data.status === "completed" ? (
            <Button size="sm" variant="outline" onClick={handleGenerateReport}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Generate Report
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? (
                <Spinner className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              )}
              Complete Inspection
            </Button>
          )}
        </div>
      </div>

      {/* Main content: sidebar + checklist */}
      <div className="flex flex-1 min-h-0">
        {/* Room Sidebar */}
        <div className="w-[250px] shrink-0">
          <InspectionRoomSidebar
            inspectionId={inspectionId}
            onRoomAdded={fetchInspection}
          />
        </div>

        {/* Item Checklist */}
        <div className="flex-1 min-w-0">
          <InspectionItemChecklist
            inspectionId={inspectionId}
            inspectionType={data.inspection_type}
            onDataChanged={fetchInspection}
            onAnnotatePhoto={setAnnotatingPhoto}
          />
        </div>
      </div>

      {/* Progress bar */}
      <InspectionProgressBar />
    </div>
  );
}
