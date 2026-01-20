"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Mail, FileSpreadsheet, Settings, Users, ExternalLink } from "lucide-react";

export default function GetStartedCompletePage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<{ name: string; slug: string; login_url?: string } | null>(null);
  const [admin, setAdmin] = useState<{ email: string; name: string } | null>(null);

  useEffect(() => {
    // Get tenant and admin info from session storage
    const storedTenant = sessionStorage.getItem("signup_tenant");
    const storedAdmin = sessionStorage.getItem("signup_admin");

    if (!storedTenant) {
      router.push("/get-started");
      return;
    }

    setTenant(JSON.parse(storedTenant));
    if (storedAdmin) {
      setAdmin(JSON.parse(storedAdmin));
    }

    // Clear session storage after successful signup
    return () => {
      sessionStorage.removeItem("signup_tenant");
      sessionStorage.removeItem("signup_admin");
      sessionStorage.removeItem("signup_tier");
      sessionStorage.removeItem("signup_template_packs");
    };
  }, [router]);

  const loginUrl = tenant?.login_url || `https://${tenant?.slug}.teeem.com.au`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-6 w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to TEEEM!</h1>
          <p className="text-muted-foreground text-lg">
            Your account for <span className="font-semibold">{tenant?.name}</span> is ready.
          </p>
        </div>

        {/* Account Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Account Details</CardTitle>
            <CardDescription>Save this information for your records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-medium">{tenant?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Login URL</p>
                <a
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                >
                  {loginUrl.replace("https://", "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Admin Email</p>
                <p className="font-medium">{admin?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Admin Name</p>
                <p className="font-medium">{admin?.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Notice */}
        <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold mb-1">Check Your Email</h3>
                <p className="text-sm text-muted-foreground">
                  We&apos;ve sent a welcome email to <span className="font-medium">{admin?.email}</span> with
                  your temporary password and login instructions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>Get the most out of TEEEM</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <NextStep
                icon={<Settings className="h-5 w-5" />}
                title="1. Complete Your Setup"
                description="Add your company logo, set up email templates, and customize your settings."
              />
              <NextStep
                icon={<FileSpreadsheet className="h-5 w-5" />}
                title="2. Import Your Data"
                description="Use our Excel templates to import your contacts, jobs, and pricebook."
              />
              <NextStep
                icon={<Users className="h-5 w-5" />}
                title="3. Invite Your Team"
                description="Add staff members and set their permissions to start collaborating."
              />
            </div>
          </CardContent>
        </Card>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" onClick={() => window.open(loginUrl, "_blank")}>
            Go to Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => window.open(`${loginUrl}/onboarding/import`, "_blank")}
          >
            Import Your Data
            <FileSpreadsheet className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Support */}
        <p className="text-center mt-8 text-sm text-muted-foreground">
          Need help getting started?{" "}
          <a href="mailto:support@teeem.com.au" className="underline hover:text-primary">
            Contact our support team
          </a>
        </p>
      </div>
    </div>
  );
}

function NextStep({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
