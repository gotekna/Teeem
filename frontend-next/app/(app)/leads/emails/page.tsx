"use client";

import { useState } from "react";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { EmailProposalsTab } from "@/components/leads/email-proposals-tab";
import { BackButton } from "@/components/ui/back-button";
import { Mail } from "lucide-react";

export default function EmailLeadsPage() {
  useSetLayoutMode("full-height");
  const [pendingCount, setPendingCount] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
<BackButton fallbackHref="/leads" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Email Leads
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and approve job proposals from incoming emails
            </p>
          </div>
        </div>
      </div>

      {/* Email Proposals Content */}
      <EmailProposalsTab onPendingCountChange={setPendingCount} />
    </div>
  );
}