"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { EmailVerificationStep } from "@/components/signing/email-verification-step";
import { DocumentViewerStep } from "@/components/signing/document-viewer-step";
import { ConsentStep } from "@/components/signing/consent-step";
import { SignatureCaptureStep } from "@/components/signing/signature-capture-step";
import { PositionedSigningStep } from "@/components/signing/positioned-signing-step";
import { CompletionStep } from "@/components/signing/completion-step";
import { getApiBaseUrl } from "@/lib/api";

interface SignerInfo {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  can_sign: boolean;
  email_verified: boolean;
}

interface RequestInfo {
  id: number;
  request_number: string;
  title: string;
  description?: string;
  expires_at?: string;
  has_positioned_fields: boolean;
  other_signers: { name: string; status: string }[];
}

interface SignatureField {
  id: number;
  field_type: "signature" | "initials" | "date" | "text";
  page_number: number;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  label?: string;
  required: boolean;
  date_format?: string;
  placeholder?: string;
  completed: boolean;
  value?: string;
}

type SigningStep = "loading" | "error" | "verify_email" | "view_document" | "consent" | "sign" | "sign_positioned" | "completed" | "declined" | "already_signed";

export default function SigningCeremonyPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<SigningStep>("loading");
  const [error, setError] = useState<string | null>(null);
  const [signer, setSigner] = useState<SignerInfo | null>(null);
  const [request, setRequest] = useState<RequestInfo | null>(null);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [requestCompleted, setRequestCompleted] = useState(false);

  const apiUrl = getApiBaseUrl();

  // Verify token and get session info
  const verifyToken = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/sign/${token}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 410) {
          setError(data.errors?.[0] || "This signing request is no longer active");
          setStep("error");
          return;
        }
        throw new Error(data.errors?.[0] || "Invalid signing link");
      }

      setSigner(data.signer);
      setRequest(data.request);
      setFields(data.fields || []);

      // Determine which step to show
      if (data.signer.status === "signed") {
        setStep("already_signed");
      } else if (data.signer.status === "declined") {
        setStep("declined");
      } else if (!data.signer.email_verified) {
        setStep("verify_email");
      } else if (!data.signer.can_sign) {
        setError("It's not your turn to sign yet. Please wait for other signers.");
        setStep("error");
      } else {
        setStep("view_document");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify signing link");
      setStep("error");
    }
  }, [token, apiUrl]);

  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token, verifyToken]);

  // Mark document as viewed
  const markViewed = async () => {
    try {
      await fetch(`${apiUrl}/api/v1/sign/${token}/view`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to mark as viewed:", err);
    }
  };

  // Handle email verification complete
  const handleVerificationComplete = () => {
    if (signer) {
      setSigner({ ...signer, email_verified: true });
    }
    setStep("view_document");
  };

  // Handle document viewed
  const handleDocumentViewed = () => {
    markViewed();
    setStep("consent");
  };

  // Handle consent given
  const handleConsentGiven = () => {
    // Use positioned signing if fields exist, otherwise use legacy signature capture
    if (request?.has_positioned_fields && fields.length > 0) {
      setStep("sign_positioned");
    } else {
      setStep("sign");
    }
  };

  // Handle signature submitted
  const handleSignatureSubmitted = (completed: boolean) => {
    setRequestCompleted(completed);
    setStep("completed");
  };

  // Handle decline
  const handleDecline = async (reason: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        setStep("declined");
      }
    } catch (err) {
      console.error("Failed to decline:", err);
    }
  };

  // Render based on current step
  const renderStep = () => {
    switch (step) {
      case "loading":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading signing session...</p>
          </div>
        );

      case "error":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load</h2>
            <p className="text-muted-foreground text-center max-w-md">{error}</p>
          </div>
        );

      case "verify_email":
        return (
          <EmailVerificationStep
            token={token}
            signerName={signer?.name || ""}
            signerEmail={signer?.email || ""}
            onVerified={handleVerificationComplete}
          />
        );

      case "view_document":
        return (
          <DocumentViewerStep
            token={token}
            documentTitle={request?.title || "Document"}
            onContinue={handleDocumentViewed}
            onDecline={handleDecline}
          />
        );

      case "consent":
        return (
          <ConsentStep
            documentTitle={request?.title || "Document"}
            onConsent={handleConsentGiven}
            onDecline={handleDecline}
          />
        );

      case "sign":
        return (
          <SignatureCaptureStep
            token={token}
            signerName={signer?.name || ""}
            onComplete={(completed) => handleSignatureSubmitted(completed)}
            onBack={() => setStep("consent")}
          />
        );

      case "sign_positioned":
        return (
          <PositionedSigningStep
            token={token}
            documentTitle={request?.title || "Document"}
            fields={fields}
            signerName={signer?.name || ""}
            onComplete={handleSignatureSubmitted}
            onDecline={handleDecline}
          />
        );

      case "completed":
        return (
          <CompletionStep
            signerName={signer?.name || ""}
            documentTitle={request?.title || "Document"}
            allComplete={requestCompleted}
          />
        );

      case "declined":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Signing Declined</h2>
            <p className="text-muted-foreground text-center">
              You have declined to sign this document.
            </p>
          </div>
        );

      case "already_signed":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Already Signed</h2>
            <p className="text-muted-foreground text-center">
              You have already signed this document.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold rounded">
              t
            </div>
            <span className="font-semibold">TEEEM E-Sign</span>
          </div>
          {request && (
            <div className="text-sm text-muted-foreground">
              {request.request_number}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {request && step !== "loading" && step !== "error" && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1">{request.title}</h1>
            {request.description && (
              <p className="text-muted-foreground">{request.description}</p>
            )}
          </div>
        )}

        <Card>
          <CardContent className="p-6">
            {renderStep()}
          </CardContent>
        </Card>

        {/* Other signers status */}
        {request?.other_signers && request.other_signers.length > 0 && step !== "loading" && step !== "error" && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Other Signers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {request.other_signers.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>{s.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      s.status === "signed"
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {s.status === "signed" ? "Signed" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t py-3">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-muted-foreground">
          Powered by TEEEM E-Signature System
        </div>
      </footer>
    </div>
  );
}
