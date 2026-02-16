"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import MultipleSelector, { type Option } from "@/components/ui/multiple-selector";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { User as UserIcon, Mail, Shield, Calendar, Clock, Sun, Moon, Briefcase, ExternalLink, Star, Loader2, PenLine, Lock, Send, KeyRound } from "lucide-react";
import { SIGNATURE_STYLES, type SignatureStyleId, DEFAULT_SIGNATURE_STYLE, CUSTOM_SIGNATURE_ID } from "@/lib/email-signature";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import type { Role, User } from '@/lib/types';

interface UserDetailSheetProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function UserDetailSheet({ user, isOpen, onClose, onSave }: UserDetailSheetProps) {
  const router = useRouter();
  const [editData, setEditData] = useState<Partial<User>>({});
  const [fullUser, setFullUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [showInviteConfirm, setShowInviteConfirm] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const { toast } = useToast();

  // Signature force mode state (Jan 2026)
  const [signatureForced, setSignatureForced] = useState(false);
  const [forcedSignatureStyle, setForcedSignatureStyle] = useState<string>("");
  const [customSignatureName, setCustomSignatureName] = useState<string>("Company Custom");
  const [hasCustomSignature, setHasCustomSignature] = useState(false);

  // Load available roles, full user data, and company settings when sheet opens
  // SSoT: /api/v1/users/:id returns role_ids, Foundation API doesn't
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        // Fetch roles, user data, and company settings in parallel
        const [rolesResponse, userResponse, companyResponse] = await Promise.all([
          api.get<Array<{ id: number; value: string; label: string }>>("/api/v1/roles"),
          api.get<User>(`/api/v1/users/${user.id}`),
          api.get<{ success: boolean; data?: {
            force_email_signature?: boolean;
            forced_signature_style?: string;
            custom_email_signature_html?: string;
            custom_email_signature_name?: string;
          } }>("/api/v1/company_settings"),
        ]);

        // SSoT: RolesController#index returns array of { id, value, label }
        if (Array.isArray(rolesResponse)) {
          setRoles(rolesResponse.map(r => ({
            id: r.id,
            name: r.value,
            display_name: r.label,
          })));
        }

        // SSoT: UsersController#show returns full user with role_ids
        if (userResponse) {
          setFullUser(userResponse);
        }

        // Company signature settings (Jan 2026)
        if (companyResponse?.success && companyResponse.data) {
          setSignatureForced(companyResponse.data.force_email_signature || false);
          setForcedSignatureStyle(companyResponse.data.forced_signature_style || "");
          setHasCustomSignature(!!companyResponse.data.custom_email_signature_html);
          setCustomSignatureName(companyResponse.data.custom_email_signature_name || "Company Custom");
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && user?.id) {
      loadData();
    } else {
      setFullUser(null);
    }
  }, [isOpen, user?.id]);

  // Initialize edit data when full user data is loaded
  // Phase 5: User sheet focuses on auth - profile info managed via Contact
  useEffect(() => {
    const userData = fullUser || user;
    if (userData) {
      setEditData({
        email: userData.email,
        job_title: userData.job_title || "",
        // SSoT: Always ensure role_ids is an array to prevent .map errors
        role_ids: Array.isArray(userData.role_ids) ? userData.role_ids : [],
        preferred_theme: userData.preferred_theme || "light",
        // Primary role (Jan 2026)
        primary_role_id: userData.primary_role_id || null,
        // Email signature style (Jan 2026)
        email_signature_style: userData.email_signature_style || DEFAULT_SIGNATURE_STYLE,
      });
    }
  }, [fullUser, user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Extract role IDs from the selected options
      // SSoT: Always ensure role_ids is an array before calling .map
      const roleIdsData = Array.isArray(editData.role_ids) ? editData.role_ids : [];
      const roleIds = roleIdsData.map((r: { id: number }) => r.id);

      // Phase 5: User sheet only edits auth fields
      // Name/mobile/address managed via Contact (linked automatically)
      const response = await api.patch<{ success: boolean }>(
        `/api/v1/users/${user.id}`,
        {
          user: {
            email: editData.email,
            job_title: editData.job_title,
            role_ids: roleIds,
            preferred_theme: editData.preferred_theme,
            // Primary role (Jan 2026)
            primary_role_id: editData.primary_role_id,
            // Email signature style (Jan 2026)
            email_signature_style: editData.email_signature_style,
          },
        }
      );

      if (response?.success) {
        toast({
          title: "Success",
          description: "User updated successfully",
        });
        onSave();
        onClose();
      }
    } catch (error) {
      console.error("Update error:", error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvite = async () => {
    if (!user) return;

    setSendingInvite(true);
    try {
      const response = await api.post<{ success: boolean; compose?: boolean; user_email?: string; user_name?: string; reset_token?: string; message?: string; error?: string }>(
        `/api/v1/users/${user.id}/send_invite`,
        { compose_mode: true }
      );

      if (response?.success && response?.compose) {
        // Password reset URL uses current frontend origin (works in any environment)
        const resetUrl = `${window.location.origin}/reset-password?token=${encodeURIComponent(response.reset_token || "")}`;
        const firstName = (response.user_name || "").split(" ")[0] || "there";

        const subject = encodeURIComponent("Welcome to Teeem - Your Account is Ready");
        const body = encodeURIComponent(
          `<p>Hi ${firstName},</p>` +
          `<p>Welcome to Teeem - your complete business management system.</p>` +
          `<p>Your account has been created and is ready to go:</p>` +
          `<p><strong><a href="${resetUrl}">Click here to set your password and login</a></strong></p>` +
          `<p>Teeem brings together your jobs, contacts, documents, emails, scheduling, and finances in one place. If you need any help getting started, just reply to this email.</p>` +
          `<p>Best regards</p>`
        );
        const to = encodeURIComponent(response.user_email || user.email);
        setShowInviteConfirm(false);
        onClose();
        router.push(`/email?compose_to=${to}&compose_subject=${subject}&compose_body=${body}&compose_from=${encodeURIComponent("setup@teeem.com.au")}`);
      } else if (response?.success) {
        toast({
          title: "Login email sent",
          description: response.message || `Login credentials sent to ${user.email}`,
        });
        setShowInviteConfirm(false);
      } else {
        toast({
          title: "Error",
          description: response?.error || "Failed to send login email",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Send invite error:", error);
      toast({
        title: "Error",
        description: "Failed to send login email",
        variant: "destructive",
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleSendResetPassword = async () => {
    if (!user) return;
    setSendingReset(true);
    try {
      const response = await api.post<{ success: boolean; message?: string }>("/api/v1/auth/forgot_password", { email: user.email });
      toast({
        title: "Reset email sent",
        description: `Password reset link sent to ${user.email}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send reset password email",
        variant: "destructive",
      });
    } finally {
      setSendingReset(false);
    }
  };

  // Convert roles to MultipleSelector options
  const roleOptions: Option[] = roles.map((r) => ({
    value: String(r.id),
    label: r.display_name || r.name,
  }));

  // Get selected role options
  // SSoT: Always ensure role_ids is an array before calling .map
  const roleIdsArray = Array.isArray(editData.role_ids) ? editData.role_ids : [];
  const selectedRoleIds = roleIdsArray.map((r: { id: number }) => String(r.id));
  const selectedOptions = roleOptions.filter((opt) => selectedRoleIds.includes(opt.value));

  // Use fullUser (from API) if available, fallback to prop
  const displayUser = fullUser || user;

  // Get Contact display name for header
  const contactDisplayName = displayUser?.contact?.display_name
    || (displayUser?.contact?.first_name && displayUser?.contact?.last_name
      ? `${displayUser.contact.first_name} ${displayUser.contact.last_name}`
      : displayUser?.name) || "Unknown User";

  if (!user) return null;

  return (
    <>
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            User Account
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Contact Profile Card with status badges */}
          <div className="p-3 rounded-lg border bg-muted/30 dark:bg-muted/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-semibold">{contactDisplayName}</p>
                  <div className="flex gap-1.5 mt-1">
                    {displayUser?.presence_status === "online" && (
                      <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400 text-xs px-1.5 py-0">
                        Online
                      </Badge>
                    )}
                    {displayUser?.status === "active" && displayUser?.presence_status !== "online" && (
                      <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs px-1.5 py-0">
                        Active
                      </Badge>
                    )}
                    {displayUser?.status === "pending" && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">Pending</Badge>
                    )}
                    {displayUser?.integrations?.includes("microsoft") && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">MS</Badge>
                    )}
                  </div>
                </div>
              </div>
              {displayUser?.contact_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8"
                  onClick={() => {
                    const contactId = displayUser.contact_id && typeof displayUser.contact_id === 'object' ? (displayUser.contact_id as unknown as { id: number }).id : displayUser.contact_id;
                    onClose();
                    router.push(`/contacts/${contactId}`);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Personal Details
                </Button>
              )}
            </div>
          </div>

          {/* Login Email */}
          <div className="space-y-1">
            <Label htmlFor="email" className="flex items-center gap-1.5 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Login Email
            </Label>
            <Input
              id="email"
              type="email"
              value={editData.email || ""}
              onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              className="h-9"
            />
          </div>

          {/* Job Title */}
          <div className="space-y-1">
            <Label htmlFor="job_title" className="flex items-center gap-1.5 text-sm">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              Job Title
            </Label>
            <Input
              id="job_title"
              value={editData.job_title || ""}
              onChange={(e) => setEditData({ ...editData, job_title: e.target.value })}
              placeholder="e.g. Sales, Project Manager"
              className="h-9"
            />
          </div>

          {/* Roles - Multi-select */}
          <div className="space-y-1">
            <Label className="flex items-center gap-1.5 text-sm">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              Roles
            </Label>
            <MultipleSelector
              value={selectedOptions}
              onChange={(selected) => {
                const newRoleIds = selected.map((opt) => {
                  const role = roles.find((r) => String(r.id) === opt.value);
                  return role ? { id: role.id, display_value: role.display_name, name: role.name } : null;
                }).filter(Boolean);
                setEditData({ ...editData, role_ids: newRoleIds as Array<{ id: number; display_value: string; name: string }> });
              }}
              options={roleOptions}
              placeholder="Select roles..."
              emptyIndicator={
                <p className="text-center text-sm text-muted-foreground py-1">
                  No roles available
                </p>
              }
            />
          </div>

          {/* Primary Role & Theme - side by side when Primary Role shown */}
          <div className={roleIdsArray.length > 1 ? "grid grid-cols-2 gap-3" : ""}>
            {/* Primary Role - Only shown when user has 2+ roles */}
            {roleIdsArray.length > 1 && (
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Star className="h-3.5 w-3.5 text-muted-foreground" />
                  Primary Role
                </Label>
                <Select
                  value={editData.primary_role_id?.toString() || ""}
                  onValueChange={(value) => setEditData({ ...editData, primary_role_id: parseInt(value, 10) })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roleIdsArray.map((r: { id: number; display_value: string }) => (
                      <SelectItem key={r.id} value={r.id.toString()}>
                        {r.display_value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Theme Preference */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-sm">
                {editData.preferred_theme === "dark" ? (
                  <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                Theme
              </Label>
              <Select
                value={editData.preferred_theme || "light"}
                onValueChange={(value) => setEditData({ ...editData, preferred_theme: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Email Signature Style (Jan 2026) */}
          <div className="space-y-1">
            <Label className="flex items-center gap-1.5 text-sm">
              {signatureForced ? (
                <Lock className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              Email Signature
              {signatureForced && (
                <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400">
                  Company Required
                </Badge>
              )}
            </Label>
            {signatureForced ? (
              <div className="h-9 px-3 py-2 rounded-md border bg-muted/50 text-sm text-muted-foreground flex items-center">
                {forcedSignatureStyle === CUSTOM_SIGNATURE_ID
                  ? customSignatureName
                  : SIGNATURE_STYLES.find(s => s.id === forcedSignatureStyle)?.name || "Company Signature"}
              </div>
            ) : (
              <Select
                value={editData.email_signature_style || DEFAULT_SIGNATURE_STYLE}
                onValueChange={(value) => setEditData({ ...editData, email_signature_style: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select signature style" />
                </SelectTrigger>
                <SelectContent>
                  {/* Custom company signature (if exists) - shown first */}
                  {hasCustomSignature && (
                    <SelectItem value={CUSTOM_SIGNATURE_ID}>
                      {customSignatureName}
                    </SelectItem>
                  )}
                  {/* Built-in styles */}
                  {SIGNATURE_STYLES.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Read-only info - compact single line */}
          <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Created {displayUser?.created_at ? format(new Date(displayUser.created_at), "d MMM yyyy") : "Unknown"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last login {displayUser?.last_login_at ? format(new Date(displayUser.last_login_at), "d MMM yyyy") : "Never"}
            </span>
          </div>

          {/* Email Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowInviteConfirm(true)}
              disabled={sendingInvite}
              className="flex-1 h-9 gap-2"
            >
              {sendingInvite ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sendingInvite ? "Sending..." : displayUser?.last_login_at ? "Resend Welcome Email" : "Send Login Email"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSendResetPassword}
              disabled={sendingReset}
              className="flex-1 h-9 gap-2"
            >
              {sendingReset ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {sendingReset ? "Sending..." : "Reset Password"}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 h-9">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={onClose} className="h-9">
              Cancel
            </Button>
          </div>
        </div>

      </SheetContent>
    </Sheet>

    {/* Send Login Email Confirmation Dialog - outside Sheet so it renders above the Sheet overlay */}
    <AlertDialog open={showInviteConfirm} onOpenChange={setShowInviteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send Login Email</AlertDialogTitle>
          <AlertDialogDescription>
            This will generate a temporary password and send login credentials to{" "}
            <span className="font-medium text-foreground">{displayUser?.email}</span>.
            The user will be required to change their password on first login.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={sendingInvite}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSendInvite} disabled={sendingInvite}>
            {sendingInvite ? "Sending..." : "Send Email"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
