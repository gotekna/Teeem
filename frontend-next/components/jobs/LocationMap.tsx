"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  lotNumber?: string | null;
  streetNumber?: string | null;
  streetName?: string | null;
  streetType?: string | null;
  suburb?: string | null;
  postcode?: string | null;
  state?: string | null;
  council?: string | null;
  onLocationUpdate?: (data: {
    location?: string;
    latitude?: number;
    longitude?: number;
    lot_number?: string;
    street_number?: string;
    street_name?: string;
    street_type?: string;
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

interface PendingSaveData {
  location: string;
  latitude: number;
  longitude: number;
  street: string;
  streetName: string;
  streetType: string;
  suburb: string;
  state: string;
  postcode: string;
  lotNumber: string;
  streetNumber: string;
}

// Helper to format address for job title
// Format: "Lot 160 (33) Alperton Road Burbank QLD" or "Lot 160 Alperton Road Burbank QLD"
const formatAddressForTitle = (
  lotNumber: string,
  streetNumber: string,
  street: string,
  suburb: string,
  state: string
): string => {
  const parts: string[] = [];

  // Handle lot and street numbers
  if (lotNumber && streetNumber) {
    // Both: "Lot 160 (33)"
    parts.push(`Lot ${lotNumber} (${streetNumber})`);
  } else if (lotNumber) {
    // Just lot: "Lot 160"
    parts.push(`Lot ${lotNumber}`);
  } else if (streetNumber) {
    // Just street number: "33"
    parts.push(streetNumber);
  }

  // Only include street if provided
  if (street && street.trim()) {
    parts.push(street);
  }

  if (suburb) {
    parts.push(suburb);
  }

  if (state) {
    // Abbreviate state names
    const stateAbbr: Record<string, string> = {
      'Queensland': 'QLD',
      'New South Wales': 'NSW',
      'Victoria': 'VIC',
      'South Australia': 'SA',
      'Western Australia': 'WA',
      'Tasmania': 'TAS',
      'Northern Territory': 'NT',
      'Australian Capital Territory': 'ACT'
    };
    parts.push(stateAbbr[state] || state);
  }

  return parts.join(' ');
};

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

  // Lot number feature state
  const [showLotNumberPrompt, setShowLotNumberPrompt] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<PendingSaveData | null>(null);
  const [lotNumber, setLotNumber] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [extractedNumber, setExtractedNumber] = useState("");
  const [numberType, setNumberType] = useState<"lot" | "street">("lot");
  const [dialogOpen, setDialogOpen] = useState(false);

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

    // Parse address components
    const addr = suggestion.address || {};
    const houseNumber = addr.houseNumber || "";
    const street = addr.street || "";
    let suburb = addr.suburb || "";
    let state = addr.state || "";

    // Try to extract suburb and state from placeName if not available
    // Format: "5 Speargrass Drive, Logan Village Queensland 4207, Australia"
    if (!suburb || !state) {
      const parts = suggestion.placeName.split(",").map(p => p.trim());
      if (parts.length >= 2) {
        const locationPart = parts[1];
        const stateMatch = locationPart.match(/(Queensland|New South Wales|Victoria|South Australia|Western Australia|Tasmania|Northern Territory|Australian Capital Territory|QLD|NSW|VIC|SA|WA|TAS|NT|ACT)/i);
        if (stateMatch) {
          const stateIndex = locationPart.indexOf(stateMatch[0]);
          if (!suburb && stateIndex > 0) {
            suburb = locationPart.substring(0, stateIndex).trim();
          }
          if (!state) {
            state = stateMatch[0];
          }
        } else if (!suburb) {
          suburb = locationPart.replace(/\d{4}/, "").trim();
        }
      }
    }

    // Pre-fill street address if available
    if (street) {
      setStreetAddress(street);
    } else {
      setStreetAddress("");
    }

    // Extract and store the number for user to classify
    if (houseNumber) {
      setExtractedNumber(houseNumber);
      setNumberType("lot"); // Default to lot number
      setLotNumber(houseNumber);
      setStreetNumber("");
    } else {
      setExtractedNumber("");
      setLotNumber("");
      setStreetNumber("");
    }

    // Store pending save data
    setPendingSaveData({
      location: suggestion.placeName,
      latitude: lat,
      longitude: lon,
      street: street,
      streetName: addr.streetName || street,
      streetType: addr.streetType || "",
      suburb: suburb,
      state: state,
      postcode: addr.postcode || "",
      lotNumber: houseNumber,
      streetNumber: "",
    });

    // Show lot number prompt
    setShowLotNumberPrompt(true);
  };

  // Handle number type change (lot vs street)
  const handleNumberTypeChange = (type: "lot" | "street") => {
    setNumberType(type);
    if (extractedNumber) {
      if (type === "lot") {
        setLotNumber(extractedNumber);
        setStreetNumber("");
      } else {
        setStreetNumber(extractedNumber);
        setLotNumber("");
      }
    }
  };

  // Parse street address into name and type
  const parseStreetAddress = (street: string): { streetName: string; streetType: string } => {
    const streetTypeMap: Record<string, string> = {
      'street': 'Street', 'st': 'St',
      'road': 'Road', 'rd': 'Rd',
      'avenue': 'Avenue', 'ave': 'Ave',
      'court': 'Court', 'ct': 'Ct',
      'drive': 'Drive', 'dr': 'Dr',
      'lane': 'Lane', 'ln': 'Ln',
      'place': 'Place', 'pl': 'Pl',
      'crescent': 'Crescent', 'cres': 'Cres',
      'terrace': 'Terrace', 'tce': 'Tce',
      'circuit': 'Circuit', 'cct': 'Cct',
      'boulevard': 'Boulevard', 'blvd': 'Blvd',
      'parade': 'Parade',
      'way': 'Way',
      'close': 'Close',
      'grove': 'Grove',
      'highway': 'Highway', 'hwy': 'Hwy',
      'esplanade': 'Esplanade',
    };

    const streetLower = street.toLowerCase();
    for (const [type, displayType] of Object.entries(streetTypeMap)) {
      if (streetLower.endsWith(' ' + type)) {
        const name = street.slice(0, -(type.length + 1)).trim();
        return { streetName: name, streetType: displayType };
      }
    }
    return { streetName: street, streetType: '' };
  };

  // Handle lot number submission
  const handleLotNumberSubmit = () => {
    // Must have at least lot number OR street number
    if (!lotNumber.trim() && !streetNumber.trim()) {
      setError("Please enter either a lot number or street number");
      return;
    }

    // Street address is required
    const street = streetAddress.trim() || pendingSaveData?.street;
    if (!street) {
      setError("Please enter a street address");
      return;
    }

    // Validate that street includes a street type
    const streetTypes = [
      'street', 'st', 'road', 'rd', 'avenue', 'ave', 'court', 'ct',
      'drive', 'dr', 'lane', 'ln', 'place', 'pl', 'crescent', 'cres',
      'terrace', 'tce', 'circuit', 'cct', 'boulevard', 'blvd', 'parade',
      'way', 'close', 'grove', 'highway', 'hwy', 'esplanade'
    ];

    const streetLower = street.toLowerCase();
    const hasStreetType = streetTypes.some(type =>
      streetLower.endsWith(' ' + type) || streetLower.endsWith(type)
    );

    if (!hasStreetType) {
      setError('Please include the street type (e.g., "Main Street", "Main Road", "Main Court")');
      return;
    }

    if (!pendingSaveData) {
      setError("No pending address data");
      return;
    }

    // Parse the street address to extract name and type
    const { streetName: parsedStreetName, streetType: parsedStreetType } = parseStreetAddress(street);

    // Update pending save data with parsed street info
    setPendingSaveData({
      ...pendingSaveData,
      lotNumber: lotNumber.trim(),
      streetNumber: streetNumber.trim(),
      street: street,
      streetName: parsedStreetName,
      streetType: parsedStreetType,
    });

    // Close prompt
    setShowLotNumberPrompt(false);
    setError(null);
    setSearchAddress("");
    setAddressSuggestions([]);
    setShowSuggestions(false);
  };

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
    setShowLotNumberPrompt(false);
    setPendingSaveData(null);
    setLotNumber("");
    setStreetNumber("");
    setStreetAddress("");
    setExtractedNumber("");
    setNumberType("lot");
  };

  const handleSave = async () => {
    if (!tempPosition) {
      setError("Please select a location");
      return;
    }

    setSaving(true);
    try {
      let newTitle: string | undefined;
      let newLocation: string | undefined;

      // If we have pending save data with lot/street number, use formatted title
      if (pendingSaveData && (pendingSaveData.lotNumber || pendingSaveData.streetNumber)) {
        newTitle = formatAddressForTitle(
          pendingSaveData.lotNumber,
          pendingSaveData.streetNumber,
          pendingSaveData.street,
          pendingSaveData.suburb,
          pendingSaveData.state
        );
        newLocation = pendingSaveData.location;
      } else {
        // Fallback to search address or existing location
        newLocation = searchAddress || location || undefined;
        newTitle = newLocation;
      }

      await api.patch(`/api/v1/jobs/${jobId}`, {
        job: {
          latitude: tempPosition[0],
          longitude: tempPosition[1],
          location: newLocation,
          lot_number: pendingSaveData?.lotNumber || null,
          street_number: pendingSaveData?.streetNumber || null,
          street_name: pendingSaveData?.streetName || null,
          street_type: pendingSaveData?.streetType || null,
          suburb: pendingSaveData?.suburb || null,
          postcode: pendingSaveData?.postcode || null,
          state: pendingSaveData?.state || null,
        },
      });

      // Save values before resetting state
      const savedPosition = tempPosition;

      setMapPosition(savedPosition);
      setIsEditMode(false);
      setTempPosition(null);
      setError(null);
      setDialogOpen(false);
      setPendingSaveData(null);
      setLotNumber("");
      setStreetNumber("");
      setStreetAddress("");
      setExtractedNumber("");
      setNumberType("lot");

      if (onLocationUpdate) {
        onLocationUpdate({
          latitude: savedPosition[0],
          longitude: savedPosition[1],
          location: newLocation,
          lot_number: pendingSaveData?.lotNumber || undefined,
          street_number: pendingSaveData?.streetNumber || undefined,
          street_name: pendingSaveData?.streetName || undefined,
          street_type: pendingSaveData?.streetType || undefined,
          suburb: pendingSaveData?.suburb || undefined,
          postcode: pendingSaveData?.postcode || undefined,
          state: pendingSaveData?.state || undefined,
        });
      }
    } catch (err) {
      console.error("Error saving location:", err);
      setError("Failed to save location. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Get preview of formatted title
  const getPreviewTitle = () => {
    if (!pendingSaveData) return "";
    const street = streetAddress.trim() || pendingSaveData.street;
    return formatAddressForTitle(
      lotNumber.trim(),
      streetNumber.trim(),
      street,
      pendingSaveData.suburb,
      pendingSaveData.state
    );
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
      <Card className="h-full flex flex-col">
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

        <CardContent className="flex-1 flex flex-col">
          {displayPosition && !isEditMode && (
            <div className="rounded-lg overflow-hidden border flex-1 flex flex-col min-h-[250px]">
              <MapContainer
                center={displayPosition}
                zoom={15}
                style={{ height: "100%", width: "100%", minHeight: "200px", flex: 1 }}
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
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {hasNoLocation ? "Add Job Location" : "Edit Job Location"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Search for an address or suburb below. If the street doesn&apos;t exist yet (new estate), search for the suburb and manually enter the address details.
              </p>
            </div>

            {/* Address Search - hide when lot prompt is showing */}
            {!showLotNumberPrompt && (
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
            )}

            {/* Lot Number Prompt */}
            {showLotNumberPrompt && (
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg border-2 border-indigo-500 dark:border-indigo-400">
                <h4 className="text-base font-semibold mb-2">
                  Classify Address Number
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {extractedNumber ? (
                    <>We found the number <strong>{extractedNumber}</strong> in the address. Please choose whether this is a lot number or street number.</>
                  ) : (
                    <>Please enter either a lot number or street number, and the street address.</>
                  )}
                </p>

                <div className="space-y-4">
                  {/* Number Type Selector - only show if we extracted a number */}
                  {extractedNumber && (
                    <div className="p-3 bg-background rounded-lg">
                      <Label className="text-xs mb-2 block">
                        The number &quot;{extractedNumber}&quot; is a:
                      </Label>
                      <RadioGroup
                        value={numberType}
                        onValueChange={(value) => handleNumberTypeChange(value as "lot" | "street")}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="lot" id="lot" />
                          <Label htmlFor="lot" className="text-sm cursor-pointer">Lot Number</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="street" id="street" />
                          <Label htmlFor="street" className="text-sm cursor-pointer">Street Number</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  {/* Lot Number Field */}
                  <div>
                    <Label className="text-xs">
                      Lot Number {!extractedNumber && <span className="text-muted-foreground">(at least one required)</span>}
                    </Label>
                    <Input
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      placeholder="e.g., 123"
                      className="mt-1"
                    />
                  </div>

                  {/* Street Number Field */}
                  <div>
                    <Label className="text-xs">
                      Street Number {!extractedNumber && <span className="text-muted-foreground">(at least one required)</span>}
                    </Label>
                    <Input
                      value={streetNumber}
                      onChange={(e) => setStreetNumber(e.target.value)}
                      placeholder="e.g., 33"
                      className="mt-1"
                    />
                  </div>

                  {/* Street Address Field */}
                  <div>
                    <Label className="text-xs">
                      Street Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="e.g., Alperton Road, Main Street, Smith Court"
                      className="mt-1"
                    />
                  </div>

                  {/* Preview of job title */}
                  {pendingSaveData && (lotNumber.trim() || streetNumber.trim()) && streetAddress.trim() && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Job title will be:</p>
                      <p className="text-sm font-semibold">
                        {getPreviewTitle()}
                      </p>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowLotNumberPrompt(false);
                        setPendingSaveData(null);
                        setLotNumber("");
                        setStreetNumber("");
                        setStreetAddress("");
                        setExtractedNumber("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleLotNumberSubmit}
                      disabled={(!lotNumber.trim() && !streetNumber.trim()) || !streetAddress.trim()}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
              </div>
            )}

            {/* Show pending save info */}
            {pendingSaveData && !showLotNumberPrompt && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-xs text-muted-foreground mb-1">Job title will be:</p>
                <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                  {formatAddressForTitle(
                    pendingSaveData.lotNumber,
                    pendingSaveData.streetNumber,
                    pendingSaveData.street,
                    pendingSaveData.suburb,
                    pendingSaveData.state
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Click on the map to adjust pin position, then click Save.
                </p>
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
            <Button onClick={handleSave} disabled={saving || !tempPosition || showLotNumberPrompt}>
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
