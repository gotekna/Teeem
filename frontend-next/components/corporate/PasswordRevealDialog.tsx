"use client";

/**
 * PasswordRevealDialog - Password confirmation for revealing sensitive corporate data
 *
 * Prompts user for their login password before showing TFN, ASIC password, or recovery answer.
 * Calls POST /api/v1/companies/:id/reveal_sensitive to verify and fetch values.
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Lock } from "lucide-react";
import { api } from "@/lib/api";

interface SensitiveData {
  tfn?: string;
  encrypted_asic_password?: string;
  encrypted_recovery_answer?: string;
}

interface PasswordRevealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  onRevealed: (data: SensitiveData) => void;
}

export function PasswordRevealDialog({
  open,
  onOpenChange,
  companyId,
  onRevealed,
}: PasswordRevealDialogProps) {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setPassword("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await api.post<{ success: boolean; data: SensitiveData; error?: string } | null>(
        `/api/v1/companies/${companyId}/reveal_sensitive`,
        { password },
        { skipAuthRedirect: true }
      );
      if (response?.success) {
        onRevealed(response.data);
        onOpenChange(false);
      } else {
        setError(response?.error || "Verification failed");
      }
    } catch {
      setError("Invalid password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Password Required
            </DialogTitle>
            <DialogDescription>
              Enter your login password to view sensitive corporate information.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reveal-password">Password</Label>
            <Input
              ref={inputRef}
              id="reveal-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Enter your password"
              className="mt-1.5"
              autoComplete="current-password"
            />
            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner size={16} className="mr-2" />}
              Verify
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
