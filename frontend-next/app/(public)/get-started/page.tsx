"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Building2, User, Mail, Phone, Globe, ArrowRight, Check, AlertCircle, Gift, Package } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import api from "@/lib/api";

interface SignupData {
  company_name: string;
  abn: string;
  email: string;
  phone: string;
  website: string;
  admin_email: string;
  admin_first_name: string;
  admin_last_name: string;
  include_pricebook: boolean;
}

function GetStartedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token");

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInvite, setIsLoadingInvite] = useState(!!inviteToken);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [suggestedSlug, setSuggestedSlug] = useState<string>("");
  const [inviteSenderName, setInviteSenderName] = useState<string | null>(null);

  const [formData, setFormData] = useState<SignupData>({
    company_name: "",
    abn: "",
    email: "",
    phone: "",
    website: "",
    admin_email: "",
    admin_first_name: "",
    admin_last_name: "",
    include_pricebook: true, // Default to true for better onboarding
  });

  // Fetch invitation data if token is present
  useEffect(() => {
    if (inviteToken) {
      loadInvitationData(inviteToken);
    }
  }, [inviteToken]);

  const loadInvitationData = async (token: string) => {
    setIsLoadingInvite(true);
    try {
      const response = await api.get<{
        success: boolean;
        data?: {
          email: string;
          name: string;
          first_name: string;
          last_name: string;
          company_name: string;
          sender_name: string;
        };
        error?: string;
      }>(`/api/v1/signup/invitation/${token}`);

      if (response.success && response.data) {
        // Prefill form with invitation data
        setFormData((prev) => ({
          ...prev,
          company_name: response.data!.company_name || prev.company_name,
          admin_email: response.data!.email || prev.admin_email,
          admin_first_name: response.data!.first_name || prev.admin_first_name,
          admin_last_name: response.data!.last_name || prev.admin_last_name,
        }));
        setInviteSenderName(response.data.sender_name);

        // Check availability of prefilled company name
        if (response.data.company_name) {
          checkAvailability(response.data.company_name);
        }
      } else {
        setError(response.error || "Invalid or expired invitation");
      }
    } catch {
      setError("Failed to load invitation details");
    } finally {
      setIsLoadingInvite(false);
    }
  };

  const handleInputChange = (field: keyof SignupData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);

    // Check availability when company name changes
    if (field === "company_name" && value.length >= 3) {
      checkAvailability(value);
    }
  };

  const checkAvailability = async (companyName: string) => {
    setIsCheckingAvailability(true);
    try {
      const response = await api.get<{ available: boolean; suggested_slug: string }>(
        "/api/v1/signup/check_availability",
        { params: { company_name: companyName } }
      );
      setSlugAvailable(response.available);
      setSuggestedSlug(response.suggested_slug);
    } catch {
      // Ignore availability check errors
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const validateStep1 = () => {
    if (!formData.company_name.trim()) {
      setError("Company name is required");
      return false;
    }
    if (slugAvailable === false) {
      setError("This company name is already taken");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.admin_first_name.trim()) {
      setError("First name is required");
      return false;
    }
    if (!formData.admin_last_name.trim()) {
      setError("Last name is required");
      return false;
    }
    if (!formData.admin_email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
      setError("Please enter a valid email address");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{
        success: boolean;
        tenant?: { name: string; slug: string; login_url?: string };
        admin_user?: { email: string; name: string };
        error?: string;
      }>("/api/v1/signup", {
        ...formData,
        invite_token: inviteToken,
      });

      if (response?.success) {
        // Store tenant info for the next steps
        sessionStorage.setItem("signup_tenant", JSON.stringify(response.tenant));
        sessionStorage.setItem("signup_admin", JSON.stringify(response.admin_user));
        router.push("/get-started/plan");
      } else {
        setError(response?.error || "Signup failed");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during signup";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <StepIndicator step={1} current={step} label="Company" />
            <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600" />
            <StepIndicator step={2} current={step} label="Admin" />
            <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600" />
            <StepIndicator step={3} current={step} label="Setup" />
          </div>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              {step === 1 ? (
                <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              ) : (
                <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {step === 1 ? "Create Your Account" : "Admin Details"}
            </CardTitle>
            <CardDescription>
              {step === 1
                ? "Start by telling us about your company"
                : "Set up your admin account"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {isLoadingInvite && (
              <div className="flex items-center justify-center py-8">
                <Spinner size={24} />
                <span className="ml-2 text-muted-foreground">Loading invitation details...</span>
              </div>
            )}

            {!isLoadingInvite && inviteSenderName && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <Gift className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {inviteSenderName} has invited you to try TEEEM!
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!isLoadingInvite && step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <div className="relative">
                    <Input
                      id="company_name"
                      placeholder="e.g., Pilgrim Homes"
                      value={formData.company_name}
                      onChange={(e) => handleInputChange("company_name", e.target.value)}
                    />
                    {isCheckingAvailability && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Spinner size={16} />
                      </div>
                    )}
                    {!isCheckingAvailability && slugAvailable !== null && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {slugAvailable ? (
                          <Check className="h-5 w-5 text-green-500 dark:text-green-400" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
                        )}
                      </div>
                    )}
                  </div>
                  {suggestedSlug && slugAvailable && (
                    <p className="text-sm text-muted-foreground">
                      Your URL: <span className="font-medium">{suggestedSlug}.teeem.com.au</span>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="abn">ABN</Label>
                  <Input
                    id="abn"
                    placeholder="12 345 678 901"
                    value={formData.abn}
                    onChange={(e) => handleInputChange("abn", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Company Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        className="pl-10"
                        placeholder="info@company.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        className="pl-10"
                        placeholder="07 1234 5678"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="website"
                      className="pl-10"
                      placeholder="https://yourcompany.com.au"
                      value={formData.website}
                      onChange={(e) => handleInputChange("website", e.target.value)}
                    />
                  </div>
                </div>

                {/* Starter Pricebook Option */}
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="include_pricebook"
                      checked={formData.include_pricebook}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, include_pricebook: checked === true }))
                      }
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="include_pricebook" className="flex items-center gap-2 cursor-pointer font-medium">
                        <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Include starter pricebook
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Copy our full pricebook with supplier items and industry-standard pricing (5% markup applied)
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!isLoadingInvite && step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin_first_name">First Name *</Label>
                    <Input
                      id="admin_first_name"
                      placeholder="John"
                      value={formData.admin_first_name}
                      onChange={(e) => handleInputChange("admin_first_name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_last_name">Last Name *</Label>
                    <Input
                      id="admin_last_name"
                      placeholder="Smith"
                      value={formData.admin_last_name}
                      onChange={(e) => handleInputChange("admin_last_name", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_email">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin_email"
                      type="email"
                      className="pl-10"
                      placeholder="john@company.com"
                      value={formData.admin_email}
                      onChange={(e) => handleInputChange("admin_email", e.target.value)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    We&apos;ll send your login credentials to this email
                  </p>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={isLoading}>
                Back
              </Button>
            ) : (
              <Button variant="link" onClick={() => router.push("/login")}>
                Already have an account?
              </Button>
            )}
            <Button onClick={handleNext} disabled={isLoading || isLoadingInvite}>
              {isLoading ? (
                <Spinner size={16} className="mr-2" />
              ) : null}
              {step === 2 ? "Create Account" : "Continue"}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center mt-6 text-sm text-muted-foreground">
          By signing up, you agree to our{" "}
          <a href="/terms" className="underline hover:text-primary">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:text-primary">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}

export default function GetStartedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Spinner size={32} />
      </div>
    }>
      <GetStartedPageContent />
    </Suspense>
  );
}

function StepIndicator({ step, current, label }: { step: number; current: number; label: string }) {
  const isComplete = current > step;
  const isCurrent = current === step;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
          isComplete
            ? "bg-green-500 text-white"
            : isCurrent
            ? "bg-blue-600 text-white"
            : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
        }`}
      >
        {isComplete ? <Check className="h-4 w-4" /> : step}
      </div>
      <span className="text-xs mt-1 text-muted-foreground">{label}</span>
    </div>
  );
}
