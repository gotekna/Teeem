"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface AddressSuggestion {
  id: string;
  placeName: string;
  center: [number, number];
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

interface AddressSearchInputProps {
  value?: string;
  defaultValue?: string;
  onSelect: (address: string, suggestion?: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
  required?: boolean;
}

export function AddressSearchInput({
  value: controlledValue,
  defaultValue,
  onSelect,
  placeholder = "Search address...",
  className,
  inputClassName,
  id,
  required,
}: AddressSearchInputProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const value = isControlled ? controlledValue : internalValue;
  const setValue = isControlled
    ? (v: string) => onSelect(v)
    : setInternalValue;

  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const skipNextSearchRef = useRef(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search (300ms, same as Jobs)
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (value.length < 3 || skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.get<{ suggestions: AddressSuggestion[] }>(
          `/api/v1/geocode/search?q=${encodeURIComponent(value)}`
        );
        const results = data?.suggestions || [];
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [value]);

  const handleSelect = useCallback((suggestion: AddressSuggestion) => {
    skipNextSearchRef.current = true;
    if (!isControlled) {
      setInternalValue(suggestion.placeName);
    }
    setShowDropdown(false);
    setSuggestions([]);
    onSelect(suggestion.placeName, suggestion);
  }, [isControlled, onSelect]);

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <Input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          if (isControlled) {
            onSelect(e.target.value);
          } else {
            setInternalValue(e.target.value);
          }
        }}
        placeholder={placeholder}
        required={required}
        className={`pr-8 ${inputClassName || ""}`}
        onBlur={() => {
          // Save typed value after short delay (allows click on suggestion first)
          if (!isControlled) {
            setTimeout(() => {
              if (internalValue && internalValue !== defaultValue) {
                onSelect(internalValue);
              }
            }, 200);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setShowDropdown(false);
          }
        }}
      />
      {searching && (
        <Spinner size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
      )}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-[9999] w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
            >
              {s.placeName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
