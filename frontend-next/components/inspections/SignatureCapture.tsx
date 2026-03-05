"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eraser, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface SignatureCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: number;
  signatureType: "inspector" | "tenant";
  onSigned: () => void;
}

export function SignatureCapture({
  open,
  onOpenChange,
  inspectionId,
  signatureType,
  onSigned,
}: SignatureCaptureProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricCanvasRef = useRef<any>(null);
  const [signerName, setSignerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function initCanvas() {
      const fabricModule = await import("fabric");
      const { Canvas } = fabricModule;

      if (cancelled || !canvasRef.current) return;

      const canvas = new Canvas(canvasRef.current, {
        width: 500,
        height: 200,
        backgroundColor: "#ffffff",
        isDrawingMode: true,
      });

      canvas.freeDrawingBrush.color = "#1a1a1a";
      canvas.freeDrawingBrush.width = 2;

      canvas.on("path:created", () => setHasDrawn(true));

      fabricCanvasRef.current = canvas;
    }

    initCanvas();

    return () => {
      cancelled = true;
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      setHasDrawn(false);
      setSignerName("");
    };
  }, [open]);

  const handleClear = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = "#ffffff";
    canvas.renderAll();
    setHasDrawn(false);
  }, []);

  const handleSign = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !hasDrawn) return;

    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL({ format: "png" });

      await api.post(`/api/v1/property_inspections/${inspectionId}/sign`, {
        signature_type: signatureType,
        signature_data: dataUrl,
        signer_name: signerName,
      });

      toast({ title: "Signature saved" });
      onSigned();
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to save signature", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [inspectionId, signatureType, signerName, hasDrawn, onSigned, onOpenChange, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {signatureType === "inspector" ? "Inspector Signature" : "Tenant Signature"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="Enter name..."
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Signature</Label>
              <Button size="sm" variant="ghost" onClick={handleClear} className="h-7 text-xs">
                <Eraser className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden bg-white">
              <canvas ref={canvasRef} className="touch-none cursor-crosshair" />
            </div>
            <p className="text-xs text-muted-foreground">
              Draw your signature above using mouse or touch
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSign} disabled={saving || !hasDrawn}>
            {saving ? (
              <Spinner className="h-4 w-4 mr-1.5" />
            ) : (
              <Check className="h-4 w-4 mr-1.5" />
            )}
            Sign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
