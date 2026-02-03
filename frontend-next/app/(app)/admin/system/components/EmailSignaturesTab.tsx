"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, Mail, Building2, User, Lock, AlertTriangle, Pencil, X, Save, Inbox, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { EmailAccount } from "@/lib/email-types";
import {
  SIGNATURE_STYLES,
  generateSignatureByStyle,
  type SignatureStyleId,
  type SignatureUserData,
  type SignatureCompanyData,
  DEFAULT_SIGNATURE_STYLE,
  CUSTOM_SIGNATURE_ID,
} from "@/lib/email-signature";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * EmailSignaturesTab - Email signature style selector
 *
 * Features:
 * - Users choose from 10 pre-designed styles OR a custom company signature
 * - Admin can create a custom company signature with HTML template
 * - Admin can FORCE a signature on all users (no override allowed)
 * - Live previews with user's actual data
 *
 * SSoT: Signature styles defined in lib/email-signature.ts
 */

interface UserWithSignature {
  id: number;
  name: string;
  email: string;
  mobile_phone?: string;
  job_title?: string;
  email_signature_style?: string;
  permissions?: string[];
}

interface CompanySettingsResponse {
  company_name?: string;
  logo_dark?: string;
  logo_url?: string;
  address?: string;
  website?: string;
  phone?: string;
  brand_colors?: {
    primary?: string;
    primaryForeground?: string;
  };
  default_email_signature_style?: string;
  // Custom signature (Jan 2026)
  custom_email_signature_html?: string;
  custom_email_signature_name?: string;
  // Force mode (Jan 2026)
  force_email_signature?: boolean;
  forced_signature_style?: string;
}

export function EmailSignaturesTab() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [savingCompanyDefault, setSavingCompanyDefault] = useState(false);
  const [savingForce, setSavingForce] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<SignatureStyleId>(DEFAULT_SIGNATURE_STYLE);
  const [companyDefaultStyle, setCompanyDefaultStyle] = useState<SignatureStyleId>(DEFAULT_SIGNATURE_STYLE);
  const [companySettings, setCompanySettings] = useState<SignatureCompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  // Force mode state
  const [forceEnabled, setForceEnabled] = useState(false);
  const [forcedStyle, setForcedStyle] = useState<SignatureStyleId | "">("");

  // Custom signature state
  const [customHtml, setCustomHtml] = useState("");
  const [customName, setCustomName] = useState("Company Custom");
  const [editingCustom, setEditingCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const [customNameDraft, setCustomNameDraft] = useState("");

  // SSoT (Feb 2026): Per-account signatures
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountSignatureDraft, setAccountSignatureDraft] = useState("");
  const [savingAccountSignature, setSavingAccountSignature] = useState(false);
  const [accountSignaturesExpanded, setAccountSignaturesExpanded] = useState(true);

  // Check if user is admin
  const userWithSig = user as UserWithSignature;
  const isAdmin = userWithSig?.permissions?.includes('admin') ||
                  userWithSig?.permissions?.includes('manage_settings');

  // Load company settings
  useEffect(() => {
    const loadCompanySettings = async () => {
      try {
        const response = await api.get<{ success: boolean; data?: CompanySettingsResponse }>("/api/v1/company_settings");
        if (response?.success && response.data) {
          const data = response.data;
          setCompanySettings({
            name: data.company_name,
            logo_dark: data.logo_dark,
            logo_light: data.logo_url,
            address: data.address,
            website: data.website,
            phone: data.phone,
            brand_color: data.brand_colors?.primary,
            brand_color_foreground: data.brand_colors?.primaryForeground,
          });
          setCompanyDefaultStyle((data.default_email_signature_style as SignatureStyleId) || DEFAULT_SIGNATURE_STYLE);

          // Custom signature
          setCustomHtml(data.custom_email_signature_html || "");
          setCustomName(data.custom_email_signature_name || "Company Custom");

          // Force mode
          setForceEnabled(data.force_email_signature || false);
          setForcedStyle((data.forced_signature_style as SignatureStyleId) || "");
        }
      } catch (error) {
        console.error("Failed to load company settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCompanySettings();
  }, []);

  // Initialize selected style from user preference
  useEffect(() => {
    if (user) {
      const style = (userWithSig.email_signature_style as SignatureStyleId) || DEFAULT_SIGNATURE_STYLE;
      setSelectedStyle(style);
    }
  }, [user]);

  // SSoT (Feb 2026): Fetch email accounts for per-account signature configuration
  const fetchEmailAccounts = useCallback(async () => {
    if (!isAdmin) return;
    setAccountsLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: EmailAccount[] }>("/api/v1/imap_credentials/all_accounts");
      if (response?.success && response.data) {
        setEmailAccounts(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch email accounts:", error);
    } finally {
      setAccountsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchEmailAccounts();
    }
  }, [isAdmin, fetchEmailAccounts]);

  // Save signature for a specific account
  const handleSaveAccountSignature = async (account: EmailAccount) => {
    setSavingAccountSignature(true);
    try {
      const payload: { account_id: string; signature_html: string; mailbox_email?: string } = {
        account_id: String(account.id),
        signature_html: accountSignatureDraft,
      };

      // For MS365 accounts, include the mailbox email
      if (account.type === "ms365") {
        payload.mailbox_email = account.email_address;
      }

      const response = await api.put<{ success: boolean; error?: string }>(
        "/api/v1/imap_credentials/update_account_signature",
        payload
      );

      if (response?.success) {
        toast.success(`Signature updated for ${account.email_address}`);
        setEditingAccountId(null);
        // Refresh accounts to get updated signatures
        await fetchEmailAccounts();
      } else {
        toast.error(response?.error || "Failed to update signature");
      }
    } catch (error) {
      console.error("Failed to save account signature:", error);
      toast.error("Failed to save signature");
    } finally {
      setSavingAccountSignature(false);
    }
  };

  const startEditingAccountSignature = (account: EmailAccount) => {
    setEditingAccountId(String(account.id));
    setAccountSignatureDraft(account.email_signature || "");
  };

  const getUserData = (): SignatureUserData => {
    if (!user) {
      return {
        name: "John Smith",
        email: "john.smith@example.com",
        mobile_phone: "0412 345 678",
        job_title: "Project Manager",
      };
    }
    return {
      name: userWithSig.name || "Your Name",
      email: userWithSig.email || "your@email.com",
      mobile_phone: userWithSig.mobile_phone,
      job_title: userWithSig.job_title,
    };
  };

  const handleSelectStyle = async (styleId: SignatureStyleId) => {
    if (!user || forceEnabled) return;

    setSelectedStyle(styleId);
    setSaving(true);

    try {
      const response = await api.patch<{ success: boolean; errors?: string[] }>(
        `/api/v1/users/${user.id}`,
        { user: { email_signature_style: styleId } }
      );

      if (response?.success) {
        toast.success("Email signature updated");
        if (refreshUser) {
          await refreshUser();
        }
      } else {
        toast.error("Failed to save signature preference");
        setSelectedStyle((userWithSig.email_signature_style as SignatureStyleId) || DEFAULT_SIGNATURE_STYLE);
      }
    } catch (error) {
      console.error("Failed to update signature style:", error);
      toast.error("Failed to save signature preference");
      setSelectedStyle((userWithSig.email_signature_style as SignatureStyleId) || DEFAULT_SIGNATURE_STYLE);
    } finally {
      setSaving(false);
    }
  };

  const handleSetCompanyDefault = async (styleId: SignatureStyleId) => {
    if (!isAdmin) return;

    setSavingCompanyDefault(true);

    try {
      const response = await api.patch<{ success: boolean; error?: string }>(
        `/api/v1/company_settings`,
        { company_setting: { default_email_signature_style: styleId } }
      );

      if (response?.success) {
        setCompanyDefaultStyle(styleId);
        const styleName = styleId === CUSTOM_SIGNATURE_ID ? customName : SIGNATURE_STYLES.find(s => s.id === styleId)?.name;
        toast.success(`Company default signature set to "${styleName}"`);
      } else {
        toast.error(response?.error || "Failed to update company default");
      }
    } catch (error) {
      console.error("Failed to update company default:", error);
      toast.error("Failed to update company default");
    } finally {
      setSavingCompanyDefault(false);
    }
  };

  const handleToggleForce = async (enabled: boolean) => {
    if (!isAdmin) return;

    setSavingForce(true);

    try {
      const response = await api.patch<{ success: boolean; error?: string }>(
        `/api/v1/company_settings`,
        { company_setting: { force_email_signature: enabled } }
      );

      if (response?.success) {
        setForceEnabled(enabled);
        toast.success(enabled ? "Signature is now forced for all users" : "Users can now choose their signature");
      } else {
        toast.error(response?.error || "Failed to update force setting");
      }
    } catch (error) {
      console.error("Failed to update force setting:", error);
      toast.error("Failed to update force setting");
    } finally {
      setSavingForce(false);
    }
  };

  const handleSetForcedStyle = async (styleId: string) => {
    if (!isAdmin) return;

    setSavingForce(true);

    try {
      const response = await api.patch<{ success: boolean; error?: string }>(
        `/api/v1/company_settings`,
        { company_setting: { forced_signature_style: styleId } }
      );

      if (response?.success) {
        setForcedStyle(styleId as SignatureStyleId);
        const styleName = styleId === CUSTOM_SIGNATURE_ID ? customName : SIGNATURE_STYLES.find(s => s.id === styleId)?.name;
        toast.success(`Forced signature set to "${styleName}"`);
      } else {
        toast.error(response?.error || "Failed to update forced style");
      }
    } catch (error) {
      console.error("Failed to update forced style:", error);
      toast.error("Failed to update forced style");
    } finally {
      setSavingForce(false);
    }
  };

  const handleSaveCustomSignature = async () => {
    if (!isAdmin) return;

    setSavingCustom(true);

    try {
      const response = await api.patch<{ success: boolean; error?: string }>(
        `/api/v1/company_settings`,
        {
          company_setting: {
            custom_email_signature_html: customDraft,
            custom_email_signature_name: customNameDraft,
          }
        }
      );

      if (response?.success) {
        setCustomHtml(customDraft);
        setCustomName(customNameDraft);
        setEditingCustom(false);
        toast.success("Custom signature saved");
      } else {
        toast.error(response?.error || "Failed to save custom signature");
      }
    } catch (error) {
      console.error("Failed to save custom signature:", error);
      toast.error("Failed to save custom signature");
    } finally {
      setSavingCustom(false);
    }
  };

  const startEditingCustom = () => {
    setCustomDraft(customHtml);
    setCustomNameDraft(customName);
    setEditingCustom(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  const userData = getUserData();
  const hasCustomSignature = !!customHtml;

  // Build the list of all available styles (including custom if exists)
  const allStyles = [
    ...SIGNATURE_STYLES.map(s => ({ id: s.id, name: s.name, description: s.description })),
    ...(hasCustomSignature ? [{ id: CUSTOM_SIGNATURE_ID, name: customName, description: "Custom company signature" }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium">Email Signatures</h3>
        <p className="text-sm text-muted-foreground">
          Choose your default email signature style. The preview shows how your signature will appear.
        </p>
      </div>

      {/* Force Mode Warning (for non-admins when force is enabled) */}
      {forceEnabled && !isAdmin && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Signature is set by your company</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Your company requires all users to use the "{forcedStyle === CUSTOM_SIGNATURE_ID ? customName : SIGNATURE_STYLES.find(s => s.id === forcedStyle)?.name}" signature.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Controls */}
      {isAdmin && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Admin Controls
            </CardTitle>
            <CardDescription>
              Manage company-wide signature settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Force Signature Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-background">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Force Signature for All Users
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, all users must use the selected signature. They cannot choose their own.
                </p>
              </div>
              <Switch
                checked={forceEnabled}
                onCheckedChange={handleToggleForce}
                disabled={savingForce}
              />
            </div>

            {/* Forced Style Selector (only when force is enabled) */}
            {forceEnabled && (
              <div className="flex items-center gap-4 p-4 rounded-lg border bg-background">
                <div className="flex-1">
                  <Label className="mb-2 block">Required Signature Style</Label>
                  <Select
                    value={forcedStyle}
                    onValueChange={handleSetForcedStyle}
                    disabled={savingForce}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select signature to force..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allStyles.map((style) => (
                        <SelectItem key={style.id} value={style.id}>
                          {style.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Custom Signature Editor */}
            <div className="p-4 rounded-lg border bg-background space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Custom Company Signature
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a custom HTML signature template for your company.
                  </p>
                </div>
                {!editingCustom && (
                  <Button variant="outline" size="sm" onClick={startEditingCustom}>
                    {hasCustomSignature ? "Edit" : "Create"}
                  </Button>
                )}
              </div>

              {editingCustom && (
                <div className="space-y-4 pt-2">
                  <div>
                    <Label htmlFor="custom-name" className="text-sm">Signature Name</Label>
                    <Input
                      id="custom-name"
                      value={customNameDraft}
                      onChange={(e) => setCustomNameDraft(e.target.value)}
                      placeholder="e.g., Tekna Official"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom-html" className="text-sm">HTML Template</Label>
                    <Textarea
                      id="custom-html"
                      value={customDraft}
                      onChange={(e) => setCustomDraft(e.target.value)}
                      placeholder={`<table cellpadding="0" cellspacing="0">
  <tr>
    <td>
      <strong>{{name}}</strong><br>
      {{job_title}}<br>
      {{email}} | {{mobile}}<br>
      {{company}} - {{website}}
    </td>
  </tr>
</table>`}
                      className="mt-1 font-mono text-xs h-48"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Available tokens: {"{{name}}"}, {"{{email}}"}, {"{{job_title}}"}, {"{{mobile}}"}, {"{{company}}"}, {"{{website}}"}, {"{{address}}"}, {"{{phone}}"}, {"{{logo}}"}
                    </p>
                  </div>

                  {/* Preview */}
                  {customDraft && (
                    <div>
                      <Label className="text-sm">Preview</Label>
                      <div className="mt-1 p-4 bg-white rounded-md border">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: generateSignatureByStyle(CUSTOM_SIGNATURE_ID, userData, companySettings || undefined, customDraft)
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={handleSaveCustomSignature} disabled={savingCustom}>
                      {savingCustom ? <Spinner size={14} className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Custom Signature
                    </Button>
                    <Button variant="outline" onClick={() => setEditingCustom(false)}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!editingCustom && hasCustomSignature && (
                <div className="pt-2">
                  <Label className="text-sm">Current Custom Signature: {customName}</Label>
                  <div className="mt-2 p-3 bg-white rounded-md border overflow-hidden">
                    <div
                      className="transform scale-[0.7] origin-top-left w-[143%]"
                      dangerouslySetInnerHTML={{
                        __html: generateSignatureByStyle(CUSTOM_SIGNATURE_ID, userData, companySettings || undefined, customHtml)
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SSoT (Feb 2026): Per-Account Signatures */}
      {isAdmin && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Inbox className="h-4 w-4" />
                  Per-Account Signatures
                </CardTitle>
                <CardDescription>
                  Configure unique signatures for each email account/mailbox
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAccountSignaturesExpanded(!accountSignaturesExpanded)}
              >
                {accountSignaturesExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {accountSignaturesExpanded && (
            <CardContent className="space-y-4">
              {accountsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={24} />
                </div>
              ) : emailAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No email accounts configured. Add accounts in System → Email Accounts.
                </p>
              ) : (
                <div className="space-y-3">
                  {emailAccounts.map((account) => {
                    const isEditing = editingAccountId === String(account.id);
                    const hasSignature = !!account.email_signature;

                    return (
                      <div
                        key={account.id}
                        className={cn(
                          "p-4 rounded-lg border bg-background",
                          isEditing && "ring-2 ring-primary"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {account.email_address}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {account.type === "ms365" ? "Microsoft 365" : account.type === "imap" ? "IMAP" : account.type}
                              </Badge>
                              {account.name && account.name !== account.email_address && (
                                <span className="text-xs text-muted-foreground">
                                  ({account.name})
                                </span>
                              )}
                            </div>
                            {!isEditing && (
                              <div className="mt-2">
                                {hasSignature ? (
                                  <div className="text-xs text-muted-foreground">
                                    <span className="text-green-600 dark:text-green-400">✓ Custom signature configured</span>
                                    <div className="mt-1 p-2 bg-white rounded border max-h-24 overflow-hidden">
                                      <div
                                        className="transform scale-[0.5] origin-top-left w-[200%]"
                                        dangerouslySetInnerHTML={{ __html: account.email_signature || "" }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-amber-600 dark:text-amber-400">
                                    No custom signature (will use user default)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {!isEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditingAccountSignature(account)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              {hasSignature ? "Edit" : "Add"}
                            </Button>
                          )}
                        </div>

                        {isEditing && (
                          <div className="mt-4 space-y-4">
                            <div>
                              <Label className="text-sm">Signature HTML</Label>
                              <Textarea
                                value={accountSignatureDraft}
                                onChange={(e) => setAccountSignatureDraft(e.target.value)}
                                placeholder={`<div style="font-family: Arial, sans-serif;">
  <p><strong>Best regards,</strong></p>
  <p>Name<br>
  Job Title<br>
  ${account.email_address}</p>
</div>`}
                                className="mt-1 font-mono text-xs h-32"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Enter full HTML for signature. Use inline styles for email compatibility.
                              </p>
                            </div>

                            {accountSignatureDraft && (
                              <div>
                                <Label className="text-sm">Preview</Label>
                                <div className="mt-1 p-3 bg-white rounded border">
                                  <div dangerouslySetInnerHTML={{ __html: accountSignatureDraft }} />
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveAccountSignature(account)}
                                disabled={savingAccountSignature}
                              >
                                {savingAccountSignature ? (
                                  <Spinner size={14} className="mr-2" />
                                ) : (
                                  <Save className="h-3 w-3 mr-1" />
                                )}
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingAccountId(null)}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                              {hasSignature && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setAccountSignatureDraft("");
                                  }}
                                >
                                  Clear
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-muted-foreground pt-2 border-t">
                <strong>Note:</strong> When composing an email, the signature from the selected account will be used.
                If an account has no custom signature, the user's default style will be applied.
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Style Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Custom signature card (if exists) - shown first */}
        {hasCustomSignature && (
          <Card
            className={cn(
              "relative transition-all",
              !forceEnabled && "cursor-pointer hover:shadow-md",
              selectedStyle === CUSTOM_SIGNATURE_ID && "ring-2 ring-primary border-primary",
              companyDefaultStyle === CUSTOM_SIGNATURE_ID && selectedStyle !== CUSTOM_SIGNATURE_ID && "ring-1 ring-blue-400 border-blue-400",
              forceEnabled && forcedStyle === CUSTOM_SIGNATURE_ID && "ring-2 ring-amber-500 border-amber-500",
              forceEnabled && "opacity-80"
            )}
            onClick={() => !saving && !forceEnabled && handleSelectStyle(CUSTOM_SIGNATURE_ID)}
          >
            <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
              {forceEnabled && forcedStyle === CUSTOM_SIGNATURE_ID && (
                <Badge className="bg-amber-500 text-white gap-1">
                  <Lock className="h-3 w-3" />
                  Required
                </Badge>
              )}
              {selectedStyle === CUSTOM_SIGNATURE_ID && !forceEnabled && (
                <Badge className="bg-primary text-primary-foreground gap-1">
                  <User className="h-3 w-3" />
                  Your Choice
                </Badge>
              )}
              {companyDefaultStyle === CUSTOM_SIGNATURE_ID && !forceEnabled && (
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 gap-1">
                  <Building2 className="h-3 w-3" />
                  Company Default
                </Badge>
              )}
            </div>

            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {customName}
              </CardTitle>
              <CardDescription className="text-xs">
                Custom company signature
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="h-[180px] overflow-hidden bg-white rounded-md border">
                <div
                  className="p-2 transform scale-[0.65] origin-top-left w-[154%]"
                  dangerouslySetInnerHTML={{
                    __html: generateSignatureByStyle(CUSTOM_SIGNATURE_ID, userData, companySettings || undefined, customHtml)
                  }}
                />
              </div>

              {!forceEnabled && (
                <div className="mt-3 space-y-2">
                  <Button
                    variant={selectedStyle === CUSTOM_SIGNATURE_ID ? "secondary" : "outline"}
                    size="sm"
                    className="w-full"
                    disabled={saving || selectedStyle === CUSTOM_SIGNATURE_ID}
                  >
                    {saving && selectedStyle === CUSTOM_SIGNATURE_ID ? (
                      <>
                        <Spinner size={14} className="mr-2" />
                        Saving...
                      </>
                    ) : selectedStyle === CUSTOM_SIGNATURE_ID ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Selected
                      </>
                    ) : (
                      "Select for Me"
                    )}
                  </Button>

                  {isAdmin && companyDefaultStyle !== CUSTOM_SIGNATURE_ID && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                      disabled={savingCompanyDefault}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetCompanyDefault(CUSTOM_SIGNATURE_ID);
                      }}
                    >
                      {savingCompanyDefault ? (
                        <>
                          <Spinner size={14} className="mr-2" />
                          Setting...
                        </>
                      ) : (
                        <>
                          <Building2 className="h-4 w-4 mr-2" />
                          Set as Company Default
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Built-in signature styles */}
        {SIGNATURE_STYLES.map((style) => {
          const isSelected = selectedStyle === style.id;
          const isCompanyDefault = companyDefaultStyle === style.id;
          const isForced = forceEnabled && forcedStyle === style.id;
          const signatureHtml = generateSignatureByStyle(
            style.id,
            userData,
            companySettings || undefined
          );

          return (
            <Card
              key={style.id}
              className={cn(
                "relative transition-all",
                !forceEnabled && "cursor-pointer hover:shadow-md",
                isSelected && !forceEnabled && "ring-2 ring-primary border-primary",
                isCompanyDefault && !isSelected && !forceEnabled && "ring-1 ring-blue-400 border-blue-400",
                isForced && "ring-2 ring-amber-500 border-amber-500",
                forceEnabled && "opacity-80"
              )}
              onClick={() => !saving && !forceEnabled && handleSelectStyle(style.id)}
            >
              <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
                {isForced && (
                  <Badge className="bg-amber-500 text-white gap-1">
                    <Lock className="h-3 w-3" />
                    Required
                  </Badge>
                )}
                {isSelected && !forceEnabled && (
                  <Badge className="bg-primary text-primary-foreground gap-1">
                    <User className="h-3 w-3" />
                    Your Choice
                  </Badge>
                )}
                {isCompanyDefault && !forceEnabled && (
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 gap-1">
                    <Building2 className="h-3 w-3" />
                    Company Default
                  </Badge>
                )}
              </div>

              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {style.name}
                </CardTitle>
                <CardDescription className="text-xs">
                  {style.description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {style.id === "none" ? (
                  <div className="h-[180px] flex items-center justify-center bg-muted/30 rounded-md border border-dashed">
                    <p className="text-sm text-muted-foreground">No automatic signature</p>
                  </div>
                ) : (
                  <div className="h-[180px] overflow-hidden bg-white rounded-md border">
                    <div
                      className="p-2 transform scale-[0.65] origin-top-left w-[154%]"
                      dangerouslySetInnerHTML={{ __html: signatureHtml }}
                    />
                  </div>
                )}

                {!forceEnabled && (
                  <div className="mt-3 space-y-2">
                    <Button
                      variant={isSelected ? "secondary" : "outline"}
                      size="sm"
                      className="w-full"
                      disabled={saving || isSelected}
                    >
                      {saving && selectedStyle === style.id ? (
                        <>
                          <Spinner size={14} className="mr-2" />
                          Saving...
                        </>
                      ) : isSelected ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Selected
                        </>
                      ) : (
                        "Select for Me"
                      )}
                    </Button>

                    {isAdmin && !isCompanyDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                        disabled={savingCompanyDefault}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetCompanyDefault(style.id);
                        }}
                      >
                        {savingCompanyDefault ? (
                          <>
                            <Spinner size={14} className="mr-2" />
                            Setting...
                          </>
                        ) : (
                          <>
                            <Building2 className="h-4 w-4 mr-2" />
                            Set as Company Default
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-sm mb-2">How It Works</h4>
              <p className="text-xs text-muted-foreground">
                Your signature is automatically added when composing emails.
                It uses your name, job title, email, and phone from your profile.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Update Your Info</h4>
              <p className="text-xs text-muted-foreground">
                To change information in your signature, update your profile in Settings → Profile.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Company Settings</h4>
              <p className="text-xs text-muted-foreground">
                {forceEnabled
                  ? "Your company requires all users to use the same signature."
                  : "New users use the company default. You can choose your own preference."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
