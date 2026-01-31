"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Check, Mail, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  SIGNATURE_STYLES,
  generateSignatureByStyle,
  type SignatureStyleId,
  type SignatureUserData,
  type SignatureCompanyData,
  DEFAULT_SIGNATURE_STYLE,
} from "@/lib/email-signature";

/**
 * EmailSignaturesTab - Email signature style selector
 *
 * Allows users to choose from 10 pre-designed email signature styles.
 * Shows live previews with the user's actual data.
 * Saves the preference to the user's profile.
 * Admin can also set company-wide default.
 *
 * SSoT: Signature styles defined in lib/email-signature.ts
 */

// Extend user type to include email_signature_style
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
}

export function EmailSignaturesTab() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [savingCompanyDefault, setSavingCompanyDefault] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<SignatureStyleId>(DEFAULT_SIGNATURE_STYLE);
  const [companyDefaultStyle, setCompanyDefaultStyle] = useState<SignatureStyleId>(DEFAULT_SIGNATURE_STYLE);
  const [companySettings, setCompanySettings] = useState<SignatureCompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is admin
  const userWithSig = user as UserWithSignature;
  const isAdmin = userWithSig?.permissions?.includes('admin') ||
                  userWithSig?.permissions?.includes('manage_settings');

  // Load company settings for signature previews
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
          // Set company default
          setCompanyDefaultStyle((data.default_email_signature_style as SignatureStyleId) || DEFAULT_SIGNATURE_STYLE);
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

  // Get user data for signature preview
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
    if (!user) return;

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
        toast.success(`Company default signature set to "${SIGNATURE_STYLES.find(s => s.id === styleId)?.name}"`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  const userData = getUserData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium">Email Signatures</h3>
        <p className="text-sm text-muted-foreground">
          Choose your default email signature style. The preview shows how your signature will appear using your profile information.
        </p>
        {isAdmin && (
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
            <Building2 className="h-3.5 w-3.5 inline mr-1" />
            As an admin, you can also set the company-wide default for all users.
          </p>
        )}
      </div>

      {/* Style Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SIGNATURE_STYLES.map((style) => {
          const isSelected = selectedStyle === style.id;
          const isCompanyDefault = companyDefaultStyle === style.id;
          const signatureHtml = generateSignatureByStyle(
            style.id,
            userData,
            companySettings || undefined
          );

          return (
            <Card
              key={style.id}
              className={cn(
                "relative cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary border-primary",
                isCompanyDefault && !isSelected && "ring-1 ring-blue-400 border-blue-400"
              )}
              onClick={() => !saving && handleSelectStyle(style.id)}
            >
              {/* Badges */}
              <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
                {isSelected && (
                  <Badge className="bg-primary text-primary-foreground gap-1">
                    <User className="h-3 w-3" />
                    Your Choice
                  </Badge>
                )}
                {isCompanyDefault && (
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
                {/* Signature Preview */}
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

                {/* Action Buttons */}
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

                  {/* Admin: Set as Company Default */}
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
                Your selected signature style will be automatically added to new emails you compose.
                The signature includes your name, job title, email, and phone from your profile.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Update Your Info</h4>
              <p className="text-xs text-muted-foreground">
                To change the information displayed in your signature, update your profile in
                Settings &gt; Profile. Changes will reflect in your signature immediately.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Company Default</h4>
              <p className="text-xs text-muted-foreground">
                New users automatically use the company default signature.
                Users can override this with their own preference at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
