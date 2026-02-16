"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await api.post<{ success: boolean; error?: string }>(
        "/api/v1/auth/forgot_password",
        { email }
      );
      if (data?.success) {
        setSent(true);
      } else {
        setError(data?.error || "Something went wrong");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">t</span>
            </div>
          </div>
          <CardTitle className="text-2xl">{sent ? "Check your email" : "Reset your password"}</CardTitle>
          <CardDescription>
            {sent
              ? "If an account exists with that email, you'll receive a password reset link."
              : "Enter your email and we'll send you a link to reset your password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <Mail className="h-12 w-12 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Sent to <strong>{email}</strong>
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full mt-4">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-destructive text-center">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner size={16} className="mr-2" />
                    Sending...
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
              <Link href="/login" className="block text-center">
                <Button variant="link" className="text-sm" type="button">
                  <ArrowLeft className="mr-1 h-3 w-3" />
                  Back to login
                </Button>
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
