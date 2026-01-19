"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import axios from "axios";
import { setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

export default function PortalLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axios.post("/api/v1/portal/auth/login", {
        email,
        password,
      });

      if (response?.data.success) {
        // Store token and user data
        setStorageItem(STORAGE_KEYS.PORTAL_TOKEN, response.data.token);
        setStorageItem(STORAGE_KEYS.PORTAL_USER, response.data.user);

        // Set axios default header
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.token}`;

        // Redirect to dashboard
        router.push("/portal/dashboard");
      } else {
        setError(response.data.error || "Login failed");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid email or password");
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
            Subcontractor Access
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
          This portal is for authorized subcontractors only
        </p>
      </div>
    </div>
  );
}
