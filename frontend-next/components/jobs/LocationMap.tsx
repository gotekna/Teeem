"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MapPin, Pencil, Check, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

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

interface LocationMapProps {
  jobId: string | number;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  onLocationUpdate?: (data: {
    location?: string;
    latitude?: number;
    longitude?: number;
    title?: string;
  }) => void;
}

interface AddressSuggestion {
  id: string;
  placeName: string;
  center: [number, number]; // [longitude, latitude]
  address: {
    houseNumber: string;
    street: string;
    suburb: string;
    state: string;
    postcode: string;
  };
}

export function LocationMap({
  jobId,
  location,
  latitude,
  longitude,
  onLocationUpdate,
}: LocationMapProps) {
  const [mapPosition, setMapPosition] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempPosition, setTempPosition] = useState<[number, number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchAddress, setSearchAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Default to Brisbane if no location
  const DEFAULT_POSITION: [number, number] = [-27.4698, 153.0251];

  // Initialize leaflet icon fix on client side only
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("leaflet").then((L) => {
        delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        });
        setLeafletReady(true);
      });
    }
  }, []);

  // Set map position from props
  useEffect(() => {
    if (latitude && longitude) {
      setMapPosition([latitude, longitude]);
    } else {
      setMapPosition(DEFAULT_POSITION);
    }
    setLoading(false);
  }, [latitude, longitude]);

  // Debounced address search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchAddress.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchForAddress(searchAddress);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchAddress]);

  const searchForAddress = async (query: string) => {
    setSearching(true);
    try {
      // Use backend proxy to Mapbox (avoids CORS issues and protects API key)
      const data = await api.get<{ suggestions: AddressSuggestion[] }>(`/api/v1/geocode/search?q=${encodeURIComponent(query)}`);
      const suggestions = data?.suggestions || [];

      setAddressSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (err) {
      console.error("Address search failed:", err);
      setAddressSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSearching(false);
    }
  };

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    const [lon, lat] = suggestion.center;
    const newPosition: [number, number] = [lat, lon];
    setTempPosition(newPosition);
    setMapPosition(newPosition);
    setSearchAddress(suggestion.placeName);
    setShowSuggestions(false);
    setError(null);
  };

  const [dialogOpen, setDialogOpen] = useState(false);

  const handleEditClick = () => {
    setIsEditMode(true);
    setTempPosition(mapPosition);
    setSearchAddress("");
    setDialogOpen(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setTempPosition(null);
    setError(null);
    setSearchAddress("");
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setDialogOpen(false);
  };

  const handleSave = async () => {
    if (!tempPosition) {
      setError("Please select a location");
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/api/v1/jobs/${jobId}`, {
        job: {
          latitude: tempPosition[0],
          longitude: tempPosition[1],
          location: searchAddress || location,
        },
      });

      // Save values before resetting state
      const savedPosition = tempPosition;
      const savedLocation = searchAddress || location || undefined;

      setMapPosition(savedPosition);
      setIsEditMode(false);
      setTempPosition(null);
      setError(null);
      setDialogOpen(false);

      if (onLocationUpdate) {
        onLocationUpdate({
          latitude: savedPosition[0],
          longitude: savedPosition[1],
          location: savedLocation,
        });
      }
    } catch (err) {
      console.error("Error saving location:", err);
      setError("Failed to save location. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const displayPosition = isEditMode && tempPosition ? tempPosition : mapPosition;
  const hasNoLocation = !location && !latitude && !longitude;

  if (loading || !leafletReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Job Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <MapPin className={`h-5 w-5 ${hasNoLocation ? "text-muted-foreground" : "text-green-600"}`} />
            <div>
              <CardTitle className="text-base">Job Location</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {location || "No location set"}
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleEditClick}>
            <Pencil className="h-4 w-4 mr-2" />
            {hasNoLocation ? "Add Pin" : "Edit Pin"}
          </Button>
        </CardHeader>

        <CardContent>
          {displayPosition && !isEditMode && (
            <div className="rounded-lg overflow-hidden border">
              <MapContainer
                center={displayPosition}
                zoom={15}
                style={{ height: "200px", width: "100%" }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={displayPosition} />
              </MapContainer>
              {latitude && longitude && (
                <div className="bg-muted px-4 py-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Click and drag to explore</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Location Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) handleCancelEdit();
      }}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {hasNoLocation ? "Add Job Location" : "Edit Job Location"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Search for an address below, then click on the map to adjust the pin position.
              </p>
            </div>

            <div className="relative">
              <Label htmlFor="address-search">Search Address</Label>
              <Input
                id="address-search"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                placeholder="e.g., 123 Main Street, Brisbane"
                className="mt-1"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin text-muted-foreground" />
              )}

              {showSuggestions && addressSuggestions.length > 0 && (
                <div className="absolute z-[9999] w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {addressSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleAddressSelect(suggestion)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      {suggestion.placeName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
              </div>
            )}

            {displayPosition && (
              <div className="rounded-lg overflow-hidden border">
                <MapContainer
                  center={displayPosition}
                  zoom={15}
                  style={{ height: "50vh", minHeight: "400px", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={displayPosition} />
                  <MapClickHandler onMapClick={(pos) => setTempPosition(pos)} />
                </MapContainer>
                <div className="bg-muted px-4 py-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Click on the map to place the pin
                  </p>
                  {tempPosition && typeof tempPosition[0] === 'number' && typeof tempPosition[1] === 'number' && (
                    <p className="text-xs text-muted-foreground">
                      {tempPosition[0].toFixed(6)}, {tempPosition[1].toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !tempPosition}>
              <Check className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Component to handle map clicks
function MapClickHandler({ onMapClick }: { onMapClick: (pos: [number, number]) => void }) {
  const MapClickHandlerInner = dynamic(
    () =>
      import("react-leaflet").then((mod) => {
        const { useMapEvents } = mod;
        return function ClickHandler() {
          useMapEvents({
            click(e) {
              onMapClick([e.latlng.lat, e.latlng.lng]);
            },
          });
          return null;
        };
      }),
    { ssr: false }
  );

  return <MapClickHandlerInner />;
}

export default LocationMap;
