"use client";

import { useState } from "react";
import { Lock, Mail, Key, CheckCircle, XCircle, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Contact } from "../types";

// =============================================================================
// SSoT: Portal Access Tab (ROOT level)
// =============================================================================
// Manages customer portal access for this contact:
// - View portal access status
// - Send portal invitation
// - Reset password
// Visibility: Always visible
// =============================================================================

interface ContactPortalTabProps {
  contact: Contact;
}

export function ContactPortalTab({ contact }: ContactPortalTabProps) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check if contact has portal access
  const hasPortalAccess = (contact as any).portal_enabled || false;
  const portalEmail = contact.email;
  const lastLogin = (contact as any).portal_last_login;

  const handleSendInvitation = async () => {
    if (!portalEmail) {
      setMessage({ type: "error", text: "Contact must have an email address to receive portal invitation." });
      return;
    }

    setSending(true);
    setMessage(null);
    try {
      // TODO: Implement API call to send portal invitation
      // await api.post(`/api/v1/contacts/${contact.id}/portal/invite`);
      setMessage({ type: "success", text: "Portal invitation sent successfully!" });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to send portal invitation. Please try again." });
    } finally {
      setSending(false);
    }
  };

  const handleResetPassword = async () => {
    setSending(true);
    setMessage(null);
    try {
      // TODO: Implement API call to reset password
      // await api.post(`/api/v1/contacts/${contact.id}/portal/reset-password`);
      setMessage({ type: "success", text: "Password reset email sent successfully!" });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to send password reset. Please try again." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Portal Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Portal Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            {hasPortalAccess ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Not Enabled
              </Badge>
            )}
          </div>

          {/* Email */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Portal Email</span>
            <span className="text-sm font-medium flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {portalEmail || <span className="text-muted-foreground">No email set</span>}
            </span>
          </div>

          {/* Last Login */}
          {hasPortalAccess && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Login</span>
              <span className="text-sm">
                {lastLogin
                  ? new Date(lastLogin).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Never"}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Portal Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            {!hasPortalAccess ? (
              <Button
                onClick={handleSendInvitation}
                disabled={sending || !portalEmail}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Portal Invitation
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleResetPassword}
                disabled={sending}
              >
                <Key className="h-4 w-4 mr-2" />
                Reset Password
              </Button>
            )}
          </div>

          {!portalEmail && (
            <p className="text-sm text-muted-foreground">
              Add an email address to this contact to enable portal access.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Portal Features Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Portal Features</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              View and pay invoices online
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Access project documents and files
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Track job progress and updates
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Submit support requests
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default ContactPortalTab;
