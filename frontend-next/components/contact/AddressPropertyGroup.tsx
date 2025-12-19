"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Pencil, Check, X, MapPin } from "lucide-react";
import { api } from "@/lib/api";

export interface ContactAddress {
  id?: number;
  address_type: "STREET" | "POBOX" | "DELIVERY";
  line1: string;
  line2: string | null;
  line3: string | null;
  line4: string | null;
  city: string; // Suburb
  region: string; // State
  postal_code: string;
  country: string;
  attention_to: string | null;
  is_primary: boolean;
  _destroy?: boolean;
}

export interface AddressPropertyGroupProps {
  /** Contact ID for API calls */
  contactId: number;
  /** Current address (first STREET address or null) */
  address: ContactAddress | null;
  /** Save function that patches the contact with updated addresses */
  onSave: (address: ContactAddress) => Promise<void>;
  /** Custom class */
  className?: string;
}

interface SuburbResult {
  name: string;
  state: string;
  postcode: string;
}

const AUSTRALIAN_STATES = [
  { value: "ACT", label: "ACT" },
  { value: "NSW", label: "NSW" },
  { value: "NT", label: "NT" },
  { value: "QLD", label: "QLD" },
  { value: "SA", label: "SA" },
  { value: "TAS", label: "TAS" },
  { value: "VIC", label: "VIC" },
  { value: "WA", label: "WA" },
];

/**
 * AddressPropertyGroup - Address fields (street, suburb, state, postcode)
 */
export function AddressPropertyGroup({
  contactId,
  address,
  onSave,
  className,
}: AddressPropertyGroupProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ContactAddress>>({
    line1: address?.line1 || "",
    city: address?.city || "",
    region: address?.region || "",
    postal_code: address?.postal_code || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Suburb autocomplete state
  const [suburbSearch, setSuburbSearch] = useState(address?.city || "");
  const [suburbResults, setSuburbResults] = useState<SuburbResult[]>([]);
  const [showSuburbDropdown, setShowSuburbDropdown] = useState(false);
  const [searchingSuburbs, setSearchingSuburbs] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suburbInputRef = useRef<HTMLInputElement>(null);

  // Sync draft with address when address changes externally
  useEffect(() => {
    if (!isEditing) {
      setDraft({
        line1: address?.line1 || "",
        city: address?.city || "",
        region: address?.region || "",
        postal_code: address?.postal_code || "",
      });
      setSuburbSearch(address?.city || "");
    }
  }, [address, isEditing]);

  const searchSuburbs = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuburbResults([]);
      return;
    }

    setSearchingSuburbs(true);
    try {
      const response = await api.get<{ suburbs: SuburbResult[] }>(
        `/api/v1/suburbs/search?q=${encodeURIComponent(query)}`
      );
      setSuburbResults(response.suburbs || []);
    } catch {
      setSuburbResults([]);
    } finally {
      setSearchingSuburbs(false);
    }
  }, []);

  const handleSuburbSearchChange = useCallback(
    (value: string) => {
      setSuburbSearch(value);
      setDraft((prev) => ({ ...prev, city: value }));

      // Debounced search
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        searchSuburbs(value);
      }, 300);

      setShowSuburbDropdown(true);
    },
    [searchSuburbs]
  );

  const handleSuburbSelect = useCallback((suburb: SuburbResult) => {
    setSuburbSearch(suburb.name);
    setDraft((prev) => ({
      ...prev,
      city: suburb.name,
      region: suburb.state,
      postal_code: suburb.postcode,
    }));
    setSuburbResults([]);
    setShowSuburbDropdown(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      const updatedAddress: ContactAddress = {
        id: address?.id,
        address_type: address?.address_type || "STREET",
        line1: draft.line1 || "",
        line2: address?.line2 || null,
        line3: address?.line3 || null,
        line4: address?.line4 || null,
        city: draft.city || "",
        region: draft.region || "",
        postal_code: draft.postal_code || "",
        country: address?.country || "Australia",
        attention_to: address?.attention_to || null,
        is_primary: address?.is_primary ?? true,
      };

      await onSave(updatedAddress);
      setIsEditing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [address, draft, onSave]);

  const handleCancel = useCallback(() => {
    setDraft({
      line1: address?.line1 || "",
      city: address?.city || "",
      region: address?.region || "",
      postal_code: address?.postal_code || "",
    });
    setSuburbSearch(address?.city || "");
    setIsEditing(false);
    setError(null);
    setSuburbResults([]);
    setShowSuburbDropdown(false);
  }, [address]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleCancel]
  );

  // Format display address
  const displayAddress = (() => {
    const parts = [];
    if (address?.line1) parts.push(address.line1);
    if (address?.city) parts.push(address.city);
    if (address?.region) parts.push(address.region);
    if (address?.postal_code) parts.push(address.postal_code);
    return parts.join(", ");
  })();

  // Read mode
  if (!isEditing) {
    return (
      <div
        className={cn(
          "group py-2.5 px-3 -mx-3 rounded transition-all cursor-pointer hover:bg-muted/50",
          showSuccess && "bg-green-50 dark:bg-green-950/30",
          className
        )}
        onClick={() => setIsEditing(true)}
      >
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Address
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  "text-sm",
                  !displayAddress && "text-muted-foreground italic"
                )}
              >
                {displayAddress || "No address set"}
              </span>
              {showSuccess && (
                <Check className="h-4 w-4 text-green-500 shrink-0" />
              )}
            </div>
          </div>
          <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div
      className={cn(
        "py-3 px-3 -mx-3 bg-muted/30 rounded transition-colors space-y-3",
        error && "bg-red-50 dark:bg-red-950/30",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Address
          </span>
        </div>
        <div className="flex items-center gap-1">
          {saving && <Spinner className="h-4 w-4" />}
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Street */}
      <div>
        <label className="text-xs text-muted-foreground">Street Address</label>
        <Input
          value={draft.line1 || ""}
          onChange={(e) => setDraft((prev) => ({ ...prev, line1: e.target.value }))}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder="123 Main Street"
          disabled={saving}
          className="mt-1 h-9"
        />
      </div>

      {/* Suburb with autocomplete */}
      <div className="relative">
        <label className="text-xs text-muted-foreground">Suburb</label>
        <div className="relative mt-1">
          <Input
            ref={suburbInputRef}
            value={suburbSearch}
            onChange={(e) => handleSuburbSearchChange(e.target.value)}
            onFocus={() => setShowSuburbDropdown(true)}
            onBlur={() => {
              // Delay to allow click on dropdown
              setTimeout(() => {
                setShowSuburbDropdown(false);
                handleSave();
              }, 200);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Start typing suburb..."
            disabled={saving}
            className="h-9"
          />
          {searchingSuburbs && (
            <Spinner className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2" />
          )}
        </div>

        {/* Suburb dropdown */}
        {showSuburbDropdown && suburbResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
            {suburbResults.map((suburb, index) => (
              <button
                key={`${suburb.name}-${suburb.postcode}-${index}`}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSuburbSelect(suburb);
                }}
              >
                <span>{suburb.name}</span>
                <span className="text-muted-foreground">
                  {suburb.state} {suburb.postcode}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* State and Postcode in a row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">State</label>
          <Select
            value={draft.region || ""}
            onValueChange={(value) => {
              setDraft((prev) => ({ ...prev, region: value }));
              // Save after a short delay to allow blur to trigger first
              setTimeout(handleSave, 100);
            }}
            disabled={saving}
          >
            <SelectTrigger className="mt-1 h-9">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {AUSTRALIAN_STATES.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28">
          <label className="text-xs text-muted-foreground">Postcode</label>
          <Input
            value={draft.postal_code || ""}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, postal_code: e.target.value }))
            }
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder="0000"
            disabled={saving}
            className="mt-1 h-9"
            maxLength={4}
          />
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default AddressPropertyGroup;
