"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Monitor, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

export default function DeviceVerificationPage() {
  const router = useRouter();
  const [deviceCode, setDeviceCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);

  const handleVerify = useCallback(async () => {
    if (!deviceCode.trim()) {
      setError("Please enter a device code");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await api.post<{ message: string; device_name: string }>(
        "/api/v1/sync/auth/verify",
        { device_code: deviceCode.toUpperCase().trim() }
      );

      if (response) {
        setSuccess(true);
        setDeviceName(response.device_name);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to verify device code";
      if (errorMessage.includes("Invalid or expired")) {
        setError("Invalid or expired device code. Please try again from the desktop app.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsVerifying(false);
    }
  }, [deviceCode]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isVerifying) {
        handleVerify();
      }
    },
    [handleVerify, isVerifying]
  );

  const handleTryAgain = useCallback(() => {
    setDeviceCode("");
    setError(null);
    setSuccess(false);
    setDeviceName(null);
  }, []);

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Device Authorized</CardTitle>
            <CardDescription>
              {deviceName ? `"${deviceName}" has been` : "Your device has been"} successfully
              connected to your TEEEM account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              You can now close this page and return to the TEEEM Sync app on your desktop.
              The app will automatically sign you in.
            </p>
            <Button variant="outline" onClick={() => router.push("/")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Monitor className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Connect Desktop App</CardTitle>
          <CardDescription>
            Enter the code shown in the TEEEM Sync desktop app to connect it to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Enter device code"
              value={deviceCode}
              onChange={(e) => {
                setDeviceCode(e.target.value.toUpperCase());
                setError(null);
              }}
              onKeyPress={handleKeyPress}
              className="text-center text-2xl tracking-widest font-mono h-14"
              maxLength={10}
              disabled={isVerifying}
              autoFocus
            />
            <p className="text-xs text-center text-muted-foreground">
              The code is 8 characters and expires in 15 minutes
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleVerify}
              disabled={isVerifying || !deviceCode.trim()}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Verifying...
                </>
              ) : (
                "Authorize Device"
              )}
            </Button>

            {error && (
              <Button variant="ghost" onClick={handleTryAgain} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">How it works:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Open the TEEEM Sync app on your computer</li>
              <li>Click &quot;Sign In&quot; to get a device code</li>
              <li>Enter the code above and click &quot;Authorize Device&quot;</li>
              <li>The desktop app will automatically connect</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
