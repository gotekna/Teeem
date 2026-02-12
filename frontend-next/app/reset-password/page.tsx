"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { handleTokenFromRedirect } = useAuth();
  const token = searchParams.get("token");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [error, setError] = useState("");

  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

  // Validate token and fetch user info on mount
  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/validate_reset_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (data.success) {
          setName(data.name || "");
          setUsername(data.username || data.email || "");
        } else {
          setTokenValid(false);
          setTokenError(data.error || "Invalid or expired reset link");
        }
      } catch {
        setTokenValid(false);
        setTokenError("Unable to connect. Please try again.");
      } finally {
        setIsValidating(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/reset_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, name: name.trim() || undefined, username: username.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        const loginSuccess = await handleTokenFromRedirect(data.token);
        router.push(loginSuccess ? "/dashboard" : "/login");
      } else if (data.success) {
        router.push("/login");
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token || (!isValidating && !tokenValid)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Invalid link</CardTitle>
            <CardDescription>{tokenError || "This password reset link is invalid or has expired."}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/forgot-password">
              <Button>Request a new link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">t</span>
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to Teeem</CardTitle>
          <CardDescription>Set up your account to get started.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive text-center">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                placeholder="Username"
              />
              <p className="text-xs text-muted-foreground">Defaults to your email. You can change this.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoFocus
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Setting password...
                </>
              ) : (
                "Set password & login"
              )}
            </Button>
          </form>

          <div className="bg-muted/50 border rounded-lg p-3 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium">
              <Bookmark className="h-3.5 w-3.5" />
              Bookmark the login page for easy access
            </div>
            <p className="text-[11px] text-muted-foreground">
              Press <kbd className="px-1 py-0.5 bg-background border rounded text-[10px] font-mono">{isMac ? "\u2318D" : "Ctrl+D"}</kbd> now, or save <span className="font-medium">teeem.vercel.app/login</span>
            </p>
          </div>

          <Link href="/login" className="block text-center">
            <Button variant="link" className="text-sm" type="button">
              <ArrowLeft className="mr-1 h-3 w-3" />
              Back to login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
