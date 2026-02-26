"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

// Inline API URL to avoid importing the heavy @/lib/api module tree.
// The signing page is public (no auth) so we always use the production API.
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://teeem-production-121159e1ff9d.herokuapp.com").trim();

function getSigningApiUrl(): string {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("teeem_api_url");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
      }
    } catch { /* ignore */ }
  }
  return API_URL;
}

// Dynamic imports: only load step components when actually needed.
// This keeps the initial bundle tiny (just a spinner) for fast page load.
const EmailVerificationStep = dynamic(
  () => import("@/components/signing/email-verification-step").then(m => ({ default: m.EmailVerificationStep })),
  { ssr: false }
);
const SigningReviewStep = dynamic(
  () => import("@/components/signing/signing-review-step").then(m => ({ default: m.SigningReviewStep })),
  { ssr: false }
);
const SignatureCaptureStep = dynamic(
  () => import("@/components/signing/signature-capture-step").then(m => ({ default: m.SignatureCaptureStep })),
  { ssr: false }
);
const PositionedSigningStep = dynamic(
  () => import("@/components/signing/positioned-signing-step").then(m => ({ default: m.PositionedSigningStep })),
  { ssr: false }
);
const ConsentStep = dynamic(
  () => import("@/components/signing/consent-step").then(m => ({ default: m.ConsentStep })),
  { ssr: false }
);
const CompletionStep = dynamic(
  () => import("@/components/signing/completion-step").then(m => ({ default: m.CompletionStep })),
  { ssr: false }
);

interface SignerInfo {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  can_sign: boolean;
  email_verified: boolean;
  email_verification_required: boolean;
  ersd_accepted: boolean;
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

type SigningStep = "loading" | "error" | "verify_email" | "consent" | "choose_signature" | "view_document" | "sign" | "sign_positioned" | "completed" | "declined" | "already_signed";

// Minimal inline spinner (no external imports needed)
function LoadingSpinner() {
  return (
    <svg
      fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"
      strokeLinecap="round" strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className="animate-spin h-8 w-8 text-gray-400 mx-auto"
    >
      <path d="M12 3v3m6.366-.366-2.12 2.12M21 12h-3m.366 6.366-2.12-2.12M12 21v-3m-6.366.366 2.12-2.12M3 12h3m-.366-6.366 2.12 2.12" />
    </svg>
  );
}

export default function SigningCeremonyPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<SigningStep>("loading");
  const [error, setError] = useState<string | null>(null);
  const [signer, setSigner] = useState<SignerInfo | null>(null);
  const [request, setRequest] = useState<RequestInfo | null>(null);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [requestCompleted, setRequestCompleted] = useState(false);
  const [chosenSignature, setChosenSignature] = useState<string | null>(null);

  const apiUrl = getSigningApiUrl();

  // Verify token and get session info
  const verifyToken = async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${apiUrl}/api/v1/sign/${token}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
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

      if (data.signer.status === "signed") {
        setStep("already_signed");
      } else if (data.signer.status === "declined") {
        setStep("declined");
      } else if (data.signer.email_verification_required && !data.signer.email_verified) {
        setStep("verify_email");
      } else if (!data.signer.can_sign) {
        setError("It's not your turn to sign yet. Please wait for other signers.");
        setStep("error");
      } else if (!data.signer.ersd_accepted) {
        // ERSD consent required before viewing/signing
        setStep("consent");
      } else if (data.request?.has_positioned_fields && data.fields?.length > 0) {
        // Choose signature first, then positioned signing
        setStep("choose_signature");
      } else {
        setStep("view_document");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Connection timed out. Please check your internet connection and refresh the page.");
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
      setStep("error");
    }
  };

  useEffect(() => {
    if (token) verifyToken();
  }, [token]);

  const markViewed = async () => {
    try {
      await fetch(`${apiUrl}/api/v1/sign/${token}/view`, { method: "POST" });
    } catch { /* ignore */ }
  };

  const handleVerificationComplete = () => {
    if (signer) setSigner({ ...signer, email_verified: true });
    // After email verification, go to ERSD consent (if not already accepted)
    if (signer?.ersd_accepted) {
      proceedAfterConsent();
    } else {
      setStep("consent");
    }
  };

  // Proceed after ERSD consent: choose signature first for positioned flows
  const proceedAfterConsent = () => {
    if (request?.has_positioned_fields && fields.length > 0) {
      // Go to signature selection step first, then positioned signing
      setStep("choose_signature");
    } else {
      setStep("view_document");
    }
  };

  const handleConsentAccepted = () => {
    if (signer) setSigner({ ...signer, ersd_accepted: true });
    proceedAfterConsent();
  };

  const handleDocumentViewed = () => {
    markViewed();
    if (request?.has_positioned_fields && fields.length > 0) {
      setStep("sign_positioned");
    } else {
      setStep("sign");
    }
  };

  const handleSignatureChosen = (_allComplete: boolean, signatureData?: string) => {
    if (signatureData) {
      setChosenSignature(signatureData);
    }
    setStep("sign_positioned");
  };

  const handleSignatureSubmitted = (completed: boolean) => {
    setRequestCompleted(completed);
    setStep("completed");
  };

  const handleDecline = async (reason: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (response.ok) setStep("declined");
    } catch { /* ignore */ }
  };

  const renderStep = () => {
    switch (step) {
      case "loading":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner />
            <p className="mt-4 text-gray-500">Loading signing session...</p>
          </div>
        );

      case "error":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-red-500 text-4xl mb-4">⚠</div>
            <h2 className="text-xl font-semibold mb-2">Unable to Load</h2>
            <p className="text-gray-500 text-center max-w-md mb-4">{error}</p>
            <button
              onClick={() => { setStep("loading"); setError(null); verifyToken(); }}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              Try Again
            </button>
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

      case "consent":
        return (
          <ConsentStep
            token={token}
            apiUrl={apiUrl}
            documentTitle={request?.title || "Document"}
            onConsent={handleConsentAccepted}
            onDecline={handleDecline}
          />
        );

      case "choose_signature":
        return (
          <SignatureCaptureStep
            token={token}
            signerName={signer?.name || ""}
            onComplete={handleSignatureChosen}
            onBack={() => setStep("consent")}
            embedded={true}
            apiUrl={apiUrl}
          />
        );

      case "view_document":
        return (
          <SigningReviewStep
            token={token}
            documentTitle={request?.title || "Document"}
            onContinue={handleDocumentViewed}
            onDecline={handleDecline}
          />
        );

      case "sign":
        return (
          <SignatureCaptureStep
            token={token}
            signerName={signer?.name || ""}
            onComplete={(completed) => handleSignatureSubmitted(completed)}
            onBack={() => setStep("view_document")}
            apiUrl={apiUrl}
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
            apiUrl={apiUrl}
            initialSignature={chosenSignature || undefined}
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
            <div className="text-gray-400 text-4xl mb-4">✕</div>
            <h2 className="text-xl font-semibold mb-2">Signing Declined</h2>
            <p className="text-gray-500 text-center">You have declined to sign this document.</p>
          </div>
        );

      case "already_signed":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-green-500 text-4xl mb-4">✓</div>
            <h2 className="text-xl font-semibold mb-2">Already Signed</h2>
            <p className="text-gray-500 text-center">You have already signed this document.</p>
          </div>
        );

      default:
        return null;
    }
  };

  // Full-screen mode for positioned signing - PDF needs maximum space
  const isFullScreen = step === "sign_positioned";

  return (
    <div className={`min-h-screen bg-gray-100 ${isFullScreen ? "flex flex-col h-screen overflow-hidden" : ""}`}>
      {/* Header - compact in full-screen mode */}
      <header className={`bg-white border-b shadow-sm ${isFullScreen ? "flex-shrink-0" : ""}`}>
        <div className={`${isFullScreen ? "px-4" : "max-w-4xl mx-auto px-4"} py-2 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-800 text-white flex items-center justify-center text-sm font-bold rounded">
              t
            </div>
            <span className="font-semibold text-sm">TEEEM E-Sign</span>
            {isFullScreen && request && (
              <span className="text-sm text-gray-500 ml-2 hidden sm:inline">&bull; {request.title}</span>
            )}
          </div>
          {request && (
            <div className="text-sm text-gray-500">{request.request_number}</div>
          )}
        </div>
      </header>

      {/* Main Content */}
      {isFullScreen ? (
        <main className="flex-1 overflow-hidden">
          {renderStep()}
        </main>
      ) : (
        <main className="max-w-4xl mx-auto px-4 py-8 pb-20">
          {request && step !== "loading" && step !== "error" && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1">{request.title}</h1>
              {request.description && (
                <p className="text-gray-500">{request.description}</p>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6">
            {renderStep()}
          </div>

          {/* Other signers status */}
          {request?.other_signers && request.other_signers.length > 0 && step !== "loading" && step !== "error" && (
            <div className="bg-white rounded-lg shadow mt-6 p-6">
              <h3 className="text-sm font-medium mb-3">Other Signers</h3>
              <div className="space-y-2">
                {request.other_signers.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>{s.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      s.status === "signed"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {s.status === "signed" ? "Signed" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {!isFullScreen && (
        <footer className="border-t py-3 mt-8">
          <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-400">
            Powered by TEEEM E-Signature System
          </div>
        </footer>
      )}
    </div>
  );
}
