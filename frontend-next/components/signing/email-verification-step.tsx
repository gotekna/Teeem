"use client";

import { useState, useRef, useEffect } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, RefreshCw } from "lucide-react";

interface EmailVerificationStepProps {
  token: string;
  signerName: string;
  signerEmail: string;
  onVerified: () => void;
}

export function EmailVerificationStep({
  token,
  signerName,
  signerEmail,
  onVerified,
}: EmailVerificationStepProps) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const apiUrl = getApiBaseUrl();

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Send verification code
  const sendCode = async () => {
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/v1/sign/${token}/send_verification`, {
        method: "POST",
      });

      if (response.ok) {
        setCodeSent(true);
        setCountdown(60); // 60 second cooldown
      } else {
        const data = await response.json();
        setError(data.errors?.[0] || "Failed to send verification code");
      }
    } catch {
      setError("Failed to send verification code. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Handle code input
  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedCode = value.slice(0, 6).split("");
      const newCode = [...code];
      pastedCode.forEach((char, i) => {
        if (index + i < 6 && /^\d$/.test(char)) {
          newCode[index + i] = char;
        }
      });
      setCode(newCode);
      // Focus last filled input or next empty
      const lastIndex = Math.min(index + pastedCode.length - 1, 5);
      inputRefs.current[lastIndex]?.focus();
    } else if (/^\d$/.test(value) || value === "") {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);

      // Auto-focus next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Verify the code
  const verifyCode = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/v1/sign/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode }),
      });

      if (response.ok) {
        onVerified();
      } else {
        const data = await response.json();
        setError(data.errors?.[0] || "Invalid verification code");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-verify when all digits entered
  useEffect(() => {
    if (code.every((digit) => digit !== "")) {
      verifyCode();
    }
  }, [code]);

  // Mask email for display
  const maskedEmail = signerEmail.replace(
    /^(.{2})(.*)(@.*)$/,
    (_, start, middle, end) => start + "*".repeat(Math.min(middle.length, 5)) + end
  );

  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
        <Mail className="h-8 w-8 text-primary" />
      </div>

      <h2 className="text-xl font-semibold mb-2">Verify Your Email</h2>
      <p className="text-muted-foreground text-center mb-6 max-w-md">
        Hi {signerName}, to ensure you are the intended recipient, we need to verify your email address.
      </p>

      {!codeSent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm">
            We&apos;ll send a 6-digit verification code to:
          </p>
          <p className="font-medium">{maskedEmail}</p>
          <Button onClick={sendCode} disabled={isSending} className="w-full max-w-xs">
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Verification Code"
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-center text-muted-foreground">
            Enter the 6-digit code sent to {maskedEmail}
          </p>

          {/* Code input boxes */}
          <div className="flex gap-2 justify-center">
            {code.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-12 text-center text-lg font-semibold"
                disabled={isVerifying}
                autoFocus={index === 0}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={verifyCode}
              disabled={isVerifying || code.some((d) => !d)}
              className="w-full max-w-xs"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={sendCode}
              disabled={isSending || countdown > 0}
              className="text-muted-foreground"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {countdown > 0
                ? `Resend code in ${countdown}s`
                : "Resend code"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
