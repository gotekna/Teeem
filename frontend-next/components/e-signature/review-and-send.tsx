"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Users,
  PenLine,
  AtSign,
  Calendar,
  TextCursor,
  CheckCircle2,
  AlertCircle,
  Send,
  Mail,
} from "lucide-react";
import type { Signer, SignatureField, SignatureFieldType } from "@/components/ui/pdf-editor/types";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface ReviewAndSendProps {
  title: string;
  description: string;
  documentName: string;
  signers: Signer[];
  fields: SignatureField[];
  onSubmit: () => void;
  isSubmitting: boolean;
}

const FIELD_ICONS: Record<SignatureFieldType, React.ReactNode> = {
  signature: <PenLine className="h-4 w-4" />,
  initials: <AtSign className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  text: <TextCursor className="h-4 w-4" />,
};

export function ReviewAndSend({
  title,
  description,
  documentName,
  signers,
  fields,
  onSubmit,
  isSubmitting,
}: ReviewAndSendProps) {
  const [sendNotifications, setSendNotifications] = React.useState(true);
  const [agreedToTerms, setAgreedToTerms] = React.useState(false);

  // Calculate stats
  const fieldsBySigner = React.useMemo(() => {
    const result: Record<string, SignatureField[]> = {};
    for (const signer of signers) {
      result[signer.id] = fields.filter((f) => f.signerId === signer.id);
    }
    return result;
  }, [signers, fields]);

  const fieldsByType = React.useMemo(() => {
    const result: Record<SignatureFieldType, number> = {
      signature: 0,
      initials: 0,
      date: 0,
      text: 0,
    };
    for (const field of fields) {
      result[field.type]++;
    }
    return result;
  }, [fields]);

  const allSignersHaveFields = signers.every((s) => fieldsBySigner[s.id]?.length > 0);
  const canSubmit = agreedToTerms && allSignersHaveFields && !isSubmitting;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Review & Send</h2>
        <p className="text-muted-foreground mt-1">
          Review your document before sending for signatures
        </p>
      </div>

      {/* Document summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <p className="font-medium">{title}</p>
          </div>
          {description && (
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm">{description}</p>
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">File</Label>
            <p className="text-sm">{documentName}</p>
          </div>
        </CardContent>
      </Card>

      {/* Signers summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Signers ({signers.length})
          </CardTitle>
          <CardDescription>
            Each signer will receive an email with a secure link to sign
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {signers.map((signer, index) => {
              const signerFields = fieldsBySigner[signer.id] || [];
              const hasFields = signerFields.length > 0;

              return (
                <div
                  key={signer.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    hasFields ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: signer.color }}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">
                        {signer.name || signer.email.split("@")[0]}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {signer.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasFields ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700 dark:text-green-400">
                          {signerFields.length} field{signerFields.length !== 1 ? "s" : ""}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-700 dark:text-red-400">
                          No fields assigned
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Fields summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Signature Fields ({fields.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.entries(fieldsByType) as [SignatureFieldType, number][]).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center gap-2 p-3 rounded-lg bg-muted"
              >
                {FIELD_ICONS[type]}
                <div>
                  <p className="text-sm font-medium capitalize">{type}</p>
                  <p className="text-xs text-muted-foreground">{count} field{count !== 1 ? "s" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle>Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="notifications"
              checked={sendNotifications}
              onCheckedChange={(checked) => setSendNotifications(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="notifications" className="font-medium cursor-pointer">
                Send email notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Signers will receive an email with a secure link to review and sign the document
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning if signers don't have fields */}
      {!allSignersHaveFields && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-400">
              Some signers have no fields assigned
            </p>
            <p className="text-sm text-red-600 dark:text-red-500 mt-1">
              Please go back and add at least one signature field for each signer.
            </p>
          </div>
        </div>
      )}

      {/* Terms agreement */}
      <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
        <Checkbox
          id="terms"
          checked={agreedToTerms}
          onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
        />
        <div className="space-y-1">
          <Label htmlFor="terms" className="font-medium cursor-pointer">
            I confirm this document is ready for signatures
          </Label>
          <p className="text-sm text-muted-foreground">
            By sending this document, you confirm that all signature fields are correctly placed
            and all signers have been added. Signers will receive notification emails.
          </p>
        </div>
      </div>

      {/* Submit button */}
      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="px-8"
        >
          {isSubmitting ? (
            <>
              <Spinner size={20} className="mr-2" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-5 w-5 mr-2" />
              Send for Signature
            </>
          )}
        </Button>
      </div>

      {/* Legal notice */}
      <p className="text-xs text-center text-muted-foreground">
        Documents signed electronically are legally binding under the Electronic Signatures in
        Global and National Commerce Act (ESIGN), the Uniform Electronic Transactions Act (UETA),
        and equivalent legislation in applicable jurisdictions.
      </p>
    </div>
  );
}
