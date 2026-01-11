"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { refreshBrandColors } from "@/components/providers/company-colors-provider";
import { Globe, Palette, Check, AlertCircle, Image } from "lucide-react";

interface BrandColors {
  primary: string;
  primaryForeground: string;
  secondary: string;
  muted: string;
  accent: string;
}

interface BrandData {
  colors: BrandColors;
  website_url: string | null;
  logo_url: string | null;
  logo_mobile: string | null;
  logo_dark: string | null;
}

interface DetectedBrand {
  company_name: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  colors: {
    hex: Record<string, string>;
    hsl: Record<string, string>;
  };
}

export function BrandColorsTab() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [detecting, setDetecting] = React.useState(false);
  const [brand, setBrand] = React.useState<BrandData | null>(null);
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [detectedBrand, setDetectedBrand] = React.useState<DetectedBrand | null>(null);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load current brand settings
  React.useEffect(() => {
    loadBrand();
  }, []);

  async function loadBrand() {
    try {
      const response = await api.get<{ success: boolean; data: BrandData }>("/api/v1/corporate_company_settings/brand");
      if (response.success && response.data) {
        setBrand(response.data);
        setWebsiteUrl(response.data.website_url || "");
      }
    } catch (error) {
      console.error("Failed to load brand:", error);
    } finally {
      setLoading(false);
    }
  }

  async function detectFromWebsite() {
    if (!websiteUrl) return;

    setDetecting(true);
    setMessage(null);
    setDetectedBrand(null);

    try {
      const response = await api.post<{ success: boolean; data: DetectedBrand; error?: string }>(
        "/api/v1/corporate_company_settings/brand/detect",
        { url: websiteUrl }
      );

      if (response?.success && response?.data) {
        setDetectedBrand(response.data);
        setMessage({ type: "success", text: `Detected brand from ${response.data.company_name}` });
      } else {
        setMessage({ type: "error", text: response?.error || "Could not detect brand" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to detect brand from website" });
    } finally {
      setDetecting(false);
    }
  }

  async function applyDetectedBrand() {
    if (!websiteUrl) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await api.post<{ success: boolean; data: BrandData; message?: string; error?: string }>(
        "/api/v1/corporate_company_settings/brand/apply",
        { url: websiteUrl }
      );

      if (response?.success && response?.data) {
        setBrand(response.data);
        setDetectedBrand(null);
        setMessage({ type: "success", text: response?.message || "Brand applied successfully" });
        // Refresh the UI colors
        await refreshBrandColors();
      } else {
        setMessage({ type: "error", text: response?.error || "Failed to apply brand" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to apply brand" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32">
      <div>
        <h2 className="text-lg font-semibold">Brand Colors</h2>
        <p className="text-sm text-muted-foreground">
          Configure your company brand colors. These colors are applied across the entire UI.
        </p>
      </div>

      <Separator />

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-md ${
            message.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {message.type === "success" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Detect from Website */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Auto-Detect from Website
          </CardTitle>
          <CardDescription>
            Enter your company website URL to automatically extract brand colors, logo, and company name.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://yourcompany.com.au"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={detectFromWebsite} disabled={detecting || !websiteUrl}>
              {detecting ? <Spinner className="h-4 w-4 mr-2" /> : null}
              {detecting ? "Detecting..." : "Detect"}
            </Button>
          </div>

          {/* Detected Preview */}
          {detectedBrand && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{detectedBrand.company_name}</p>
                  <p className="text-sm text-muted-foreground">Detected brand assets</p>
                </div>
                <Button onClick={applyDetectedBrand} disabled={saving}>
                  {saving ? <Spinner className="h-4 w-4 mr-2" /> : null}
                  Apply Brand
                </Button>
              </div>

              {/* Logo Preview */}
              {(detectedBrand.logo_url || detectedBrand.logo_dark_url) && (
                <div className="flex gap-4">
                  {detectedBrand.logo_url && (
                    <div className="text-center">
                      <div className="bg-white p-4 rounded-md border">
                        <img
                          src={detectedBrand.logo_url}
                          alt="Detected logo"
                          className="h-12 max-w-[200px] object-contain"
                        />
                      </div>
                      <p className="text-xs mt-1 text-muted-foreground">Logo (Light)</p>
                    </div>
                  )}
                  {detectedBrand.logo_dark_url && (
                    <div className="text-center">
                      <div className="bg-gray-900 p-4 rounded-md border">
                        <img
                          src={detectedBrand.logo_dark_url}
                          alt="Detected dark logo"
                          className="h-12 max-w-[200px] object-contain"
                        />
                      </div>
                      <p className="text-xs mt-1 text-muted-foreground">Logo (Dark)</p>
                    </div>
                  )}
                </div>
              )}

              {/* Color Preview */}
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(detectedBrand.colors.hex).map(([key, color]) => (
                  <div key={key} className="text-center">
                    <div
                      className="w-full h-12 rounded-md border"
                      style={{ backgroundColor: color }}
                    />
                    <p className="text-xs mt-1 capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground font-mono">{color}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Brand Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Current Brand Colors
          </CardTitle>
          <CardDescription>
            These colors are currently applied to the UI. Values are in HSL format.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {brand?.colors && (
            <div className="grid grid-cols-5 gap-4">
              {Object.entries(brand.colors).map(([key, hsl]) => (
                <div key={key} className="text-center">
                  <div
                    className="w-full h-16 rounded-md border"
                    style={{ backgroundColor: `hsl(${hsl})` }}
                  />
                  <p className="text-sm mt-2 capitalize font-medium">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{hsl}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Logos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Current Logos
          </CardTitle>
          <CardDescription>
            Company logos for different contexts. These are auto-detected from your website or can be set manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            {/* Main Logo */}
            <div className="text-center">
              <div className="bg-white p-4 rounded-md border min-h-[80px] flex items-center justify-center">
                {brand?.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt="Company logo"
                    className="h-12 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">No logo set</span>
                )}
              </div>
              <p className="text-sm mt-2 font-medium">Main Logo</p>
              <p className="text-xs text-muted-foreground">Used on light backgrounds</p>
            </div>

            {/* Dark Logo */}
            <div className="text-center">
              <div className="bg-gray-900 p-4 rounded-md border min-h-[80px] flex items-center justify-center">
                {brand?.logo_dark ? (
                  <img
                    src={brand.logo_dark}
                    alt="Dark mode logo"
                    className="h-12 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-gray-500 text-sm">No dark logo set</span>
                )}
              </div>
              <p className="text-sm mt-2 font-medium">Dark Mode Logo</p>
              <p className="text-xs text-muted-foreground">Used on dark backgrounds</p>
            </div>

            {/* Mobile Logo */}
            <div className="text-center">
              <div className="bg-white p-4 rounded-md border min-h-[80px] flex items-center justify-center">
                {brand?.logo_mobile ? (
                  <img
                    src={brand.logo_mobile}
                    alt="Mobile logo"
                    className="h-8 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">No mobile logo set</span>
                )}
              </div>
              <p className="text-sm mt-2 font-medium">Mobile Logo</p>
              <p className="text-xs text-muted-foreground">Compact version for mobile</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Enter your company website URL above</li>
            <li>Click "Detect" to extract colors from the website CSS</li>
            <li>Preview the detected colors</li>
            <li>Click "Apply Brand" to save and apply the colors to the UI</li>
            <li>The entire application will update to use your brand colors</li>
          </ol>
          <p className="text-sm text-muted-foreground mt-4">
            Colors are extracted from CSS custom properties and common patterns in your website stylesheet.
            You can manually adjust colors after detection if needed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
