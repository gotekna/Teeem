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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { ArrowRight, Package, Star, Download } from "lucide-react";
import api from "@/lib/api";

interface TemplatePack {
  id: number;
  name: string;
  description: string;
  visibility: string;
  source_tenant: string;
  downloads_count: number;
  items_count: number;
  item_types: string[];
}

export default function TemplateSelectionPage() {
  const router = useRouter();
  const [packs, setPacks] = useState<TemplatePack[]>([]);
  const [selectedPacks, setSelectedPacks] = useState<number[]>([]);
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

    // Fetch available template packs
    loadPacks();
  }, [router]);

  const loadPacks = async () => {
    try {
      const response = await api.get<{ success: boolean; template_packs: TemplatePack[] }>(
        "/api/v1/signup/template_packs"
      );
      if (response.success) {
        setPacks(response.template_packs);
        // Auto-select curated packs
        const curatedIds = response.template_packs
          .filter((p: TemplatePack) => p.visibility === "curated")
          .map((p: TemplatePack) => p.id);
        setSelectedPacks(curatedIds);
      }
    } catch {
      // Show empty state if API fails
      setPacks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePack = (packId: number) => {
    setSelectedPacks((prev) =>
      prev.includes(packId)
        ? prev.filter((id) => id !== packId)
        : [...prev, packId]
    );
  };

  const handleContinue = () => {
    // Store selected packs
    sessionStorage.setItem("signup_template_packs", JSON.stringify(selectedPacks));
    router.push("/get-started/complete");
  };

  const formatItemTypes = (types: string[]) => {
    return types
      .map((t) =>
        t
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      )
      .join(", ");
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
          <h1 className="text-3xl font-bold mb-2">Starter Templates</h1>
          <p className="text-muted-foreground">
            Pre-configured settings to get {tenant?.name} up and running quickly.
            <br />
            Select the templates you&apos;d like to import.
          </p>
        </div>

        {/* Template Packs */}
        {packs.length > 0 ? (
          <div className="space-y-4 mb-8">
            {packs.map((pack) => (
              <Card
                key={pack.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedPacks.includes(pack.id)
                    ? "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
                    : ""
                }`}
                onClick={() => togglePack(pack.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedPacks.includes(pack.id)}
                      onCheckedChange={() => togglePack(pack.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="h-5 w-5 text-blue-500" />
                        <CardTitle className="text-lg">{pack.name}</CardTitle>
                        {pack.visibility === "curated" && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{pack.description || "Configuration template pack"}</CardDescription>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        {pack.downloads_count} imports
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pl-12">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground">Includes:</span>
                    <span className="text-sm">{formatItemTypes(pack.item_types)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pack.items_count} configuration items from {pack.source_tenant}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mb-8">
            <CardContent className="pt-6 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Templates Available</h3>
              <p className="text-sm text-muted-foreground">
                You can configure your settings manually after signup.
              </p>
            </CardContent>
          </Card>
        )}

        {/* What's Included Info */}
        <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 mb-8">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">What&apos;s in a Template Pack?</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Job Types</strong> - New Build, Renovation, Extension, etc.</li>
              <li>• <strong>Job Statuses</strong> - Active, On Hold, Complete, etc.</li>
              <li>• <strong>Job Stages</strong> - Slab, Frame, Lock-up, etc.</li>
              <li>• <strong>Contact Types</strong> - Client, Supplier, Subcontractor, etc.</li>
              <li>• <strong>Schedule Templates</strong> - Pre-built construction schedules</li>
            </ul>
            <p className="text-sm mt-3">
              You can customize all settings after setup to match your business.
            </p>
          </CardContent>
        </Card>

        {/* Continue Button */}
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => router.push("/get-started/plan")}>
            Back
          </Button>
          <Button size="lg" onClick={handleContinue}>
            {selectedPacks.length > 0
              ? `Import ${selectedPacks.length} Template${selectedPacks.length > 1 ? "s" : ""}`
              : "Skip Templates"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
