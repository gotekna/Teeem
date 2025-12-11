"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, FileText, Shield, CheckCircle } from "lucide-react";
import { EmailVerificationStep } from "@/components/signing/email-verification-step";
import { DocumentViewerStep } from "@/components/signing/document-viewer-step";
import { ConsentStep } from "@/components/signing/consent-step";
import { SignatureCapture } from "@/components/signing/signature-capture";
import { CompletionStep } from "@/components/signing/completion-step";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://teeemlive-ce8e2660a615.herokuapp.com";

type SigningStep = "loading" | "verify_email" | "view_document" | "consent" | "sign" | "complete" | "declined" | "error";

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
  description: string;
  expires_at: string;
  other_signers: Array<{ name: string; status: string }>;
}

export default function SigningPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<SigningStep>("loading");
  const [signer, setSigner] = useState<SignerInfo | null>(null);
  const [request, setRequest] = useState<RequestInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/sign/${token}`, {
        method: "GET",
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.errors?.[0] || "Invalid signing link");
        setStep("error");
        return;
      }

      setSigner(data.signer);
      setRequest(data.request);

      // Determine starting step based on signer status
      if (data.signer.status === "signed") {
        setStep("complete");
      } else if (data.signer.status === "declined") {
        setStep("declined");
      } else if (!data.signer.email_verified) {
        setStep("verify_email");
      } else {
        setStep("view_document");
      }
    } catch (err) {
      setError("Failed to verify signing link");
      setStep("error");
    }
  };

  const handleEmailVerified = useCallback(() => {
    if (signer) {
      setSigner({ ...signer, email_verified: true });
    }
    setStep("view_document");
  }, [signer]);

  const handleDocumentViewed = useCallback(() => {
    setStep("consent");
  }, []);

  const handleConsentGiven = useCallback(() => {
    setStep("sign");
  }, []);

  const handleSignatureComplete = useCallback((requestCompleted: boolean) => {
    setStep("complete");
  }, []);

  const handleDecline = useCallback(async (reason: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();

      if (data.success) {
        setStep("declined");
      } else {
        setError(data.errors?.[0] || "Failed to decline");
      }
    } catch (err) {
      setError("Failed to submit decline");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Progress indicator
  const steps = [
    { key: "verify_email", label: "Verify Email", icon: Shield },
    { key: "view_document", label: "Review Document", icon: FileText },
    { key: "consent", label: "Consent", icon: CheckCircle },
    { key: "sign", label: "Sign", icon: FileText },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
            <p className="mt-4 text-gray-600">Verifying signing link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Unable to Sign</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <p className="mt-4 text-sm text-gray-500 text-center">
              If you believe this is an error, please contact the sender.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "declined") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-semibold">Document Declined</h2>
            <p className="mt-2 text-gray-600">
              You have declined to sign this document. The sender has been notified.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{request?.title}</h1>
          {request?.description && (
            <p className="mt-2 text-gray-600">{request.description}</p>
          )}
          <Badge variant="outline" className="mt-2">
            Request #{request?.request_number}
          </Badge>
        </div>

        {/* Progress Steps */}
        {step !== "complete" && (
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-2">
              {steps.map((s, index) => {
                const Icon = s.icon;
                const isActive = s.key === step;
                const isComplete = index < currentStepIndex;

                return (
                  <div key={s.key} className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                        isActive
                          ? "border-blue-600 bg-blue-600 text-white"
                          : isComplete
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-gray-300 bg-white text-gray-400"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`w-12 h-1 mx-2 ${
                          isComplete ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center mt-2">
              <span className="text-sm text-gray-600">
                {steps.find(s => s.key === step)?.label}
              </span>
            </div>
          </div>
        )}

        {/* Step Content */}
        <Card>
          <CardContent className="pt-6">
            {step === "verify_email" && signer && (
              <EmailVerificationStep
                token={token}
                signerEmail={signer.email}
                signerName={signer.name}
                onVerified={handleEmailVerified}
                apiBaseUrl={BACKEND_URL}
              />
            )}

            {step === "view_document" && request && (
              <DocumentViewerStep
                token={token}
                documentTitle={request.title}
                onContinue={handleDocumentViewed}
                apiBaseUrl={BACKEND_URL}
              />
            )}

            {step === "consent" && signer && (
              <ConsentStep
                signerName={signer.name}
                documentTitle={request?.title || "Document"}
                onConsent={handleConsentGiven}
                onDecline={handleDecline}
                isLoading={isLoading}
              />
            )}

            {step === "sign" && signer && (
              <SignatureCapture
                token={token}
                signerName={signer.name}
                onComplete={handleSignatureComplete}
                apiBaseUrl={BACKEND_URL}
              />
            )}

            {step === "complete" && request && (
              <CompletionStep
                requestNumber={request.request_number}
                documentTitle={request.title}
              />
            )}
          </CardContent>
        </Card>

        {/* Other signers status */}
        {request?.other_signers && request.other_signers.length > 0 && step !== "complete" && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Other Signers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {request.other_signers.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{s.name}</span>
                    <Badge
                      variant={s.status === "signed" ? "default" : "secondary"}
                    >
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>Powered by TEEEM E-Signatures</p>
          <p className="mt-1">
            This document is legally binding. By signing, you agree to the terms.
          </p>
        </div>
      </div>
    </div>
  );
}
