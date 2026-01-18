"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { getApiBaseUrl } from "@/lib/api";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState("");
  const { login, isAuthenticated, loading, handleTokenFromRedirect } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for token in URL (cross-domain redirect from another frontend deployment)
  // This happens when user logs in on production frontend but their company
  // is configured for staging/beta environment
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      const apiUrlParam = searchParams.get('api_url') || undefined;
      const envParam = searchParams.get('environment') || undefined;
      const redirectPath = searchParams.get('redirect') || '/dashboard';

      // Use AuthContext to handle the token - this stores it, sets up API URL,
      // and verifies with the backend before redirecting
      handleTokenFromRedirect(tokenParam, apiUrlParam, envParam).then((success) => {
        if (success) {
          router.push(redirectPath);
        }
        // If failed, user stays on login page (logout was called by handleTokenFromRedirect)
      });
    }
  }, [searchParams, router, handleTokenFromRedirect]);

  // Check for session expired redirect
  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setSessionExpiredMessage("Your session has expired. Please log in again.");
      // Clean up the URL without triggering a reload
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSessionExpiredMessage("");
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        router.push("/dashboard");
      } else {
        setError(result.error || "Login failed. Please try again.");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    window.location.href = `${getApiBaseUrl()}/auth/microsoft_office365`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
              t
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight font-serif">
            Welcome to Teeem
          </CardTitle>
          <CardDescription>
            Enter your credentials to sign in to your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {sessionExpiredMessage && (
              <div className="p-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
                {sessionExpiredMessage}
              </div>
            )}
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="remember" />
              <Label htmlFor="remember" className="text-sm font-normal">
                Remember me for 30 days
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Microsoft 365
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                href="/signup"
                className="underline underline-offset-4 hover:text-primary"
              >
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
// Jake deploy Sun Jan 18 05:33:30 CET 2026
