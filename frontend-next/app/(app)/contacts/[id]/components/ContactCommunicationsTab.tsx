"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Phone, Mail, Calendar, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import type { Contact } from "../types";

// =============================================================================
// SSoT: Communications Tab (ROOT level)
// =============================================================================
// Shows communication history for this contact including:
// - Phone calls, emails, meetings, notes
// Visibility: Always visible
// =============================================================================

interface Communication {
  id: number;
  type: "call" | "email" | "meeting" | "note";
  subject: string;
  description: string | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
  };
}

interface ContactCommunicationsTabProps {
  contact: Contact;
}

export function ContactCommunicationsTab({ contact }: ContactCommunicationsTabProps) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCommunications();
  }, [contact.id]);

  const loadCommunications = async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with actual API endpoint when available
      const response = await api.get<{ communications: Communication[] }>(
        `/api/v1/contacts/${contact.id}/communications`
      );
      if (response?.communications) {
        setCommunications(response.communications);
      }
    } catch (err) {
      // API may not exist yet - show empty state
      console.log("Communications API not available yet");
      setCommunications([]);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "meeting":
        return <Calendar className="h-4 w-4" />;
      case "note":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "call":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "email":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "meeting":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case "note":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Communications
          {communications.length > 0 && (
            <Badge variant="secondary">{communications.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {communications.length > 0 ? (
          <div className="space-y-4">
            {communications.map((comm) => (
              <div
                key={comm.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getTypeBadgeColor(comm.type)}>
                      {getTypeIcon(comm.type)}
                      <span className="ml-1 capitalize">{comm.type}</span>
                    </Badge>
                    <span className="font-medium">{comm.subject}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comm.created_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {comm.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {comm.description}
                  </p>
                )}
                {comm.user && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    {comm.user.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 space-y-2">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No communications recorded for this contact.
            </p>
            <p className="text-sm text-muted-foreground">
              Communication history will appear here when available.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ContactCommunicationsTab;
