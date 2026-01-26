"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Check, ArrowRight, Building2, Server } from "lucide-react";
import api from "@/lib/api";

interface Tier {
  id: string;
  name: string;
  description: string;
  features: string[];
  pricing: {
    type: string;
    amount: number;
    currency: string;
    description: string;
  };
}

export default function PlanSelectionPage() {
  const router = useRouter();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [selectedTier, setSelectedTier] = useState<string>("shared");
  const [isLoading, setIsLoading] = useState(true);
  const [tenant, setTenant] = useState<{ name: string; slug: string } | null>(null);

  useEffect(() => {
    // Get tenant info from session storage
    const storedTenant = sessionStorage.getItem("signup_tenant");
    if (!storedTenant) {
      router.push("/get-started");
      return;
    }
    setTenant(JSON.parse(storedTenant));

    // Fetch available tiers
    loadTiers();
  }, [router]);

  const loadTiers = async () => {
    try {
      const response = await api.get<{ success: boolean; tiers: Tier[] }>("/api/v1/signup/tiers");
      if (response.success) {
        setTiers(response.tiers);
      }
    } catch {
      // Use default tiers if API fails
      setTiers([
        {
          id: "shared",
          name: "Standard",
          description: "Perfect for most builders",
          features: [
            "Full platform access",
            "Shared infrastructure",
            "Email support",
            "Template library",
          ],
          pricing: {
            type: "per_job",
            amount: 1650,
            currency: "AUD",
            description: "$1,500 + GST per job",
          },
        },
        {
          id: "dedicated",
          name: "Enterprise",
          description: "For larger builders",
          features: [
            "Everything in Standard",
            "Dedicated database",
            "Dedicated storage",
            "Priority support",
            "Custom domain",
          ],
          pricing: {
            type: "per_job",
            amount: 1650,
            currency: "AUD",
            description: "Custom pricing",
          },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    // Store selected tier
    sessionStorage.setItem("signup_tier", selectedTier);
    router.push("/get-started/templates");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
          <p className="text-muted-foreground">
            Welcome, {tenant?.name}! Select the plan that best fits your business.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {tiers.map((tier) => (
            <Card
              key={tier.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedTier === tier.id
                  ? "ring-2 ring-blue-500 shadow-lg"
                  : "hover:border-blue-200"
              }`}
              onClick={() => setSelectedTier(tier.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {tier.id === "shared" ? (
                      <Building2 className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                    ) : (
                      <Server className="h-8 w-8 text-purple-500 dark:text-purple-400" />
                    )}
                    <div>
                      <CardTitle>{tier.name}</CardTitle>
                      <CardDescription>{tier.description}</CardDescription>
                    </div>
                  </div>
                  {selectedTier === tier.id && (
                    <Badge className="bg-blue-500">Selected</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p className="text-2xl font-bold">{tier.pricing.description}</p>
                  <p className="text-sm text-muted-foreground">
                    Charged when you receive a deposit on a job
                  </p>
                </div>
                <ul className="space-y-2">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  variant={selectedTier === tier.id ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setSelectedTier(tier.id)}
                >
                  {selectedTier === tier.id ? "Selected" : "Select Plan"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Info Box */}
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-8">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-2">No Payment Required Today</h3>
            <p className="text-sm text-muted-foreground">
              You won&apos;t be charged until you receive your first job deposit. Start setting up
              your account and importing your data - billing only begins when you start
              using TEEEM for real projects.
            </p>
          </CardContent>
        </Card>

        {/* Continue Button */}
        <div className="flex justify-center">
          <Button size="lg" onClick={handleContinue}>
            Continue to Templates
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
