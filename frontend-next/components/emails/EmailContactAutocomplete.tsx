"use client";

import * as React from "react";
import { useMemo, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Search, X } from "lucide-react";
import type { EmailContact } from "@/lib/email-types";

interface EmailContactAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  contacts: EmailContact[];
  isLoading: boolean;
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  minSearchChars?: number;
}

export function EmailContactAutocomplete({
  value,
  onChange,
  contacts,
  isLoading,
  onSearch,
  placeholder = "",
  className,
  minSearchChars = 2,
}: EmailContactAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync input value with external value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Group contacts by company
  const groupedContacts = useMemo(() => {
    const groups: Record<string, EmailContact[]> = {};
    contacts.forEach((contact) => {
      const companyName = contact.primary_company?.name || "Other";
      if (!groups[companyName]) groups[companyName] = [];
      groups[companyName].push(contact);
    });
    return groups;
  }, [contacts]);

  // Flatten for keyboard navigation
  const flatContacts = useMemo(() => {
    return Object.values(groupedContacts).flat();
  }, [groupedContacts]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const items = listRef.current.querySelectorAll("[data-contact-item]");
      const highlightedItem = items[highlightedIndex] as HTMLElement;
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    if (newValue.length >= minSearchChars) {
      onSearch(newValue);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
    setHighlightedIndex(0);
  };

  const handleSelectContact = (contact: EmailContact) => {
    const email = contact.email || "";
    setInputValue(email);
    onChange(email);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setInputValue("");
    onChange("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" && flatContacts.length > 0) {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < flatContacts.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : flatContacts.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (flatContacts.length > 0 && highlightedIndex < flatContacts.length) {
          handleSelectContact(flatContacts[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  const handleFocus = () => {
    if (inputValue.length >= minSearchChars && contacts.length > 0) {
      setIsOpen(true);
    }
  };

  const showDropdown = isOpen && (isLoading || contacts.length > 0);

  // Track which index each contact is at for highlighting
  let globalIndex = 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={cn(
          "flex h-8 w-full bg-transparent px-0 text-sm outline-none",
          "placeholder:text-muted-foreground",
          className
        )}
      />

      {/* Icon: Clear or Search */}
      {inputValue ? (
        <X
          className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={handleClear}
        />
      ) : (
        <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 bg-background border rounded-md shadow-lg max-h-[300px] overflow-y-auto"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size={20} className="text-muted-foreground" />
            </div>
          ) : (
            Object.entries(groupedContacts).map(([companyName, companyContacts]) => (
              <div key={companyName}>
                {/* Company header */}
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                  {companyName}
                </div>
                {/* Contacts in this company */}
                {companyContacts.map((contact) => {
                  const currentIndex = globalIndex++;
                  const isHighlighted = currentIndex === highlightedIndex;

                  return (
                    <div
                      key={contact.id}
                      data-contact-item
                      className={cn(
                        "px-3 py-2 cursor-pointer",
                        isHighlighted ? "bg-accent" : "hover:bg-accent/50"
                      )}
                      onClick={() => handleSelectContact(contact)}
                      onMouseEnter={() => setHighlightedIndex(currentIndex)}
                    >
                      <div className="font-medium text-sm">{contact.display_name}</div>
                      {contact.email && (
                        <div className="text-xs text-muted-foreground">{contact.email}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}

          {/* Allow using typed value as custom email */}
          {!isLoading && contacts.length === 0 && inputValue.length >= minSearchChars && (
            <div
              className="px-3 py-2 cursor-pointer hover:bg-accent/50 text-sm"
              onClick={() => {
                onChange(inputValue);
                setIsOpen(false);
              }}
            >
              Use: <strong>{inputValue}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
