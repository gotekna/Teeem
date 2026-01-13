"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, HardHat, Building2, LayoutGrid, PenTool, X, Check, History, FileText, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

// Signature usage type
interface SignatureUsage {
  id: number;
  signed_at: string;
  signed_at_formatted: string;
  certificate_type: string;
  certificate_type_display: string;
  document_name: string;
  purpose: string;
  job?: {
    id: number;
    job_code: string;
    name: string;
    address: string;
  };
  document_type?: {
    id: number;
    name: string;
    display_name: string;
  };
}
import {
  Persona,
  PERSONA_CONFIG,
  PERSONA_ORDER,
  getStoredPersona,
  setStoredPersona,
} from "@/lib/personas";

// QBCC Licence Classes relevant for Form 43 certificates
const QBCC_LICENCE_CLASSES = [
  "Builder - Low Rise",
  "Builder - Medium Rise",
  "Builder - Open",
  "Trade Contractor - Insulation",
  "Trade Contractor - Waterproofing",
  "Trade Contractor - Electrical",
  "Trade Contractor - Plumbing",
  "Trade Contractor - Fire Protection",
  "Trade Contractor - Termite Management",
  "Trade Contractor - Glazing",
  "Trade Contractor - Roofing",
  "Site Supervisor - Low Rise",
  "Site Supervisor - Medium Rise",
  "Site Supervisor - Open",
];

const personaIcons: Record<Persona, typeof HardHat> = {
  site: HardHat,
  office: Building2,
  manager: LayoutGrid,
};

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = React.useState(false);
  const [persona, setPersona] = React.useState<Persona>("manager");

  // Profile form state
  const [profileName, setProfileName] = React.useState("");
  const [profileEmail, setProfileEmail] = React.useState("");
  const [profilePhone, setProfilePhone] = React.useState("");
  const [profileJobTitle, setProfileJobTitle] = React.useState("");

  // QBCC/Signature state
  const [qbccLicenceNumber, setQbccLicenceNumber] = React.useState("");
  const [qbccLicenceClass, setQbccLicenceClass] = React.useState("");
  const [signatureUrl, setSignatureUrl] = React.useState<string | null>(null);
  const [signatureFile, setSignatureFile] = React.useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = React.useState<string | null>(null);
  const signatureInputRef = React.useRef<HTMLInputElement>(null);

  // Signature history state
  const [signatureUsages, setSignatureUsages] = React.useState<SignatureUsage[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);

  // Load persona from localStorage on mount
  React.useEffect(() => {
    setPersona(getStoredPersona());
  }, []);

  // Initialize profile form when user data is available
  React.useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
      setProfilePhone((user as any).mobile_phone || "");
      setProfileJobTitle((user as any).job_title || "");
      // QBCC/Signature fields
      setQbccLicenceNumber((user as any).qbcc_licence_number || "");
      setQbccLicenceClass((user as any).qbcc_licence_class || "");
      setSignatureUrl((user as any).signature_url || null);
    }
  }, [user]);

  const handlePersonaChange = (newPersona: Persona) => {
    setPersona(newPersona);
    setStoredPersona(newPersona);
  };

  // Fetch signature usage history
  const fetchSignatureHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: SignatureUsage[];
        pagination: { total_count: number };
      }>("/api/v1/signature_usages/my_history");

      if (response?.success) {
        setSignatureUsages(response.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch signature history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load signature history when toggled on
  React.useEffect(() => {
    if (showHistory && signatureUsages.length === 0) {
      fetchSignatureHistory();
    }
  }, [showHistory]);

  // Handle signature file selection
  const handleSignatureSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file (PNG, JPG, etc.)");
        return;
      }
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert("Signature image must be less than 2MB");
        return;
      }
      setSignatureFile(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setSignaturePreview(previewUrl);
    }
  };

  const clearSignature = () => {
    setSignatureFile(null);
    setSignaturePreview(null);
    if (signatureInputRef.current) {
      signatureInputRef.current.value = "";
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      // Use FormData if we have a signature file to upload
      if (signatureFile) {
        const formData = new FormData();
        formData.append("user[name]", profileName);
        formData.append("user[email]", profileEmail);
        formData.append("user[mobile_phone]", profilePhone);
        formData.append("user[qbcc_licence_number]", qbccLicenceNumber);
        formData.append("user[qbcc_licence_class]", qbccLicenceClass);
        formData.append("user[signature]", signatureFile);

        // Use api.patch which handles FormData and adds auth header
        const data = await api.patch<{ success: boolean; user: any; errors?: string[] }>(
          `/api/v1/users/${user.id}`,
          formData
        );

        if (data?.success) {
          setSignatureFile(null);
          setSignaturePreview(null);
          if (refreshUser) {
            await refreshUser();
          }
          alert("Profile saved successfully!");
        } else {
          alert(`Failed to save: ${data?.errors?.join("; ") || "Unknown error"}`);
        }
      } else {
        // Regular JSON request without file
        const response = await api.patch<{ success: boolean; user: any; errors?: string[] }>(
          `/api/v1/users/${user.id}`,
          {
            user: {
              name: profileName,
              email: profileEmail,
              mobile_phone: profilePhone,
              qbcc_licence_number: qbccLicenceNumber,
              qbcc_licence_class: qbccLicenceClass,
            },
          }
        );

        if (response?.success) {
          if (refreshUser) {
            await refreshUser();
          }
          alert("Profile saved successfully!");
        } else {
          const errors = response?.errors || [];
          const errorMsg = Array.isArray(errors)
            ? errors.map((e: any) => (typeof e === "string" ? e : e.error || JSON.stringify(e))).join("; ")
            : "Unknown error";
          alert(`Failed to save: ${errorMsg}`);
        }
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your personal details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src="" />
            <AvatarFallback className="text-lg">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG or GIF. Max 2MB.</p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} type="email" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="+61 400 000 000"
            />
          </div>
          <div className="space-y-2">
            <Label>Job Title</Label>
            <Input
              value={profileJobTitle}
              onChange={(e) => setProfileJobTitle(e.target.value)}
              placeholder="Project Manager"
            />
          </div>
        </div>

        <Separator />

        {/* QBCC Licence & Digital Signature */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold">QBCC Licence & Digital Signature</Label>
            <p className="text-sm text-muted-foreground">
              Required for signing Form 43 certificates and contracts
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>QBCC Licence Number</Label>
              <Input
                value={qbccLicenceNumber}
                onChange={(e) => setQbccLicenceNumber(e.target.value)}
                placeholder="e.g., 1234567"
              />
            </div>
            <div className="space-y-2">
              <Label>QBCC Licence Class</Label>
              <Select value={qbccLicenceClass} onValueChange={setQbccLicenceClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select licence class" />
                </SelectTrigger>
                <SelectContent>
                  {QBCC_LICENCE_CLASSES.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Signature Upload */}
          <div className="space-y-2">
            <Label>Digital Signature</Label>
            <div className="flex items-start gap-4">
              {/* Signature Preview */}
              <div className="w-48 h-24 border rounded-md bg-white dark:bg-background flex items-center justify-center overflow-hidden">
                {signaturePreview || signatureUrl ? (
                  <img
                    src={signaturePreview || signatureUrl || ""}
                    alt="Signature"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <PenTool className="h-6 w-6 mx-auto mb-1 opacity-50" />
                    <span className="text-xs">No signature</span>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="space-y-2">
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureSelect}
                  className="hidden"
                  id="signature-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => signatureInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Signature
                </Button>
                {(signaturePreview || signatureFile) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSignature}
                    className="text-destructive"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Upload a PNG or JPG of your signature. Max 2MB.
                </p>
              </div>
            </div>

            {/* Status Indicator */}
            {(user as any)?.can_sign_certificates && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                Ready to sign certificates
              </div>
            )}

            {/* Signature Usage History */}
            <div className="mt-4 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="text-muted-foreground"
              >
                <History className="h-4 w-4 mr-2" />
                {showHistory ? "Hide" : "View"} Signature History
              </Button>

              {showHistory && (
                <div className="mt-3 space-y-2">
                  {loadingHistory ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Spinner size={16} />
                      Loading history...
                    </div>
                  ) : signatureUsages.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      No signature usages recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {signatureUsages.map((usage) => (
                        <div
                          key={usage.id}
                          className="flex items-start gap-3 p-3 bg-muted/30 rounded-md text-sm"
                        >
                          <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{usage.document_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {usage.certificate_type_display}
                              {usage.job && (
                                <span className="ml-1">• {usage.job.job_code}</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {usage.signed_at_formatted}
                            </div>
                          </div>
                          {usage.job && (
                            <a
                              href={`/jobs/${usage.job.id}`}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* View Mode / Persona Switcher */}
        <div className="space-y-3">
          <div>
            <Label>View Mode</Label>
            <p className="text-sm text-muted-foreground">
              Customize your sidebar to show only relevant features
            </p>
          </div>
          <div className="flex gap-2">
            {PERSONA_ORDER.map((p) => {
              const Icon = personaIcons[p];
              const isActive = persona === p;
              return (
                <button
                  key={p}
                  onClick={() => handlePersonaChange(p)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-secondary border-border"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{PERSONA_CONFIG[p].label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {persona === "site" && "Shows: Dashboard, Jobs, Schedule Master, WHS, Documents, Chat"}
            {persona === "office" && "Shows: Dashboard, Leads, Contacts, Suppliers, Financial, Xero, and more"}
            {persona === "manager" && "Shows all navigation items"}
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving && <Spinner size={16} className="mr-2" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
