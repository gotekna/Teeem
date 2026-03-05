"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

export default function PortalLogin() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>}>
      <PortalLoginContent />
    </Suspense>
  );
}

function PortalLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle token-based auto-login (admin impersonation)
  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) return;

    const embedParam = searchParams.get("embed");

    const autoLogin = async () => {
      setLoading(true);
      try {
        // Store token so the api helper uses it for auth
        setStorageItem(STORAGE_KEYS.PORTAL_TOKEN, token);

        // Fetch user info to validate token and get user data
        // Use custom fetch with portal token (api helper uses main auth token)
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}/api/v1/portal/auth/me`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();

        if (data?.success && data.user) {
          setStorageItem(STORAGE_KEYS.PORTAL_USER, data.user);
          const portalType = data.user?.portal_type;
          let redirectTo = (portalType === "tenant" || portalType === "owner")
            ? "/portal/property"
            : "/portal/dashboard";
          // Preserve embed mode through redirect
          if (embedParam === "1") {
            redirectTo += "?embed=1";
          }
          router.push(redirectTo);
        } else {
          setError("Invalid or expired token");
          setLoading(false);
        }
      } catch {
        setError("Invalid or expired token");
        setLoading(false);
      }
    };

    autoLogin();
  }, [searchParams, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/v1/portal/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (data?.success) {
        // Store token and user data
        setStorageItem(STORAGE_KEYS.PORTAL_TOKEN, data.token);
        setStorageItem(STORAGE_KEYS.PORTAL_USER, data.user);

        // Redirect based on portal type
        const portalType = data.user?.portal_type;
        const redirectTo = (portalType === "tenant" || portalType === "owner")
          ? "/portal/property"
          : "/portal/dashboard";
        router.push(redirectTo);
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err: any) {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100 dark:from-background dark:via-card dark:to-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-4xl font-extrabold text-foreground dark:text-white">
            TEEEM Portal
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground dark:text-muted-foreground">
            Secure Portal Access
          </p>
        </div>

        <div className="bg-card rounded-lg shadow-xl p-8">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border dark:border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground dark:text-muted-foreground">
                  Need help? Contact your builder
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground dark:text-muted-foreground">
          This portal is for authorized users only
        </p>
      </div>
    </div>
  );
}
