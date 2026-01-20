"use client";

import { CheckCircle2, Download, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompletionStepProps {
  signerName: string;
  documentTitle: string;
  allComplete: boolean;
}

export function CompletionStep({
  signerName,
  documentTitle,
  allComplete,
}: CompletionStepProps) {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
      </div>

      <h2 className="text-2xl font-semibold mb-2">
        {allComplete ? "Document Completed!" : "Signature Applied!"}
      </h2>

      <p className="text-muted-foreground text-center mb-6 max-w-md">
        {allComplete ? (
          <>
            All signatures have been collected for &ldquo;{documentTitle}&rdquo;.
            The document is now complete.
          </>
        ) : (
          <>
            Thank you, {signerName}! Your signature has been successfully applied to &ldquo;{documentTitle}&rdquo;.
          </>
        )}
      </p>

      {/* Status card */}
      <div className="w-full max-w-md space-y-4">
        {allComplete ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  All Signatures Collected
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  You will receive a copy of the completed document via email.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  Waiting for Other Signers
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  You will receive the completed document once all parties have signed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* What happens next */}
        <div className="bg-muted dark:bg-slate-800 rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">What happens next?</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              Your signature has been securely recorded with a timestamp
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              {allComplete
                ? "A Certificate of Completion has been generated"
                : "Other signers will be notified to complete their signatures"}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              A confirmation email has been sent to your address
            </li>
            {allComplete && (
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">4.</span>
                The signed document is now legally binding
              </li>
            )}
          </ul>
        </div>

        {/* Actions */}
        {allComplete && (
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download Certificate
            </Button>
            <Button className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download Document
            </Button>
          </div>
        )}
      </div>

      {/* Security notice */}
      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground max-w-md">
          This document has been signed using TEEEM E-Signature, which complies with
          the Electronic Signatures in Global and National Commerce Act (E-SIGN),
          the Uniform Electronic Transactions Act (UETA), and equivalent international
          legislation.
        </p>
      </div>

      {/* Close window prompt */}
      <p className="text-sm text-muted-foreground mt-6">
        You may now close this window.
      </p>
    </div>
  );
}
