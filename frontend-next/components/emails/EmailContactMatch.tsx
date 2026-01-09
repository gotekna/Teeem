"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  UserPlus,
  User,
  X,
  Search,
  Building2,
  Mail,
  Phone,
  Star,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ContactInfo {
  id: number;
  display_name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  avatar_url?: string;
}

interface EmailContactMatchProps {
  emailId: number;
  primaryContact?: ContactInfo | null;
  contacts?: ContactInfo[];
  onContactsChanged?: () => void;
  className?: string;
}

export function EmailContactMatch({
  emailId,
  primaryContact,
  contacts = [],
  onContactsChanged,
  className,
}: EmailContactMatchProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ContactInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContactInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkedIds, setLinkedIds] = useState<number[]>(contacts.map(c => c.id));

  // Fetch suggestions when popover opens
  useEffect(() => {
    if (open && suggestions.length === 0) {
      fetchSuggestions();
    }
  }, [open]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: {
          suggestions: ContactInfo[];
          email_addresses: string[];
          already_linked: number[];
        };
      }>(`/api/v1/email_warehouse/${emailId}/suggest_contacts`);

      if (response.success && response.data) {
        setSuggestions(response.data.suggestions);
        setLinkedIds(response.data.already_linked);
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchContacts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: ContactInfo[];
      }>(`/api/v1/contacts/search?q=${encodeURIComponent(query)}&limit=10`);

      if (response.success && response.data) {
        setSearchResults(response.data);
      }
    } catch (error) {
      console.error("Failed to search contacts:", error);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchContacts(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchContacts]);

  const linkContact = async (contactId: number, setPrimary = false) => {
    try {
      await api.post(`/api/v1/email_warehouse/${emailId}/link_contact`, {
        contact_id: contactId,
        set_primary: setPrimary,
      });

      setLinkedIds(prev => [...prev, contactId]);
      onContactsChanged?.();
    } catch (error) {
      console.error("Failed to link contact:", error);
    }
  };

  const unlinkContact = async (contactId: number) => {
    try {
      await api.post(`/api/v1/email_warehouse/${emailId}/unlink_contact`, {
        contact_id: contactId,
      });

      setLinkedIds(prev => prev.filter(id => id !== contactId));
      onContactsChanged?.();
    } catch (error) {
      console.error("Failed to unlink contact:", error);
    }
  };

  const displayContacts = searchQuery ? searchResults : suggestions;
  const hasLinkedContacts = contacts.length > 0;

  return (
    <div className={cn("", className)}>
      {/* Linked Contacts Display */}
      {hasLinkedContacts ? (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary contact */}
          {primaryContact && (
            <Link href={`/contacts/${primaryContact.id}`}>
              <Badge
                variant="secondary"
                className="gap-1.5 cursor-pointer hover:bg-secondary/80 transition-colors"
              >
                <Star className="h-3 w-3 text-yellow-500" />
                <User className="h-3 w-3" />
                <span>{primaryContact.display_name}</span>
                <ChevronRight className="h-3 w-3 opacity-50" />
              </Badge>
            </Link>
          )}

          {/* Other contacts */}
          {contacts
            .filter(c => c.id !== primaryContact?.id)
            .map(contact => (
              <Link key={contact.id} href={`/contacts/${contact.id}`}>
                <Badge
                  variant="outline"
                  className="gap-1 cursor-pointer hover:bg-muted transition-colors"
                >
                  <User className="h-3 w-3" />
                  <span>{contact.display_name}</span>
                  <ChevronRight className="h-3 w-3 opacity-50" />
                </Badge>
              </Link>
            ))}

          {/* Add more button */}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 gap-1">
                <UserPlus className="h-3 w-3" />
                <span className="text-xs">Link</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <ContactSearchContent
                loading={loading}
                searching={searching}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                displayContacts={displayContacts}
                linkedIds={linkedIds}
                onLink={linkContact}
                onUnlink={unlinkContact}
              />
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        /* No contacts - show link button */
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Link to Contact
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <ContactSearchContent
              loading={loading}
              searching={searching}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              displayContacts={displayContacts}
              linkedIds={linkedIds}
              onLink={linkContact}
              onUnlink={unlinkContact}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// Extracted search content component
function ContactSearchContent({
  loading,
  searching,
  searchQuery,
  setSearchQuery,
  displayContacts,
  linkedIds,
  onLink,
  onUnlink,
}: {
  loading: boolean;
  searching: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  displayContacts: ContactInfo[];
  linkedIds: number[];
  onLink: (id: number, setPrimary?: boolean) => void;
  onUnlink: (id: number) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Results */}
      <div className="max-h-64 overflow-auto">
        {loading || searching ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-5 w-5" />
          </div>
        ) : displayContacts.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {searchQuery ? "No contacts found" : "No suggestions available"}
          </div>
        ) : (
          <div className="py-1">
            {!searchQuery && displayContacts.length > 0 && (
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Suggested Contacts
              </div>
            )}
            {displayContacts.map(contact => {
              const isLinked = linkedIds.includes(contact.id);
              return (
                <div
                  key={contact.id}
                  className={cn(
                    "flex items-center justify-between px-2 py-2 hover:bg-muted/50 cursor-pointer",
                    isLinked && "bg-primary/5"
                  )}
                  onClick={() => !isLinked && onLink(contact.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {contact.display_name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {contact.email && (
                          <span className="flex items-center gap-0.5 truncate">
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </span>
                        )}
                        {contact.company_name && (
                          <span className="flex items-center gap-0.5 truncate">
                            <Building2 className="h-3 w-3" />
                            {contact.company_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isLinked ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnlink(contact.id);
                      }}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLink(contact.id, true);
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export type { ContactInfo };
