"use client";

// Leaflet CSS - imported here rather than globally for better code-splitting
import "leaflet/dist/leaflet.css";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { MapPin, Check } from "lucide-react";
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

interface LocationMapSelectorProps {
  latitude?: number | null;
  longitude?: number | null;
  initialSearchAddress?: string;
  onLocationChange?: (data: {
    location?: string;
    latitude?: number;
    longitude?: number;
    name?: string;
    lotNumber?: string;
    streetNumber?: string;
    streetName?: string;
    streetType?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
  }) => void;
}

interface AddressSuggestion {
  id: string;
  placeName: string;
  center: [number, number]; // [longitude, latitude]
  address: {
    houseNumber: string;
    street: string;
    streetName: string;
    streetType: string;
    suburb: string;
    state: string;
    postcode: string;
  };
}

export function LocationMapSelector({
  latitude,
  longitude,
  initialSearchAddress,
  onLocationChange,
}: LocationMapSelectorProps) {
  const [mapPosition, setMapPosition] = useState<[number, number]>([-27.4698, 153.0251]); // Brisbane default
  const [searchAddress, setSearchAddress] = useState(initialSearchAddress || "");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const shouldAutoSelectRef = useRef(!!initialSearchAddress);
  const skipNextSearchRef = useRef(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Update map position when props change
  useEffect(() => {
    if (latitude && longitude) {
      setMapPosition([latitude, longitude]);
    }
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
    // Skip search if we just selected an address (prevents re-triggering dropdown)
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    setSearching(true);
    try {
      const data = await api.get<{ suggestions: AddressSuggestion[] }>(
        `/api/v1/geocode/search?q=${encodeURIComponent(query)}`
      );
      const suggestions = data?.suggestions || [];

      // If shouldAutoSelect is true (initial load from proposal), auto-select first result
      if (shouldAutoSelectRef.current && suggestions.length > 0) {
        shouldAutoSelectRef.current = false;
        skipNextSearchRef.current = true; // Skip the search that will be triggered by setSearchAddress
        handleAddressSelect(suggestions[0]);
      } else {
        setAddressSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      }
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
    const addr = suggestion.address || {};

    setMapPosition(newPosition);
    skipNextSearchRef.current = true; // Skip re-search when address changes
    setSearchAddress(suggestion.placeName);
    setShowSuggestions(false);
    setAddressSuggestions([]); // Clear suggestions

    // Notify parent component with all address components
    if (onLocationChange) {
      onLocationChange({
        location: suggestion.placeName,
        latitude: lat,
        longitude: lon,
        name: suggestion.placeName,
        lotNumber: "",
        streetNumber: addr.houseNumber || "",
        streetName: addr.streetName || addr.street || "",
        streetType: addr.streetType || "",
        suburb: addr.suburb || "",
        postcode: addr.postcode || "",
        state: addr.state || "",
      });
    }
  };

  if (!leafletReady) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Address Search */}
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
          <Spinner size={16} className="absolute right-3 top-9 text-muted-foreground" />
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

      {/* Map */}
      <div className="rounded-lg overflow-hidden border">
        <MapContainer
          center={mapPosition}
          zoom={15}
          style={{ height: "300px", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={mapPosition} />
          <MapRecenter position={mapPosition} />
          <MapClickHandler
            onMapClick={(pos) => {
              setMapPosition(pos);
              if (onLocationChange) {
                onLocationChange({
                  latitude: pos[0],
                  longitude: pos[1],
                });
              }
            }}
          />
        </MapContainer>
        <div className="bg-muted px-4 py-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Click on the map to place the pin</p>
          {mapPosition && (
            <p className="text-xs text-muted-foreground">
              {mapPosition[0].toFixed(6)}, {mapPosition[1].toFixed(6)}
            </p>
          )}
        </div>
      </div>

      {latitude && longitude && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" />
          <span>Location pin set</span>
        </div>
      )}
    </div>
  );
}

// Component to recenter map when position changes
function MapRecenter({ position }: { position: [number, number] }) {
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

  return <MapRecenterInner pos={position} />;
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

export default LocationMapSelector;
