"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUrlState } from "@/hooks/useUrlState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  FileText,
  Users,
  PenLine,
  Send,
  ChevronRight,
  Upload,
  Check,
  AlertCircle,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { ESignaturePdfEditor } from "@/components/e-signature/e-signature-pdf-editor";
import { SignerPanel } from "@/components/ui/pdf-editor/signer-panel";
import { ReviewAndSend } from "@/components/e-signature/review-and-send";
import type { Signer, SignatureField } from "@/components/ui/pdf-editor/types";
import { SIGNER_COLORS } from "@/components/ui/pdf-editor/types";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

type PrepareStep = "document" | "fields" | "review";

const STEPS: { id: PrepareStep; label: string; icon: React.ReactNode }[] = [
  { id: "document", label: "Document & Signers", icon: <FileText className="h-4 w-4" /> },
  { id: "fields", label: "Place Fields", icon: <PenLine className="h-4 w-4" /> },
  { id: "review", label: "Review & Send", icon: <Send className="h-4 w-4" /> },
];

export default function ESignaturePreparePage() {
  const router = useRouter();
  // SSoT: URL state for wizard step (enables browser back/forward)
  const [urlState, setUrlState] = useUrlState({
    step: null as string | null,  // null = "document"
  });
  const currentStep = (urlState.step as PrepareStep) || "document";
  const setCurrentStep = (newStep: PrepareStep) => {
    setUrlState({ step: newStep === "document" ? null : newStep });
  };

  // Document state
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Signers state
  const [signers, setSigners] = useState<Signer[]>([]);
  const [selectedSigner, setSelectedSigner] = useState<Signer | null>(null);

  // Fields state
  const [fields, setFields] = useState<SignatureField[]>([]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create e-signature request mutation
  interface CreateRequestResponse {
    success: boolean;
    data?: { id: number };
    error?: string;
  }

  const createRequest = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post<CreateRequestResponse>("/api/v1/e_signature_requests", data);
      return response;
    },
  });

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file");
      return;
    }

    setDocumentFile(file);
    setDocumentUrl(URL.createObjectURL(file));
    setTitle(file.name.replace(/\.pdf$/i, ""));
    setError(null);
  }, []);

  // Add a new signer
  const handleAddSigner = useCallback((email: string, name?: string) => {
    const newSigner: Signer = {
      id: `signer-${Date.now()}`,
      email,
      name,
      color: SIGNER_COLORS[signers.length % SIGNER_COLORS.length],
      order: signers.length,
    };
    setSigners((prev) => [...prev, newSigner]);
    setSelectedSigner(newSigner);
  }, [signers.length]);

  // Remove a signer
  const handleRemoveSigner = useCallback((signerId: string) => {
    setSigners((prev) => prev.filter((s) => s.id !== signerId));
    setFields((prev) => prev.filter((f) => f.signerId !== signerId));
    if (selectedSigner?.id === signerId) {
      setSelectedSigner(null);
    }
  }, [selectedSigner]);

  // Handle fields change from PDF editor
  const handleFieldsChange = useCallback((newFields: SignatureField[]) => {
    setFields(newFields);
  }, []);

  // Navigate between steps
  const goToStep = (step: PrepareStep) => {
    setCurrentStep(step);
  };

  const canProceedToFields = documentUrl && signers.length > 0 && title.trim();
  const canProceedToReview = fields.length > 0 && signers.every((s) =>
    fields.some((f) => f.signerId === s.id)
  );

  // Submit the e-signature request
  const handleSubmit = async () => {
    if (!documentFile) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // First, upload the document to get SharePoint file info
      // For now, we'll create the request with the fields
      const requestData = {
        title,
        description,
        signers_attributes: signers.map((s, index) => ({
          email: s.email,
          name: s.name || s.email.split("@")[0],
          signing_order: index,
        })),
        fields_attributes: fields.map((f) => ({
          field_type: f.type,
          page_number: f.pageNumber,
          x_percent: f.xPercent,
          y_percent: f.yPercent,
          width_percent: f.widthPercent,
          height_percent: f.heightPercent,
          label: f.label,
          required: f.required,
          date_format: f.dateFormat,
          placeholder: f.placeholder,
          // Map signer ID to index for backend
          signer_index: signers.findIndex((s) => s.id === f.signerId),
        })),
      };

      const result = await createRequest.mutateAsync(requestData);

      if (result?.success && result.data) {
        // Navigate to the created request
        router.push(`/e-signature/${result.data.id}`);
      } else {
        throw new Error(result?.error || "Failed to create e-signature request");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request");
      setIsSubmitting(false);
    }
  };

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-2xl font-bold">Prepare Document for E-Signature</h1>
        <p className="text-muted-foreground mt-1">
          Upload a document, add signers, place signature fields, and send for signing
        </p>
      </div>

      {/* Step indicator */}
      <div className="border-b px-6 py-3 shrink-0">
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isComplete = index < currentStepIndex;

            return (
              <React.Fragment key={step.id}>
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <button
                  onClick={() => {
                    // Only allow going back, not forward without validation
                    if (index <= currentStepIndex) {
                      goToStep(step.id);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isComplete && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                    !isActive && !isComplete && "text-muted-foreground hover:bg-muted"
                  )}
                  disabled={index > currentStepIndex}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : step.icon}
                  {step.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {currentStep === "document" && (
          <div className="flex h-full">
            {/* Left panel - Document upload and details */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Document upload */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Document</CardTitle>
                    <CardDescription>
                      Upload the PDF document that needs to be signed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!documentUrl ? (
                      <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                        <span className="text-sm font-medium">Click to upload PDF</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          or drag and drop
                        </span>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-medium">{documentFile?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {documentFile && (documentFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDocumentFile(null);
                            setDocumentUrl(null);
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Document details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Details</CardTitle>
                    <CardDescription>
                      Give your document a title and optional description
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Contract Agreement"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description (optional)</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of the document..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Right panel - Signers */}
            <div className="w-80 border-l">
              <SignerPanel
                signers={signers}
                selectedSigner={selectedSigner}
                onAddSigner={handleAddSigner}
                onRemoveSigner={handleRemoveSigner}
                onSelectSigner={setSelectedSigner}
                onReorderSigners={setSigners}
                fields={fields}
              />
            </div>
          </div>
        )}

        {currentStep === "fields" && documentUrl && (
          <ESignaturePdfEditor
            url={documentUrl}
            signers={signers}
            selectedSigner={selectedSigner}
            onSelectSigner={setSelectedSigner}
            fields={fields}
            onFieldsChange={handleFieldsChange}
          />
        )}

        {currentStep === "review" && (
          <ReviewAndSend
            title={title}
            description={description}
            documentName={documentFile?.name || ""}
            signers={signers}
            fields={fields}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      {/* Footer navigation */}
      <div className="border-t px-6 py-4 shrink-0 flex items-center justify-between">
        {currentStepIndex > 0 ? (
          <Button
            variant="outline"
            onClick={() => goToStep(STEPS[currentStepIndex - 1].id)}
          >
            Back
          </Button>
        ) : (
          <BackButton fallbackHref="/e-signature" variant="outline" label="Cancel" />
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {currentStep !== "review" && (
          <Button
            onClick={() => {
              if (currentStep === "document" && canProceedToFields) {
                goToStep("fields");
              } else if (currentStep === "fields" && canProceedToReview) {
                goToStep("review");
              }
            }}
            disabled={
              (currentStep === "document" && !canProceedToFields) ||
              (currentStep === "fields" && !canProceedToReview)
            }
          >
            Continue
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}

        {currentStep === "review" && (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size={16} className="mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send for Signature
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
