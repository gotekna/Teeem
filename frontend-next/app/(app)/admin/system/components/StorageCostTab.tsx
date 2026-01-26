"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { HardDrive, Users, Database, DollarSign, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// Storage provider pricing (monthly costs in USD)
const PROVIDERS = [
  {
    id: "sharepoint_included",
    name: "SharePoint",
    description: "Already have Microsoft 365",
    color: "bg-blue-500",
    perUserCost: 0, // Already paying for M365
    storageIncludedGB: 1000, // 1TB per user included
    extraStorageCostPerGB: 0.20,
    hasUserLicense: false,
    storageCostPerGB: 0, // Included!
    downloadCostPerGB: 0,
    includedWith: "Microsoft 365",
    pros: ["Already included", "1TB+ storage", "Office integration"],
    cons: ["Only if you have M365", "Complex permissions"],
    link: "https://www.microsoft.com/en-au/microsoft-365/business",
  },
  {
    id: "google_drive_included",
    name: "Google Drive",
    description: "Already have Google Workspace",
    color: "bg-blue-400",
    perUserCost: 0, // Already paying for Workspace
    storageIncludedGB: 1000, // Varies by plan
    storageCostPerGB: 0, // Included!
    downloadCostPerGB: 0,
    hasUserLicense: false,
    includedWith: "Google Workspace",
    pros: ["Already included", "Simple sharing", "Google Docs integration"],
    cons: ["Only if you have Workspace", "Limited offline"],
    link: "https://workspace.google.com/pricing",
  },
  {
    id: "sharepoint_new",
    name: "Microsoft 365 (new)",
    description: "Buy M365 for storage",
    color: "bg-blue-600",
    perUserCost: 9, // Business Basic AUD ~$9
    storageIncludedGB: 1000,
    extraStorageCostPerGB: 0.20,
    hasUserLicense: true,
    pros: ["Email + Office + Storage", "1TB per user", "Enterprise features"],
    cons: ["Per-user cost adds up", "Overkill if just need storage"],
    link: "https://www.microsoft.com/en-au/microsoft-365/business",
  },
  {
    id: "google_workspace_new",
    name: "Google Workspace (new)",
    description: "Buy Workspace for storage",
    color: "bg-blue-300",
    perUserCost: 10, // Business Starter ~$10 AUD
    storageIncludedGB: 30, // Starter = 30GB, Standard = 2TB
    extraStorageCostPerGB: 0.04,
    hasUserLicense: true,
    pros: ["Email + Drive + Docs", "Simple UI", "Good collaboration"],
    cons: ["Starter only 30GB/user", "Need Standard for 2TB"],
    link: "https://workspace.google.com/pricing",
  },
  {
    id: "backblaze_b2",
    name: "Backblaze B2",
    description: "Low-cost cloud storage",
    color: "bg-orange-500",
    perUserCost: 0,
    storageIncludedGB: 0,
    storageCostPerGB: 0.006,
    downloadCostPerGB: 0.01,
    hasUserLicense: false,
    pros: ["Cheapest storage", "Simple pricing", "S3 compatible"],
    cons: ["Egress fees apply", "No built-in UI"],
    link: "https://www.backblaze.com/cloud-storage/pricing",
  },
  {
    id: "aws_s3",
    name: "Amazon S3",
    description: "AWS cloud storage",
    color: "bg-yellow-500",
    perUserCost: 0,
    storageIncludedGB: 0,
    storageCostPerGB: 0.023,
    downloadCostPerGB: 0.09,
    hasUserLicense: false,
    pros: ["Industry standard", "Highly reliable", "Many regions"],
    cons: ["Complex pricing", "Expensive egress"],
    link: "https://aws.amazon.com/s3/pricing/",
  },
  {
    id: "wasabi",
    name: "Wasabi",
    description: "No egress fees",
    color: "bg-green-500",
    perUserCost: 0,
    storageIncludedGB: 0,
    storageCostPerGB: 0.0069,
    downloadCostPerGB: 0,
    hasUserLicense: false,
    pros: ["No egress fees", "Predictable cost", "S3 compatible"],
    cons: ["90-day minimum storage", "Smaller company"],
    link: "https://wasabi.com/pricing/",
  },
  {
    id: "minio",
    name: "MinIO (Self-Hosted)",
    description: "Free, own your data",
    color: "bg-red-500",
    perUserCost: 0,
    storageIncludedGB: 0,
    storageCostPerGB: 0,
    downloadCostPerGB: 0,
    hasUserLicense: false,
    hardwareCostNote: "Requires your own server/NAS",
    pros: ["Completely free", "Full control", "No vendor lock-in"],
    cons: ["Need hardware", "Self-managed", "Need IT skills"],
    link: "https://min.io/",
  },
];

export function StorageCostTab() {
  const [users, setUsers] = React.useState(10);
  const [storageGB, setStorageGB] = React.useState(100);
  const [monthlyDownloadsGB, setMonthlyDownloadsGB] = React.useState(50);

  const calculateMonthlyCost = (provider: typeof PROVIDERS[0]) => {
    let cost = 0;

    // User license costs (SharePoint/M365)
    if (provider.hasUserLicense) {
      cost += users * provider.perUserCost;

      // Calculate if extra storage needed beyond included
      const includedStorage = users * provider.storageIncludedGB;
      if (storageGB > includedStorage) {
        cost += (storageGB - includedStorage) * (provider.extraStorageCostPerGB || 0);
      }
    } else {
      // Pure storage cost
      cost += storageGB * (provider.storageCostPerGB || 0);
    }

    // Egress/download costs
    if (provider.downloadCostPerGB) {
      cost += monthlyDownloadsGB * provider.downloadCostPerGB;
    }

    return cost;
  };

  const costs = PROVIDERS.map(p => ({
    ...p,
    monthlyCost: calculateMonthlyCost(p),
    yearlyCost: calculateMonthlyCost(p) * 12,
  })).sort((a, b) => a.monthlyCost - b.monthlyCost);

  const cheapest = costs[0];
  const mostExpensive = costs[costs.length - 1];

  return (
    <div className="space-y-6">
      {/* Calculator Inputs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Storage Cost Calculator
          </CardTitle>
          <CardDescription>Compare document storage costs across providers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Users */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Number of Users
              </Label>
              <span className="text-lg font-semibold">{users}</span>
            </div>
            <Slider
              value={[users]}
              onValueChange={([v]) => setUsers(v)}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          {/* Storage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Storage Required
              </Label>
              <span className="text-lg font-semibold">{storageGB} GB</span>
            </div>
            <Slider
              value={[storageGB]}
              onValueChange={([v]) => setStorageGB(v)}
              min={10}
              max={5000}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10 GB</span>
              <span>1 TB</span>
              <span>5 TB</span>
            </div>
          </div>

          {/* Monthly Downloads */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Monthly Downloads (Egress)
              </Label>
              <span className="text-lg font-semibold">{monthlyDownloadsGB} GB</span>
            </div>
            <Slider
              value={[monthlyDownloadsGB]}
              onValueChange={([v]) => setMonthlyDownloadsGB(v)}
              min={0}
              max={500}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 GB</span>
              <span>250 GB</span>
              <span>500 GB</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monthly Cost Comparison</CardTitle>
          <CardDescription>
            Based on {users} users, {storageGB} GB storage, {monthlyDownloadsGB} GB downloads/month
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {costs.map((provider, index) => {
            const isCheapest = index === 0 && provider.monthlyCost > 0;
            const savingsVsExpensive = mostExpensive.monthlyCost - provider.monthlyCost;

            return (
              <div
                key={provider.id}
                className={cn(
                  "p-4 rounded-lg border",
                  isCheapest && "border-green-500 bg-green-50 dark:bg-green-950/30"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", provider.color)} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{provider.name}</span>
                        {isCheapest && (
                          <Badge variant="default" className="bg-green-600 text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Cheapest
                          </Badge>
                        )}
                        {provider.id === "minio" && (
                          <Badge variant="outline" className="text-xs">FREE*</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{provider.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      ${provider.monthlyCost.toFixed(2)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${provider.yearlyCost.toFixed(0)}/year
                    </div>
                  </div>
                </div>

                {/* Cost breakdown */}
                <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs">
                  {provider.hasUserLicense && (
                    <span className="text-muted-foreground">
                      Users: ${(users * provider.perUserCost).toFixed(2)}
                    </span>
                  )}
                  {!provider.hasUserLicense && provider.storageCostPerGB !== undefined && (
                    <span className="text-muted-foreground">
                      Storage: ${(storageGB * (provider.storageCostPerGB || 0)).toFixed(2)}
                    </span>
                  )}
                  {provider.downloadCostPerGB !== undefined && provider.downloadCostPerGB > 0 && (
                    <span className="text-muted-foreground">
                      Egress: ${(monthlyDownloadsGB * provider.downloadCostPerGB).toFixed(2)}
                    </span>
                  )}
                  {provider.downloadCostPerGB === 0 && provider.id !== "minio" && (
                    <span className="text-green-600 dark:text-green-400">Free egress</span>
                  )}
                  {savingsVsExpensive > 0 && provider.id !== mostExpensive.id && (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      Save ${savingsVsExpensive.toFixed(0)}/mo vs {mostExpensive.name}
                    </span>
                  )}
                </div>

                {/* Pros/Cons */}
                <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-green-600 dark:text-green-400 font-medium">Pros:</span>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {provider.pros.map((pro, i) => (
                        <li key={i}>+ {pro}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-red-600 dark:text-red-400 font-medium">Cons:</span>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {provider.cons.map((con, i) => (
                        <li key={i}>- {con}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <a
                  href={provider.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  View Pricing <ExternalLink className="h-3 w-3 inline" />
                </a>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Cheapest Option</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{cheapest.name}</p>
              <p className="text-sm">${cheapest.monthlyCost.toFixed(2)}/mo</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Most Expensive</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{mostExpensive.name}</p>
              <p className="text-sm">${mostExpensive.monthlyCost.toFixed(2)}/mo</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Yearly Savings</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                ${((mostExpensive.yearlyCost - cheapest.yearlyCost)).toFixed(0)}
              </p>
              <p className="text-sm">with {cheapest.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        * MinIO is free software but requires your own hardware (server, NAS, or cloud VM).
        Prices are estimates and may vary. Always check provider websites for current pricing.
      </p>
    </div>
  );
}
