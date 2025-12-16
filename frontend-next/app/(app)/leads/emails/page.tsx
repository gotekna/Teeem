"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmailProposalsTab } from "@/components/leads/email-proposals-tab";
import { ArrowLeft, Mail } from "lucide-react";

export default function EmailLeadsPage() {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/leads")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
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