"use client";

// Leaflet CSS - imported here rather than globally for better code-splitting
import "leaflet/dist/leaflet.css";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MapPin,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { DEBOUNCE_SEARCH_MS } from "@/lib/constants/timeout-constants";

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

// Draggable marker component for edit mode
const DraggableMarker = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      const { Marker, useMap } = mod;
      return function DraggableMarkerInner({
        position,
        onDragEnd,
      }: {
        position: [number, number];
        onDragEnd: (pos: [number, number]) => void;
      }) {
        const map = useMap();
        return (
          <Marker
            position={position}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                onDragEnd([pos.lat, pos.lng]);
                map.panTo(pos);
              },
            }}
          />
        );
      };
    }),
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

interface SuburbSearchResult {
  id: number;
  name: string;
  postcode: string;
  state: string;
  council: string | null;
}

// Helper to format address for job title
const formatAddressForTitle = (
  lotNumber: string,
  streetNumber: string,
  streetName: string,
  streetType: string,
  suburb: string,
  state: string
): string => {
  const parts: string[] = [];

  // Handle lot and street numbers
  if (lotNumber && streetNumber) {
    parts.push(`Lot ${lotNumber} (${streetNumber})`);
  } else if (lotNumber) {
    parts.push(`Lot ${lotNumber}`);
  } else if (streetNumber) {
    parts.push(streetNumber);
  }

  // Street name and type
  const street = [streetName, streetType].filter(Boolean).join(" ");
  if (street) {
    parts.push(street);
  }

  if (suburb) {
    parts.push(suburb);
  }

  if (state) {
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
  lotNumber,
  streetNumber,
  streetName,
  streetType,
  suburb,
  postcode,
  state,
  council,
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
  const [dialogOpen, setDialogOpen] = useState(false);

  // Address form state - all fields editable
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [formLotNumber, setFormLotNumber] = useState("");
  const [formStreetNumber, setFormStreetNumber] = useState("");
  const [formStreetName, setFormStreetName] = useState("");
  const [formStreetType, setFormStreetType] = useState("");
  const [formSuburb, setFormSuburb] = useState("");
  const [formPostcode, setFormPostcode] = useState("");
  const [formState, setFormState] = useState("");
  const [formCouncil, setFormCouncil] = useState("");
  const [originalLocation, setOriginalLocation] = useState("");

  // Suburb search state
  const [suburbSearchQuery, setSuburbSearchQuery] = useState("");
  const [suburbSearchResults, setSuburbSearchResults] = useState<SuburbSearchResult[]>([]);
  const [suburbSearchLoading, setSuburbSearchLoading] = useState(false);
  const [showSuburbDropdown, setShowSuburbDropdown] = useState(false);
  const suburbInputRef = useRef<HTMLInputElement>(null);
  const suburbDropdownRef = useRef<HTMLDivElement>(null);

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

    // SSoT: Uses DEBOUNCE_SEARCH_MS from timeout-constants.ts
    searchTimeoutRef.current = setTimeout(() => {
      searchForAddress(searchAddress);
    }, DEBOUNCE_SEARCH_MS);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchAddress]);

  // Debounced suburb search
  useEffect(() => {
    const searchSuburbs = async () => {
      if (suburbSearchQuery.length < 2) {
        setSuburbSearchResults([]);
        return;
      }

      setSuburbSearchLoading(true);
      try {
        const response = await api.get<{ suburbs: SuburbSearchResult[] }>(
          `/api/v1/suburbs/search?q=${encodeURIComponent(suburbSearchQuery)}`
        );
        setSuburbSearchResults(response.suburbs || []);
      } catch (error) {
        console.error("Failed to search suburbs:", error);
        setSuburbSearchResults([]);
      } finally {
        setSuburbSearchLoading(false);
      }
    };

    // SSoT: Uses DEBOUNCE_SEARCH_MS from timeout-constants.ts
    const timeoutId = setTimeout(searchSuburbs, DEBOUNCE_SEARCH_MS);
    return () => clearTimeout(timeoutId);
  }, [suburbSearchQuery]);

  // Close suburb dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suburbDropdownRef.current &&
        !suburbDropdownRef.current.contains(event.target as Node) &&
        suburbInputRef.current &&
        !suburbInputRef.current.contains(event.target as Node)
      ) {
        setShowSuburbDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchForAddress = async (query: string) => {
    setSearching(true);
    try {
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

  // Geocode from form fields to find coordinates
  const [geocoding, setGeocoding] = useState(false);

  const geocodeFromFormFields = async () => {
    // Build full search query from form fields
    const fullParts: string[] = [];
    if (formStreetNumber) fullParts.push(formStreetNumber);
    if (formStreetName) {
      const street = [formStreetName, formStreetType].filter(Boolean).join(" ");
      fullParts.push(street);
    }
    if (formSuburb) fullParts.push(formSuburb);
    if (formState) fullParts.push(formState);

    const fullQuery = fullParts.join(", ");

    // Build suburb-only fallback query
    const suburbParts: string[] = [];
    if (formSuburb) suburbParts.push(formSuburb);
    if (formState) suburbParts.push(formState);
    const suburbQuery = suburbParts.join(", ");

    if (!fullQuery || fullQuery.length < 3) {
      setError("Please enter at least a suburb to find on map");
      return;
    }

    setGeocoding(true);
    setError(null);

    try {
      // First try with full address
      const data = await api.get<{ suggestions: AddressSuggestion[] }>(
        `/api/v1/geocode/search?q=${encodeURIComponent(fullQuery)}`
      );
      const suggestions = data?.suggestions || [];

      if (suggestions.length > 0) {
        const [lon, lat] = suggestions[0].center;
        const newPosition: [number, number] = [lat, lon];
        setTempPosition(newPosition);
        setMapPosition(newPosition);
      } else if (suburbQuery && suburbQuery !== fullQuery) {
        // Fall back to suburb-only search
        const suburbData = await api.get<{ suggestions: AddressSuggestion[] }>(
          `/api/v1/geocode/search?q=${encodeURIComponent(suburbQuery)}`
        );
        const suburbSuggestions = suburbData?.suggestions || [];

        if (suburbSuggestions.length > 0) {
          const [lon, lat] = suburbSuggestions[0].center;
          const newPosition: [number, number] = [lat, lon];
          setTempPosition(newPosition);
          setMapPosition(newPosition);
          setError("Exact address not found. Showing suburb location - adjust pin as needed.");
        } else {
          setError("Could not find location. Please place pin manually on the map.");
        }
      } else {
        setError("Could not find location. Please place pin manually on the map.");
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
      setError("Failed to find location. Please place pin manually on the map.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    const [lon, lat] = suggestion.center;
    const newPosition: [number, number] = [lat, lon];
    setTempPosition(newPosition);
    setMapPosition(newPosition);
    setShowSuggestions(false);
    setError(null);

    // Parse address components
    const addr = suggestion.address || {};
    let suburb = addr.suburb || "";
    let state = addr.state || "";
    let postcode = addr.postcode || "";

    // Try to extract suburb, state, postcode from placeName if not available
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
          // Try to extract postcode
          const postcodeMatch = locationPart.match(/\d{4}/);
          if (postcodeMatch && !postcode) {
            postcode = postcodeMatch[0];
          }
        } else if (!suburb) {
          // Just use the location part without postcode
          const postcodeMatch = locationPart.match(/\d{4}/);
          if (postcodeMatch) {
            postcode = postcodeMatch[0];
            suburb = locationPart.replace(/\d{4}/, "").trim();
          } else {
            suburb = locationPart;
          }
        }
      }
      // If still no suburb, try first part of placeName
      if (!suburb && parts.length >= 1) {
        // First part might be "Tingalpa, Queensland..." for suburb searches
        const firstPart = parts[0];
        if (!firstPart.match(/^\d/)) { // Doesn't start with a number
          suburb = firstPart;
        }
      }
    }

    // Pre-fill form with extracted data
    // houseNumber from geocoder goes to Street Number, not Lot Number
    // Lot Number is for lot/plan numbers which users enter manually
    setFormLotNumber("");
    setFormStreetNumber(addr.houseNumber || "");
    setFormStreetName(addr.streetName || "");
    setFormStreetType(addr.streetType || "");
    setFormSuburb(suburb);
    setFormPostcode(postcode);
    setFormState(state);
    setOriginalLocation(suggestion.placeName);
    setSearchAddress("");

    // Show the editable form
    setShowAddressForm(true);
  };

  const handleEditClick = async () => {
    setIsEditMode(true);
    setTempPosition(mapPosition);
    setSearchAddress("");

    // Check if we have existing job address data OR coordinates
    const hasExistingData = lotNumber || streetNumber || streetName || suburb;
    const hasCoordinates = latitude && longitude;

    if (hasExistingData || hasCoordinates) {
      // Pre-fill form with existing job data
      setFormLotNumber(lotNumber || "");
      setFormStreetNumber(streetNumber || "");
      setFormStreetName(streetName || "");
      setFormStreetType(streetType || "");
      setFormSuburb(suburb || "");
      setFormPostcode(postcode || "");
      setFormState(state || "");
      setOriginalLocation(location || "");
      setSuburbSearchQuery("");
      setSuburbSearchResults([]);
      setShowSuburbDropdown(false);
      setShowAddressForm(true);

      // SSoT: Look up council from suburbs table based on SUBURB NAME (not postcode)
      // Important: Same postcode can have different councils (e.g., Rochedale South = Logan, Rochedale = Brisbane)
      if (suburb) {
        try {
          // Search by suburb name, not postcode
          const response = await api.get<{ suburbs: SuburbSearchResult[] }>(
            `/api/v1/suburbs/search?q=${encodeURIComponent(suburb)}`
          );
          const suburbs = response.suburbs || [];
          // Match by suburb name only (exact, case-insensitive)
          const match = suburbs.find(
            (s) => s.name.toLowerCase() === suburb.toLowerCase()
          );
          if (match?.council) {
            setFormCouncil(match.council);
          } else {
            setFormCouncil("");
          }
        } catch (err) {
          console.error("Failed to lookup council from suburbs:", err);
          setFormCouncil("");
        }
      } else {
        setFormCouncil("");
      }
    } else {
      // No existing data, show search form
      setShowAddressForm(false);
      resetForm();
    }

    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormLotNumber("");
    setFormStreetNumber("");
    setFormStreetName("");
    setFormStreetType("");
    setFormSuburb("");
    setFormPostcode("");
    setFormState("");
    setFormCouncil("");
    setOriginalLocation("");
    setSuburbSearchQuery("");
    setSuburbSearchResults([]);
    setShowSuburbDropdown(false);
  };

  const handleSuburbSelect = async (suburb: SuburbSearchResult) => {
    console.log("Suburb selected:", suburb);
    console.log("Setting postcode to:", suburb.postcode);
    console.log("Setting state to:", suburb.state);
    console.log("Setting council to:", suburb.council);
    setFormSuburb(suburb.name);
    setFormPostcode(suburb.postcode);
    setFormState(suburb.state);
    setFormCouncil(suburb.council || "");
    setSuburbSearchQuery("");
    setShowSuburbDropdown(false);

    // Auto-geocode to center map on the suburb/address
    // Build search query from current form fields + new suburb
    const searchParts: string[] = [];
    if (formStreetNumber) searchParts.push(formStreetNumber);
    if (formStreetName) {
      const street = [formStreetName, formStreetType].filter(Boolean).join(" ");
      searchParts.push(street);
    }
    searchParts.push(suburb.name);
    searchParts.push(suburb.state);

    const searchQuery = searchParts.join(", ");

    if (searchQuery.length >= 3) {
      setGeocoding(true);
      setError(null);
      try {
        const data = await api.get<{ suggestions: AddressSuggestion[] }>(
          `/api/v1/geocode/search?q=${encodeURIComponent(searchQuery)}`
        );
        const suggestions = data?.suggestions || [];

        if (suggestions.length > 0) {
          const [lon, lat] = suggestions[0].center;
          const newPosition: [number, number] = [lat, lon];
          setTempPosition(newPosition);
          setMapPosition(newPosition);
        } else {
          // Fall back to suburb-only search
          const suburbQuery = `${suburb.name}, ${suburb.state}`;
          const suburbData = await api.get<{ suggestions: AddressSuggestion[] }>(
            `/api/v1/geocode/search?q=${encodeURIComponent(suburbQuery)}`
          );
          const suburbSuggestions = suburbData?.suggestions || [];

          if (suburbSuggestions.length > 0) {
            const [lon, lat] = suburbSuggestions[0].center;
            const newPosition: [number, number] = [lat, lon];
            setTempPosition(newPosition);
            setMapPosition(newPosition);
          }
        }
      } catch (err) {
        console.error("Auto-geocoding failed:", err);
      } finally {
        setGeocoding(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setTempPosition(null);
    setError(null);
    setSearchAddress("");
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setDialogOpen(false);
    setShowAddressForm(false);
    resetForm();
  };

  // Get preview title from current form values
  const getPreviewTitle = () => {
    return formatAddressForTitle(
      formLotNumber.trim(),
      formStreetNumber.trim(),
      formStreetName.trim(),
      formStreetType.trim(),
      formSuburb.trim(),
      formState.trim()
    );
  };

  const handleSave = async () => {
    if (!tempPosition) {
      setError("Please select a location on the map");
      return;
    }

    // Check if this is just a pin move on existing job (has original location and all address fields)
    const hasExistingAddress = originalLocation && (formLotNumber || formStreetNumber) && formStreetName && formSuburb;

    // Validate required fields only if no existing complete address
    if (!hasExistingAddress) {
      if (!formLotNumber.trim() && !formStreetNumber.trim()) {
        setError("Please enter a lot number or street number");
        return;
      }

      if (!formStreetName.trim()) {
        setError("Please enter a street name");
        return;
      }

      if (!formSuburb.trim()) {
        setError("Please enter a suburb");
        return;
      }
    }

    setSaving(true);
    try {
      const newTitle = getPreviewTitle();

      await api.patch(`/api/v1/jobs/${jobId}`, {
        job: {
          latitude: tempPosition[0],
          longitude: tempPosition[1],
          location: originalLocation || newTitle,
          lot_number: formLotNumber.trim() || null,
          street_number: formStreetNumber.trim() || null,
          street_name: formStreetName.trim() || null,
          street_type: formStreetType.trim() || null,
          suburb: formSuburb.trim() || null,
          postcode: formPostcode.trim() || null,
          state: formState.trim() || null,
          council: formCouncil.trim() || null,
        },
      });

      const savedPosition = tempPosition;

      setMapPosition(savedPosition);
      setIsEditMode(false);
      setTempPosition(null);
      setError(null);
      setDialogOpen(false);
      setShowAddressForm(false);
      resetForm();

      if (onLocationUpdate) {
        onLocationUpdate({
          latitude: savedPosition[0],
          longitude: savedPosition[1],
          location: originalLocation || newTitle,
          lot_number: formLotNumber.trim() || undefined,
          street_number: formStreetNumber.trim() || undefined,
          street_name: formStreetName.trim() || undefined,
          street_type: formStreetType.trim() || undefined,
          suburb: formSuburb.trim() || undefined,
          postcode: formPostcode.trim() || undefined,
          state: formState.trim() || undefined,
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
            <Spinner size={32} className="text-muted-foreground" />
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
            <MapPin className={`h-5 w-5 ${hasNoLocation ? "text-muted-foreground" : "text-green-600 dark:text-green-400"}`} />
            <CardTitle className="text-base">Job Location</CardTitle>
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
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {hasNoLocation ? "Add Job Location" : "Edit Job Location"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
            {/* Left Panel - Search & Form */}
            <div className="w-[350px] flex-shrink-0 overflow-y-auto space-y-4 pr-2">
              {/* Address Search - hide when form is showing */}
              {!showAddressForm && (
                <>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Search for an address or click on the map to place a pin.
                    </p>
                  </div>

                  <div className="relative">
                    <Label htmlFor="address-search">Search Address or Suburb</Label>
                    <Input
                      id="address-search"
                      value={searchAddress}
                      onChange={(e) => setSearchAddress(e.target.value)}
                      placeholder="e.g., Tingalpa, 123 Main St"
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

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowAddressForm(true)}
                  >
                    Skip Search &amp; Enter Manually
                  </Button>
                </>
              )}

              {/* Address Form - shown after selecting a location */}
              {showAddressForm && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Address Details</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddressForm(false);
                        resetForm();
                      }}
                    >
                      Search Again
                    </Button>
                  </div>

                  {/* Preview Title */}
                  {(formLotNumber || formStreetNumber) && formStreetName && formSuburb && (
                    <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-xs text-muted-foreground">Job title:</p>
                      <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                        {getPreviewTitle()}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Lot Number</Label>
                      <Input
                        value={formLotNumber}
                        onChange={(e) => setFormLotNumber(e.target.value)}
                        placeholder="e.g., 123"
                        className="mt-1 h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Street Number</Label>
                      <Input
                        value={formStreetNumber}
                        onChange={(e) => setFormStreetNumber(e.target.value)}
                        placeholder="e.g., 45"
                        className="mt-1 h-8"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Street Name <span className="text-red-500 dark:text-red-400">*</span></Label>
                      <Input
                        value={formStreetName}
                        onChange={(e) => setFormStreetName(e.target.value)}
                        placeholder="e.g., Fleming"
                        className="mt-1 h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Street Type</Label>
                      <Input
                        value={formStreetType}
                        onChange={(e) => setFormStreetType(e.target.value)}
                        placeholder="e.g., Road"
                        className="mt-1 h-8"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <Label className="text-xs">Suburb <span className="text-red-500 dark:text-red-400">*</span></Label>
                    <Input
                      ref={suburbInputRef}
                      value={suburbSearchQuery || formSuburb}
                      onChange={(e) => {
                        setSuburbSearchQuery(e.target.value);
                        setShowSuburbDropdown(true);
                        setFormSuburb(e.target.value);
                      }}
                      onFocus={() => {
                        if (suburbSearchQuery.length >= 2 || formSuburb.length >= 2) {
                          setShowSuburbDropdown(true);
                        }
                      }}
                      placeholder="Search suburb..."
                      autoComplete="off"
                      className="mt-1 h-8"
                    />
                    {showSuburbDropdown && (suburbSearchResults.length > 0 || suburbSearchLoading) && (
                      <div
                        ref={suburbDropdownRef}
                        className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto"
                      >
                        {suburbSearchLoading ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">
                            <Spinner size={16} className="inline mr-2" />
                            Searching...
                          </div>
                        ) : (
                          suburbSearchResults.map((suburb) => (
                            <button
                              key={suburb.id}
                              type="button"
                              onClick={() => handleSuburbSelect(suburb)}
                              className="w-full px-2 py-1.5 text-left hover:bg-muted flex items-center justify-between text-sm"
                            >
                              <span>
                                <span className="font-medium">{suburb.name}</span>
                                <span className="text-muted-foreground ml-1">{suburb.postcode}</span>
                              </span>
                              <span className="text-xs text-muted-foreground">{suburb.state}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">State</Label>
                      <Input
                        value={formState}
                        readOnly
                        placeholder="Auto"
                        className="mt-1 h-8 bg-muted/50 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Postcode</Label>
                      <Input
                        value={formPostcode}
                        readOnly
                        placeholder="Auto"
                        className="mt-1 h-8 bg-muted/50 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Council</Label>
                      <Input
                        value={formCouncil}
                        readOnly
                        placeholder="Auto"
                        className="mt-1 h-8 bg-muted/50 text-xs"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={geocodeFromFormFields}
                    disabled={geocoding || (!formSuburb && !formStreetName)}
                  >
                    {geocoding ? (
                      <>
                        <Spinner size={16} className="mr-2" />
                        Finding...
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 mr-2" />
                        Find on Map
                      </>
                    )}
                  </Button>
                </div>
              )}

              {error && (
                <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
                </div>
              )}
            </div>

            {/* Right Panel - Map (takes remaining space) */}
            <div className="flex-1 flex flex-col min-h-0 rounded-lg overflow-hidden border">
              {displayPosition ? (
                <>
                  <MapContainer
                    center={displayPosition}
                    zoom={15}
                    style={{ height: "100%", width: "100%", flex: 1 }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <DraggableMarker
                      position={displayPosition}
                      onDragEnd={(pos) => setTempPosition(pos)}
                    />
                    <MapClickHandler onMapClick={(pos) => setTempPosition(pos)} />
                  </MapContainer>
                  <div className="bg-muted px-4 py-2 flex items-center justify-between shrink-0">
                    <p className="text-xs text-muted-foreground">
                      Drag the pin or click on the map to move it
                    </p>
                    {tempPosition && typeof tempPosition[0] === 'number' && typeof tempPosition[1] === 'number' && (
                      <p className="text-xs text-muted-foreground">
                        {tempPosition[0].toFixed(6)}, {tempPosition[1].toFixed(6)}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <MapContainer
                  center={DEFAULT_POSITION}
                  zoom={10}
                  style={{ height: "100%", width: "100%", flex: 1 }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapClickHandler onMapClick={(pos) => {
                    setTempPosition(pos);
                    setShowAddressForm(true);
                  }} />
                </MapContainer>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !tempPosition || !showAddressForm}
            >
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