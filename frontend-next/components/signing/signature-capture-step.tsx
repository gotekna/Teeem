"use client";

import { useState, useRef, useEffect } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  Pen,
  Type,
  Upload,
  Trash2,
  ArrowLeft,
} from "lucide-react";

interface SignatureCaptureStepProps {
  token: string;
  signerName: string;
  onComplete: (allComplete: boolean, signatureData?: string) => void;
  onBack: () => void;
  /** When true, shows inline without submitting to API - returns signature data via onComplete */
  embedded?: boolean;
  /** When true, shows as initials capture with smaller canvas */
  initialsMode?: boolean;
}

type SignatureType = "drawn" | "typed" | "uploaded";

const SIGNATURE_FONTS = [
  { name: "Cursive", fontFamily: "'Dancing Script', cursive" },
  { name: "Elegant", fontFamily: "'Great Vibes', cursive" },
  { name: "Simple", fontFamily: "'Pacifico', cursive" },
  { name: "Classic", fontFamily: "'Allura', cursive" },
];

export function SignatureCaptureStep({
  token,
  signerName,
  onComplete,
  onBack,
  embedded = false,
  initialsMode = false,
}: SignatureCaptureStepProps) {
  const [signatureType, setSignatureType] = useState<SignatureType>("drawn");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [typedName, setTypedName] = useState(signerName);
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const apiUrl = getApiBaseUrl();

  // Load Google Fonts for typed signatures
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Pacifico&family=Allura&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2; // Higher res for clarity
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set drawing styles
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Clear canvas with white background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Drawing functions
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;

    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;

    if ("touches" in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Generate signature data
  const getSignatureData = (): string | null => {
    if (signatureType === "drawn") {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return null;
      return canvas.toDataURL("image/png");
    }

    if (signatureType === "typed") {
      if (!typedName.trim()) return null;
      // Create canvas with typed signature
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 150;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      ctx.font = `48px ${selectedFont.fontFamily}`;
      ctx.textBaseline = "middle";
      ctx.fillText(typedName, 20, 75);
      return canvas.toDataURL("image/png");
    }

    if (signatureType === "uploaded") {
      return signatureData;
    }

    return null;
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSignatureData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit signature
  const submitSignature = async () => {
    const sigData = getSignatureData();
    if (!sigData) {
      setError("Please provide a signature");
      return;
    }

    // In embedded mode, just return the signature data without API call
    if (embedded) {
      onComplete(false, sigData);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/v1/sign/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_data: sigData,
          signature_type: signatureType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onComplete(data.request_complete || false, sigData);
      } else {
        const data = await response.json();
        setError(data.errors?.[0] || "Failed to submit signature");
      }
    } catch {
      setError("Failed to submit signature. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = () => {
    if (signatureType === "drawn") return hasDrawn;
    if (signatureType === "typed") return typedName.trim().length > 0;
    if (signatureType === "uploaded") return signatureData !== null;
    return false;
  };

  const title = initialsMode ? "Add Your Initials" : "Add Your Signature";
  const description = initialsMode
    ? "Draw or type your initials below"
    : "Choose how you'd like to sign this document";
  const canvasHeight = initialsMode ? "h-[100px]" : "h-[150px]";

  return (
    <div className={embedded ? "py-2" : "py-6"}>
      {!embedded && (
        <>
          <h2 className="text-xl font-semibold text-center mb-2">{title}</h2>
          <p className="text-muted-foreground text-center mb-6">
            {description}
          </p>
        </>
      )}

      <Tabs value={signatureType} onValueChange={(v) => setSignatureType(v as SignatureType)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="drawn" className="flex items-center gap-2">
            <Pen className="h-4 w-4" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="typed" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Type
          </TabsTrigger>
          <TabsTrigger value="uploaded" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
        </TabsList>

        {/* Draw signature */}
        <TabsContent value="drawn" className="space-y-4">
          <div className="relative border-2 border-dashed rounded-lg p-1 bg-white">
            <canvas
              ref={canvasRef}
              className={`w-full ${canvasHeight} cursor-crosshair touch-none`}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-muted-foreground">Sign here</p>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={clearCanvas} disabled={!hasDrawn}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </TabsContent>

        {/* Type signature */}
        <TabsContent value="typed" className="space-y-4">
          <Input
            placeholder="Type your name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            className="text-lg"
          />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Select a style:</p>
            <div className="grid grid-cols-2 gap-2">
              {SIGNATURE_FONTS.map((font) => (
                <button
                  key={font.name}
                  type="button"
                  onClick={() => setSelectedFont(font)}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    selectedFont.name === font.name
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-border"
                  }`}
                >
                  <span
                    className="text-2xl block truncate"
                    style={{ fontFamily: font.fontFamily }}
                  >
                    {typedName || signerName}
                  </span>
                  <span className="text-xs text-muted-foreground">{font.name}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Preview */}
          {typedName && (
            <div className="border rounded-lg p-6 bg-white">
              <p className="text-sm text-muted-foreground mb-2">Preview:</p>
              <p
                className="text-4xl"
                style={{ fontFamily: selectedFont.fontFamily }}
              >
                {typedName}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Upload signature */}
        <TabsContent value="uploaded" className="space-y-4">
          {signatureData ? (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-white">
                <img
                  src={signatureData}
                  alt="Uploaded signature"
                  className="max-h-[150px] mx-auto"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setSignatureData(null)}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-[150px] border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-muted-foreground">Click to upload signature image</span>
              <span className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}
        </TabsContent>
      </Tabs>

      {error && (
        <p className="text-sm text-destructive text-center mt-4">{error}</p>
      )}

      {/* Action buttons */}
      <div className={`flex gap-4 ${embedded ? "mt-4" : "mt-8"}`}>
        {!embedded && (
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}
        <Button
          onClick={submitSignature}
          disabled={!canSubmit() || isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Spinner size={16} className="mr-2" />
              {initialsMode ? "Applying..." : "Signing..."}
            </>
          ) : (
            initialsMode ? "Apply Initials" : "Apply Signature"
          )}
        </Button>
      </div>

      {/* Legal notice */}
      {!embedded && (
        <p className="text-xs text-muted-foreground text-center mt-6">
          By clicking &ldquo;Apply Signature&rdquo;, you agree that your electronic signature is
          legally binding and has the same effect as signing a physical document.
        </p>
      )}
    </div>
  );
}
