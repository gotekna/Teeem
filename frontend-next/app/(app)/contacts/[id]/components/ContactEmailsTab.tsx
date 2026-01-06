"use client";

import { Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { EmailMessage, EmailsPagination } from "../types";

interface ContactEmailsTabProps {
  emails: EmailMessage[];
  loadingEmails: boolean;
  emailsPagination: EmailsPagination | null;
  emailsPage: number;
  showAllInThread: boolean;
  setShowAllInThread: (value: boolean) => void;
  loadEmails: (page: number) => void;
  contactEmail: string | null;
}

export function ContactEmailsTab({
  emails,
  loadingEmails,
  emailsPagination,
  emailsPage,
  showAllInThread,
  setShowAllInThread,
  loadEmails,
  contactEmail,
}: ContactEmailsTabProps) {
  // Handle row double-click to open email in standard email page
  const handleRowDoubleClick = (row: { id: string | number }) => {
    window.open(`/email?id=${row.id}`, '_blank');
  };

  // Determine which contact email address was used in each email
  const getContactEmailUsed = (email: EmailMessage): string | null => {
    if (!contactEmail) return null;
    const contactEmailLower = contactEmail.toLowerCase();

    // Check if contact sent the email
    if (email.from_email?.toLowerCase() === contactEmailLower) {
      return email.from_email;
    }

    // Check if contact received the email (to or cc)
    const toMatch = email.to_emails?.find(
      (e) => e.toLowerCase() === contactEmailLower
    );
    if (toMatch) return toMatch;

    const ccMatch = email.cc_emails?.find(
      (e) => e.toLowerCase() === contactEmailLower
    );
    if (ccMatch) return ccMatch;

    return contactEmail; // Fallback to the contact's primary email
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <span className="font-medium">Emails</span>
          {emailsPagination && (
            <Badge variant="secondary">{emailsPagination.total}</Badge>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showAllInThread}
            onChange={(e) => setShowAllInThread(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show all in thread
        </label>
      </div>

      <div className="flex-1 min-h-0">
        {loadingEmails ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : emails.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                No emails found for {contactEmail}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <TeeemTableView
              tableName="Contact Emails"
              preloadedViews={[]}
              columns={[
                {
                  key: "direction",
                  label: "Direction",
                  column_type: "choice",
                  width: 80,
                  choices: ["From", "To", "CC"],
                  filterable: true,
                },
                {
                  key: "from_or_to",
                  label: "From/To",
                  column_type: "text",
                  width: 200,
                  filterable: true,
                },
                {
                  key: "contact_email_used",
                  label: "Contact Email",
                  column_type: "text",
                  width: 200,
                  filterable: true,
                },
                {
                  key: "subject",
                  label: "Subject",
                  column_type: "text",
                  width: 300,
                  filterable: true,
                },
                {
                  key: "received_at",
                  label: "Date",
                  column_type: "date_and_time",
                  width: 150,
                  sortable: true,
                },
                {
                  key: "attachments",
                  label: "Files",
                  column_type: "whole_number",
                  width: 70,
                  filterable: true,
                },
              ]}
              entries={emails.map((email) => {
                const contactEmailLower = contactEmail?.toLowerCase() || "";
                const isFrom =
                  email.from_email?.toLowerCase() === contactEmailLower;
                const isCc = email.cc_emails?.some(
                  (e) => e.toLowerCase() === contactEmailLower
                );
                return {
                  id: email.id,
                  direction: isFrom ? "From" : isCc ? "CC" : "To",
                  contact_email_used: getContactEmailUsed(email),
                  subject: email.subject || "(no subject)",
                  from_or_to: isFrom
                    ? email.to_emails?.join(", ") || "-"
                    : email.display_from || email.from_email,
                  received_at: email.received_at,
                  attachments: email.has_attachments
                    ? email.attachment_count || 1
                    : 0,
                  // Include original email fields for Email to Contacts extraction feature
                  from_email: email.from_email,
                  to_emails: email.to_emails,
                  cc_emails: email.cc_emails,
                };
              })}
              viewOnly={true}
              onRowDoubleClick={handleRowDoubleClick}
            />

            {/* Pagination */}
            {emailsPagination && emailsPagination.total_pages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={emailsPage === 1}
                  onClick={() => loadEmails(emailsPage - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {emailsPage} of {emailsPagination.total_pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={emailsPage >= emailsPagination.total_pages}
                  onClick={() => loadEmails(emailsPage + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
