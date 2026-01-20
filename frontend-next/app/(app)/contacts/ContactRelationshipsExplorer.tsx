"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Search,
  Users,
  Building2,
  Briefcase,
  User,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

interface Contact {
  id: number;
  display_name: string;
  entity_type: string;
  email: string | null;
  mobile_phone: string | null;
}

interface ContactRelationship {
  id: number;
  source_contact_id: number;
  related_contact_id: number;
  relationship_type: string;
  relationship_type_label: string;
  is_active: boolean;
  ownership_percentage: number | null;
  start_date: string | null;
  end_date: string | null;
  other_contact: {
    id: number;
    name: string;
    entity_type: string;
    email: string | null;
    phone: string | null;
  };
}

interface ContactRelationshipsExplorerProps {
  initialContactId?: number;
}

export default function ContactRelationshipsExplorer({ initialContactId }: ContactRelationshipsExplorerProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [relationships, setRelationships] = useState<{
    outgoing: ContactRelationship[];
    incoming: ContactRelationship[];
  }>({ outgoing: [], incoming: [] });
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // Search for contacts
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await api.get<{ records: Contact[] }>(
        `/api/v1/foundations/contacts/records?search=${encodeURIComponent(searchQuery)}&per_page=10`
      );
      setSearchResults(response.records || []);
    } catch (error) {
      console.error("Failed to search contacts:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // Load relationships for selected contact
  const loadRelationships = useCallback(async (contactId: number) => {
    setLoading(true);
    try {
      const response = await api.get<{
        relationships: {
          outgoing: ContactRelationship[];
          incoming: ContactRelationship[];
        };
      }>(`/api/v1/contacts/${contactId}/relationships`);
      setRelationships(response.relationships);
    } catch (error) {
      console.error("Failed to load relationships:", error);
      setRelationships({ outgoing: [], incoming: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle contact selection
  const handleSelectContact = useCallback(
    (contact: Contact) => {
      setSelectedContact(contact);
      setSearchResults([]);
      setSearchQuery("");
      loadRelationships(contact.id);
    },
    [loadRelationships]
  );

  // Load initial contact if provided
  useEffect(() => {
    if (initialContactId) {
      // Load contact details
      api.get<Contact>(`/api/v1/contacts/${initialContactId}`).then((contact) => {
        setSelectedContact(contact);
        loadRelationships(initialContactId);
      });
    }
  }, [initialContactId, loadRelationships]);

  // Get entity type icon
  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "person":
        return <User className="h-4 w-4" />;
      case "company":
        return <Building2 className="h-4 w-4" />;
      case "trust":
        return <Briefcase className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  // Get entity type color
  const getEntityColor = (entityType: string) => {
    switch (entityType) {
      case "person":
        return "bg-blue-500";
      case "company":
        return "bg-green-500";
      case "trust":
        return "bg-purple-500";
      case "sole_trader":
        return "bg-amber-500";
      default:
        return "bg-muted0";
    }
  };

  // Get relationship category color
  const getRelationshipColor = (relationshipType: string) => {
    if (relationshipType.includes("employee") || relationshipType.includes("contractor")) {
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300";
    } else if (relationshipType.includes("director") || relationshipType.includes("shareholder")) {
      return "bg-status-success text-status-success-foreground border-green-300";
    } else if (relationshipType.includes("trustee") || relationshipType.includes("beneficiary")) {
      return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300";
    } else if (relationshipType.includes("family")) {
      return "bg-pink-100 text-pink-800 border-pink-300";
    }
    return "bg-muted text-foreground border-border";
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Contact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by name (e.g., Bunnings)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
              {searching ? <Spinner size={16} /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">Found {searchResults.length} results:</p>
              <ScrollArea className="h-[200px] border rounded-md p-2">
                {searchResults.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className="w-full text-left p-3 hover:bg-accent rounded-md flex items-center gap-3 transition-colors"
                  >
                    <div className={`p-2 rounded-full ${getEntityColor(contact.entity_type)}`}>
                      {getEntityIcon(contact.entity_type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{contact.display_name}</div>
                      <div className="text-sm text-muted-foreground capitalize">{contact.entity_type}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Contact & Relationships */}
      {selectedContact && (
        <div className="space-y-4">
          {/* Contact Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${getEntityColor(selectedContact.entity_type)}`}>
                  {getEntityIcon(selectedContact.entity_type)}
                </div>
                <div className="flex-1">
                  <CardTitle>{selectedContact.display_name}</CardTitle>
                  <p className="text-sm text-muted-foreground capitalize">{selectedContact.entity_type}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/contacts/${selectedContact.id}`)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Full Profile
                </Button>
              </div>
            </CardHeader>
          </Card>

          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center p-12">
                <Spinner size={32} className="text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Outgoing Relationships (This contact → Others) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Relationships ({relationships.outgoing.filter((r) => r.is_active).length})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedContact.display_name} is connected to these contacts
                  </p>
                </CardHeader>
                <CardContent>
                  {relationships.outgoing.filter((r) => r.is_active).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No active relationships found
                    </p>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {relationships.outgoing
                          .filter((r) => r.is_active)
                          .map((rel) => (
                            <div
                              key={rel.id}
                              className="border rounded-lg p-4 hover:bg-accent transition-colors cursor-pointer"
                              onClick={() => router.push(`/contacts/${rel.other_contact.id}`)}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-full ${getEntityColor(rel.other_contact.entity_type)}`}>
                                  {getEntityIcon(rel.other_contact.entity_type)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="font-medium">{rel.other_contact.name}</div>
                                      <div className="text-sm text-muted-foreground capitalize">
                                        {rel.other_contact.entity_type}
                                      </div>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={getRelationshipColor(rel.relationship_type)}
                                    >
                                      {rel.relationship_type_label}
                                      {rel.ownership_percentage && ` (${rel.ownership_percentage}%)`}
                                    </Badge>
                                  </div>
                                  {rel.start_date && (
                                    <div className="text-xs text-muted-foreground mt-2">
                                      Since: {new Date(rel.start_date).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Incoming Relationships (Others → This contact) */}
              {relationships.incoming.filter((r) => r.is_active).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Connected From ({relationships.incoming.filter((r) => r.is_active).length})
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      These contacts are connected to {selectedContact.display_name}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {relationships.incoming
                          .filter((r) => r.is_active)
                          .map((rel) => (
                            <div
                              key={rel.id}
                              className="border rounded-lg p-4 hover:bg-accent transition-colors cursor-pointer"
                              onClick={() => router.push(`/contacts/${rel.source_contact_id}`)}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-full ${getEntityColor(rel.other_contact.entity_type)}`}>
                                  {getEntityIcon(rel.other_contact.entity_type)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="font-medium">{rel.other_contact.name}</div>
                                      <div className="text-sm text-muted-foreground capitalize">
                                        {rel.other_contact.entity_type}
                                      </div>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={getRelationshipColor(rel.relationship_type)}
                                    >
                                      {rel.relationship_type_label}
                                      {rel.ownership_percentage && ` (${rel.ownership_percentage}%)`}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty State */}
      {!selectedContact && searchResults.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Search for a Contact</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Enter a contact name (like "Bunnings") to see all their relationships with other contacts
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
