"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

interface ChangePasswordDialogProps {
  open: boolean;
  currentPassword: string;
  onSuccess: (newToken: string) => void;
}

export function ChangePasswordDialog({ open, currentPassword, onSuccess }: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const passwordRequirements = [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
    { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
    { label: "Number", test: (p: string) => /\d/.test(p) },
    { label: "Special character", test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
  ];

  const allRequirementsMet = passwordRequirements.every((r) => r.test(newPassword));
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmit = allRequirementsMet && passwordsMatch && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError("");

    try {
      const response = await api.post<{ success: boolean; token?: string; error?: string; errors?: string[] }>(
        "/api/v1/auth/change_password",
        { current_password: currentPassword, new_password: newPassword }
      );

      if (response?.success && response.token) {
        // Update stored token
        setStorageItem(STORAGE_KEYS.TOKEN, response.token);
        document.cookie = `auth_token=${response.token}; path=/; max-age=${24 * 60 * 60}; SameSite=Lax`;
        onSuccess(response.token);
      } else {
        setError(response?.error || response?.errors?.join(", ") || "Failed to change password");
      }
    } catch (err) {
      console.error("Change password error:", err);
      setError("Failed to change password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[425px]" hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Your Password
          </DialogTitle>
          <DialogDescription>
            Your administrator has set a temporary password. Please create a new password to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          {/* Password requirements checklist */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Password requirements:</p>
            <ul className="space-y-0.5">
              {passwordRequirements.map((req) => (
                <li key={req.label} className="flex items-center gap-1.5 text-xs">
                  <span className={req.test(newPassword) ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                    {req.test(newPassword) ? "✓" : "○"}
                  </span>
                  <span className={req.test(newPassword) ? "text-foreground" : "text-muted-foreground"}>
                    {req.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Changing Password...
              </>
            ) : (
              "Set New Password"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
