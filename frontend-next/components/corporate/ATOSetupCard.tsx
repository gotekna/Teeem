"use client";

/**
 * ATOSetupCard - ATO Registration status card
 *
 * Shows ATO/GST registration info sourced from linked Contact record.
 * TFN requires password verification to reveal.
 * Displays warning if company is not linked to a Contact.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileText, Pencil, Eye, EyeOff } from "lucide-react";
import type { Corporate } from "@/lib/types/corporate";
import { PasswordRevealDialog } from "@/components/corporate/PasswordRevealDialog";

interface ATOSetupCardProps {
  company: Corporate;
}

export function ATOSetupCard({ company }: ATOSetupCardProps) {
  const router = useRouter();
  const [showTfn, setShowTfn] = React.useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = React.useState(false);
  const [revealedTfn, setRevealedTfn] = React.useState<string | null>(null);

  const formatTFN = (tfn?: string) => {
    if (!tfn) return "-";
    const digits = tfn.replace(/\D/g, "");
    if (digits.length === 9) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return tfn;
  };

  const toggleTfn = () => {
    if (!revealedTfn) {
      setShowPasswordDialog(true);
      return;
    }
    setShowTfn(!showTfn);
  };

  // Don't show "Contact Not Linked" warning here — InformationTab shows that inline
  if (!company.contact_id) {
    return null;
  }

  return (
    <>
      <Card className="mt-6 border-muted">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ATO Registration
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/contacts/${company.contact_id}?edit=true`)}
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Data sourced from linked Contact record
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">ABN</p>
              <p className="font-medium">{company.formatted_abn || company.abn || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">TFN</p>
              <div className="flex items-center gap-1.5">
                <p className="font-medium">
                  {!company.has_tfn ? "—" : showTfn && revealedTfn ? formatTFN(revealedTfn) : "••• ••• •••"}
                </p>
                {company.has_tfn && (
                  <button type="button" onClick={toggleTfn} className="text-muted-foreground hover:text-foreground p-0.5">
                    {showTfn && revealedTfn ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">GST Status</p>
              <Badge
                variant="outline"
                className={company.gst_registration_status === "registered"
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground"
                }
              >
                {company.gst_registration_status === "registered" ? "Registered" : "Not Registered"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Source</p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-blue-600 dark:text-blue-400"
                onClick={() => router.push(`/contacts/${company.contact_id}`)}
              >
                View Contact →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PasswordRevealDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        companyId={company.id}
        onRevealed={(data) => {
          if (data.tfn) {
            setRevealedTfn(data.tfn);
            setShowTfn(true);
          }
        }}
      />
    </>
  );
}

export default ATOSetupCard;
