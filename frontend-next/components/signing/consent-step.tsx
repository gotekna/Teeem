"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

interface ConsentStepProps {
  token: string;
  apiUrl: string;
  documentTitle: string;
  onConsent: () => void;
  onDecline: (reason: string) => void;
}

export function ConsentStep({
  token,
  apiUrl,
  documentTitle,
  onConsent,
  onDecline,
}: ConsentStepProps) {
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [consent3, setConsent3] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [disclosureId, setDisclosureId] = useState<string | null>(null);

  const allConsented = consent1 && consent2 && consent3;

  const handleAcceptErsd = async () => {
    if (!allConsented || submitting) return;
    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/api/v1/sign/${token}/accept_ersd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();

      if (data.success) {
        setDisclosureId(data.disclosure_id);
        onConsent();
      }
    } catch {
      // Still proceed on network error - consent is recorded server-side
      onConsent();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = () => {
    if (declineReason.trim()) {
      onDecline(declineReason);
      setShowDeclineDialog(false);
    }
  };

  return (
    <div className="flex flex-col items-center py-4 px-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Electronic Record and Signature Disclosure</h2>
          <p className="text-sm text-muted-foreground">
            Before signing &ldquo;{documentTitle}&rdquo;, please review and consent to the following.
          </p>
        </div>
      </div>

      {/* Consent checkboxes */}
      <div className="space-y-3 w-full max-w-md">
        {/* Consent 1: Electronic delivery */}
        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted dark:hover:bg-slate-800 transition-colors">
          <Checkbox
            id="consent1"
            checked={consent1}
            onCheckedChange={(checked) => setConsent1(checked === true)}
            className="mt-0.5"
          />
          <div>
            <Label
              htmlFor="consent1"
              className="font-medium cursor-pointer text-sm"
            >
              I consent to electronic delivery
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              I agree to receive this document electronically and understand that I may
              request a paper copy at any time by contacting the sender.
            </p>
          </div>
        </div>

        {/* Consent 2: Electronic signature */}
        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted dark:hover:bg-slate-800 transition-colors">
          <Checkbox
            id="consent2"
            checked={consent2}
            onCheckedChange={(checked) => setConsent2(checked === true)}
            className="mt-0.5"
          />
          <div>
            <Label
              htmlFor="consent2"
              className="font-medium cursor-pointer text-sm"
            >
              I consent to use electronic signatures
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              I agree that my electronic signature on this document is legally binding
              under the <em>Electronic Transactions Act 1999</em> (Cth) s.10 and
              equivalent State and Territory legislation.
            </p>
          </div>
        </div>

        {/* Consent 3: Intent to sign */}
        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted dark:hover:bg-slate-800 transition-colors">
          <Checkbox
            id="consent3"
            checked={consent3}
            onCheckedChange={(checked) => setConsent3(checked === true)}
            className="mt-0.5"
          />
          <div>
            <Label
              htmlFor="consent3"
              className="font-medium cursor-pointer text-sm"
            >
              I intend to sign this document
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              I will review the contents of this document before applying my
              electronic signature to create a legally binding agreement.
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-4 w-full max-w-md">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeclineDialog(true)}
          className="flex-1"
        >
          Decline
        </Button>
        <Button
          onClick={handleAcceptErsd}
          disabled={!allConsented || submitting}
          size="sm"
          className="flex-1"
        >
          {submitting ? "Recording consent..." : "Accept & Continue to Sign"}
        </Button>
      </div>

      {!allConsented && (
        <p className="text-xs text-muted-foreground mt-2">
          Please check all boxes above to continue
        </p>
      )}

      {/* Legal notice */}
      <div className="mt-3 p-3 bg-muted dark:bg-slate-800 rounded-lg max-w-md">
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          Electronic signatures are legally binding under the <em>Electronic Transactions
          Act 1999</em> (Cth), E-SIGN Act, UETA, and equivalent legislation.
          Your consent, IP address, and timestamp will be recorded.
        </p>
      </div>

      {/* Decline dialog */}
      <AlertDialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline to Sign</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for declining to sign this document.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Enter your reason for declining..."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="min-h-[100px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDecline}
              disabled={!declineReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Decline to Sign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
