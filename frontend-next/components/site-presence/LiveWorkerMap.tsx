"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import {
  MapPin,
  Users,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Route,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLocationWebSocket, type GeofenceEvent } from "@/hooks/useLocationWebSocket";
import { formatDistanceToNow } from "date-fns";
import type { Icon } from "leaflet";

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const Circle = dynamic(
  () => import("react-leaflet").then((mod) => mod.Circle),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);

// Types for API responses
interface ActiveWorker {
  worker_id: number;
  worker_name: string;
  session_id: number;
  job_id: number;
  job_name: string;
  latitude: number;
  longitude: number;
  within_geofence: boolean;
  distance_from_site?: number;
  checkin_at: string;
  last_ping_at: string;
}

interface JobSite {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

interface SessionPath {
  session_id: number;
  worker_name: string;
  job_name: string;
  points: Array<{
    latitude: number;
    longitude: number;
    recorded_at: string;
  }>;
}

interface LiveWorkerMapProps {
  /**
   * Job ID to filter workers - if provided, only shows workers for this job
   */
  jobId?: number;

  /**
   * Height of the map container
   */
  height?: string;

  /**
   * Whether to show the geofence alerts panel
   */
  showAlerts?: boolean;
}

export function LiveWorkerMap({
  jobId,
  height = "600px",
  showAlerts = true,
}: LiveWorkerMapProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [leafletReady, setLeafletReady] = useState(false);
  const [workers, setWorkers] = useState<Map<number, ActiveWorker>>(new Map());
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [selectedPath, setSelectedPath] = useState<SessionPath | null>(null);
  const [loadingPath, setLoadingPath] = useState(false);
  const [workerIcon, setWorkerIcon] = useState<Icon | null>(null);
  const [alertIcon, setAlertIcon] = useState<Icon | null>(null);

  // Brisbane default center
  const DEFAULT_CENTER: [number, number] = [-27.4698, 153.0251];

  // WebSocket for real-time updates
  const {
    isConnected,
    activeWorkers: wsWorkers,
    geofenceEvents,
  } = useLocationWebSocket({
    onGeofenceExit: (event) => {
      toast({
        title: "Geofence Alert",
        description: `${event.worker_name} left ${event.job_name} site (${event.distance_from_site}m away)`,
        variant: "destructive",
      });
    },
    onWorkerCheckin: (event) => {
      toast({
        title: "Worker Checked In",
        description: `${event.worker_name} checked in to ${event.job_name}`,
      });
    },
    onWorkerCheckout: (event) => {
      toast({
        title: "Worker Checked Out",
        description: `${event.worker_name} checked out from ${event.job_name}`,
      });
    },
  });

  // Initialize leaflet icons on client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("leaflet").then((L) => {
        delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        });

        // Custom worker marker (blue)
        const workerMarker = new L.Icon({
          iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });
        setWorkerIcon(workerMarker);

        // Alert marker (red) for workers outside geofence
        const alertMarker = new L.Icon({
          iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });
        setAlertIcon(alertMarker);

        setLeafletReady(true);
      });
    }
  }, []);

  // Load initial data
  useEffect(() => {
    loadActiveWorkers();
  }, [jobId]);

  // Merge WebSocket updates with initial data
  const mergedWorkers = useMemo(() => {
    const merged = new Map(workers);

    // Update with real-time WebSocket data
    wsWorkers.forEach((wsWorker, workerId) => {
      const existing = merged.get(workerId);
      if (existing) {
        merged.set(workerId, {
          ...existing,
          latitude: wsWorker.latitude,
          longitude: wsWorker.longitude,
          within_geofence: wsWorker.withinGeofence,
          distance_from_site: wsWorker.distanceFromSite,
          last_ping_at: wsWorker.recordedAt,
        });
      }
    });

    return merged;
  }, [workers, wsWorkers]);

  const loadActiveWorkers = async () => {
    setLoading(true);
    try {
      const url = jobId
        ? `/api/v1/location_tracking/active?job_id=${jobId}`
        : "/api/v1/location_tracking/active";

      const response = await api.get<{
        success: boolean;
        data: {
          workers: ActiveWorker[];
          job_sites: JobSite[];
        };
      }>(url);

      if (response.success) {
        const workerMap = new Map<number, ActiveWorker>();
        response.data.workers.forEach((w) => workerMap.set(w.worker_id, w));
        setWorkers(workerMap);
        setJobSites(response.data.job_sites || []);
      }
    } catch (error) {
      console.error("Failed to load active workers:", error);
      toast({
        title: "Error",
        description: "Failed to load worker locations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSessionPath = async (sessionId: number) => {
    setLoadingPath(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: SessionPath;
      }>(`/api/v1/location_tracking/session/${sessionId}/path`);

      if (response.success) {
        setSelectedPath(response.data);
      }
    } catch (error) {
      console.error("Failed to load session path:", error);
      toast({
        title: "Error",
        description: "Failed to load worker path",
        variant: "destructive",
      });
    } finally {
      setLoadingPath(false);
    }
  };

  // Calculate map center based on workers and job sites
  const mapCenter = useMemo(() => {
    const points: [number, number][] = [];

    mergedWorkers.forEach((w) => {
      if (w.latitude && w.longitude) {
        points.push([w.latitude, w.longitude]);
      }
    });

    jobSites.forEach((site) => {
      if (site.latitude && site.longitude) {
        points.push([site.latitude, site.longitude]);
      }
    });

    if (points.length === 0) return DEFAULT_CENTER;

    const avgLat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p[1], 0) / points.length;

    return [avgLat, avgLng] as [number, number];
  }, [mergedWorkers, jobSites]);

  // Count workers outside geofence
  const alertCount = useMemo(() => {
    let count = 0;
    mergedWorkers.forEach((w) => {
      if (!w.within_geofence) count++;
    });
    return count;
  }, [mergedWorkers]);

  if (!leafletReady || loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center" style={{ height }}>
          <Spinner size={32} className="text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Map */}
      <Card className="flex-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Live Worker Locations</CardTitle>
            <Badge variant={isConnected ? "default" : "secondary"} className="ml-2">
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" /> Live
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" /> Offline
                </>
              )}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {mergedWorkers.size} active
            </Badge>
            {alertCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {alertCount} off-site
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={loadActiveWorkers}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-b-lg overflow-hidden" style={{ height }}>
            <MapContainer
              center={mapCenter}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Job site geofence circles */}
              {jobSites.map((site) => (
                <Circle
                  key={site.id}
                  center={[site.latitude, site.longitude]}
                  radius={site.radius_meters}
                  pathOptions={{
                    color: "#3b82f6",
                    fillColor: "#3b82f6",
                    fillOpacity: 0.1,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>{site.name}</strong>
                      <br />
                      Radius: {site.radius_meters}m
                    </div>
                  </Popup>
                </Circle>
              ))}

              {/* Worker markers */}
              {Array.from(mergedWorkers.values()).map((worker) => (
                <Marker
                  key={worker.worker_id}
                  position={[worker.latitude, worker.longitude]}
                  icon={worker.within_geofence ? workerIcon || undefined : alertIcon || undefined}
                >
                  <Popup>
                    <div className="text-sm space-y-1">
                      <div className="font-semibold">{worker.worker_name}</div>
                      <div className="text-muted-foreground">{worker.job_name}</div>
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        Checked in {formatDistanceToNow(new Date(worker.checkin_at))} ago
                      </div>
                      {!worker.within_geofence && (
                        <Badge variant="destructive" className="text-xs">
                          {worker.distance_from_site}m from site
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => loadSessionPath(worker.session_id)}
                        disabled={loadingPath}
                      >
                        <Route className="h-3 w-3 mr-1" />
                        View Path
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Session path polyline */}
              {selectedPath && selectedPath.points.length > 1 && (
                <Polyline
                  positions={selectedPath.points.map((p) => [p.latitude, p.longitude] as [number, number])}
                  pathOptions={{
                    color: "#10b981",
                    weight: 3,
                    opacity: 0.8,
                  }}
                />
              )}

              <MapRecenter center={mapCenter} />
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Geofence Alerts Panel */}
      {showAlerts && (
        <Card className="w-80 flex-shrink-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-base">Geofence Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              {geofenceEvents.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No recent alerts
                </div>
              ) : (
                <div className="divide-y">
                  {geofenceEvents.map((event) => (
                    <div
                      key={event.event_id}
                      className={`p-3 ${
                        event.type === "geofence_exit"
                          ? "bg-red-50 dark:bg-red-950/20"
                          : "bg-green-50 dark:bg-green-950/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{event.worker_name}</span>
                        <Badge
                          variant={event.type === "geofence_exit" ? "destructive" : "default"}
                          className="text-xs"
                        >
                          {event.type === "geofence_exit" ? "Left Site" : "Returned"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {event.job_name}
                      </div>
                      {event.distance_from_site && (
                        <div className="text-xs text-muted-foreground">
                          {event.distance_from_site}m from site
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.detected_at))} ago
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Component to recenter map when center changes
function MapRecenter({ center }: { center: [number, number] }) {
  const MapRecenterInner = dynamic(
    () =>
      Promise.all([import("react-leaflet"), import("react")]).then(([mod, React]) => {
        const { useMap } = mod;
        return function Recenter({ pos }: { pos: [number, number] }) {
          const map = useMap();
          React.useEffect(() => {
            map.setView(pos, map.getZoom());
          }, [map, pos]);
          return null;
        };
      }),
    { ssr: false }
  );

  return <MapRecenterInner pos={center} />;
}

export default LiveWorkerMap;
