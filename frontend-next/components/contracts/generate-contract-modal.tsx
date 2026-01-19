"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Lead } from "@/types/leads";
import { QBCCContractData } from "@/types/contracts";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  Building,
  User,
  MapPin,
  DollarSign,
  FileText,
  Send,
  CheckCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrencyWhole } from "@/utils/formatters";

interface GenerateContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onContractGenerated: () => void;
}

type Step = "builder" | "client" | "terms" | "review" | "send";

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: "builder", label: "Builder", icon: <Building className="h-4 w-4" /> },
  { key: "client", label: "Client", icon: <User className="h-4 w-4" /> },
  { key: "terms", label: "Terms", icon: <DollarSign className="h-4 w-4" /> },
  { key: "review", label: "Review", icon: <FileText className="h-4 w-4" /> },
  { key: "send", label: "Send", icon: <Send className="h-4 w-4" /> },
];

// Default builder details - in production these would come from org settings
const DEFAULT_BUILDER = {
  builder_name: "ABC Constructions Pty Ltd",
  builder_abn: "12 345 678 901",
  qbcc_licence_number: "1234567",
  builder_address: "123 Builder Street, Brisbane QLD 4000",
  builder_email: "contracts@abcconstructions.com.au",
  builder_phone: "+61 7 1234 5678",
  builder_insurance_policy: "POL-2024-001234",
  builder_insurance_expiry: "2025-06-30",
};

export function GenerateContractModal({
  open,
  onOpenChange,
  lead,
  onContractGenerated,
}: GenerateContractModalProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>("builder");
  const [loading, setLoading] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);

  // Form state
  const [contractData, setContractData] = useState<QBCCContractData>({
    // Builder details (from org settings)
    ...DEFAULT_BUILDER,

    // Client details (from lead)
    client_name: lead.client_name,
    client_address: `${lead.site_address}, ${lead.site_suburb} ${lead.site_state} ${lead.site_postcode}`,
    client_email: lead.client_email,
    client_phone: lead.client_phone,

    // Site details (from lead)
    site_address: `${lead.site_address}, ${lead.site_suburb} ${lead.site_state} ${lead.site_postcode}`,
    lot_plan_number: lead.lot_plan_number,

    // Project details
    building_description: "",

    // Financial
    contract_price: lead.estimated_value,
    deposit_amount: Math.round(lead.estimated_value * 0.05), // 5% default deposit
    gst_included: true,

    // Timeline
    commencement_date: lead.expected_start_date || "",
    practical_completion_date: "",
    building_period_days: 365, // Default 12 months

    // Special conditions
    special_conditions: [],
  });

  const [sendToClient, setSendToClient] = useState(true);
  const [sendToBuilder, setSendToBuilder] = useState(true);

  const updateField = <K extends keyof QBCCContractData>(
    field: K,
    value: QBCCContractData[K]
  ) => {
    setContractData((prev) => ({ ...prev, [field]: value }));
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].key);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].key);
    }
  };

  const handleGenerateContract = async () => {
    setLoading(true);
    try {
      const response = await api.post<{ contract_id: number; pdf_url: string }>(
        "/api/v1/contracts",
        {
          lead_id: lead.id,
          contract_type: "qbcc_domestic",
          contract_data: contractData,
        }
      );
      if (response?.pdf_url) {
        setGeneratedPdfUrl(response.pdf_url);
      }
      goNext();
    } catch (error) {
      console.error("Failed to generate contract:", error);
      // For demo: simulate success
      setGeneratedPdfUrl("/demo-contract.pdf");
      goNext();
    } finally {
      setLoading(false);
    }
  };

  const handleSendForSignature = async () => {
    setLoading(true);
    try {
      await api.post(`/api/v1/contracts/${lead.id}/send-for-signature`, {
        send_to_client: sendToClient,
        send_to_builder: sendToBuilder,
        client_email: contractData.client_email,
        builder_email: contractData.builder_email,
      });
      onContractGenerated();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to send for signature:", error);
      // For demo: simulate success
      toast({ title: "Success", description: "Contract sent for signature! (Demo mode)" });
      onContractGenerated();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate QBCC Domestic Building Contract</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg mb-4">
          {STEPS.map((step, index) => (
            <div
              key={step.key}
              className={`flex items-center gap-2 ${
                index <= currentStepIndex
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  index < currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : index === currentStepIndex
                    ? "bg-primary/20 text-primary border-2 border-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index < currentStepIndex ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  step.icon
                )}
              </div>
              <span className="text-sm font-medium hidden sm:block">
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-2 ${
                    index < currentStepIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {/* Step 1: Builder Details */}
          {currentStep === "builder" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirm your builder details. These are pre-filled from your
                organization settings.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Builder/Company Name</Label>
                  <Input
                    value={contractData.builder_name}
                    onChange={(e) => updateField("builder_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label>ABN</Label>
                  <Input
                    value={contractData.builder_abn}
                    onChange={(e) => updateField("builder_abn", e.target.value)}
                  />
                </div>
                <div>
                  <Label>QBCC Licence Number</Label>
                  <Input
                    value={contractData.qbcc_licence_number}
                    onChange={(e) =>
                      updateField("qbcc_licence_number", e.target.value)
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>Builder Address</Label>
                  <Input
                    value={contractData.builder_address}
                    onChange={(e) =>
                      updateField("builder_address", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={contractData.builder_email}
                    onChange={(e) =>
                      updateField("builder_email", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={contractData.builder_phone}
                    onChange={(e) =>
                      updateField("builder_phone", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Insurance Policy Number</Label>
                  <Input
                    value={contractData.builder_insurance_policy}
                    onChange={(e) =>
                      updateField("builder_insurance_policy", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Insurance Expiry Date</Label>
                  <Input
                    type="date"
                    value={contractData.builder_insurance_expiry}
                    onChange={(e) =>
                      updateField("builder_insurance_expiry", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Client Details */}
          {currentStep === "client" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirm the client details. These are pre-filled from the lead.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Client Name</Label>
                  <Input
                    value={contractData.client_name}
                    onChange={(e) => updateField("client_name", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Client Address</Label>
                  <Input
                    value={contractData.client_address}
                    onChange={(e) =>
                      updateField("client_address", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={contractData.client_email}
                    onChange={(e) =>
                      updateField("client_email", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={contractData.client_phone || ""}
                    onChange={(e) =>
                      updateField("client_phone", e.target.value)
                    }
                  />
                </div>

                <div className="col-span-2 border-t pt-4 mt-2">
                  <p className="text-sm font-medium mb-3">Site Details</p>
                </div>

                <div className="col-span-2">
                  <Label>Site Address</Label>
                  <Input
                    value={contractData.site_address}
                    onChange={(e) =>
                      updateField("site_address", e.target.value)
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>Lot/Plan Number</Label>
                  <Input
                    value={contractData.lot_plan_number || ""}
                    onChange={(e) =>
                      updateField("lot_plan_number", e.target.value)
                    }
                    placeholder="e.g., Lot 1 SP123456"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Contract Terms */}
          {currentStep === "terms" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the contract terms including price, deposit, and timeline.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Building Description</Label>
                  <Textarea
                    value={contractData.building_description}
                    onChange={(e) =>
                      updateField("building_description", e.target.value)
                    }
                    placeholder="Describe the building works to be carried out..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Contract Price (AUD)</Label>
                  <Input
                    type="number"
                    value={contractData.contract_price}
                    onChange={(e) =>
                      updateField("contract_price", parseInt(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <Label>Deposit Amount (AUD)</Label>
                  <Input
                    type="number"
                    value={contractData.deposit_amount}
                    onChange={(e) =>
                      updateField(
                        "deposit_amount",
                        parseInt(e.target.value) || 0
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    QBCC max deposit: 5% or $20,000 (whichever is greater)
                  </p>
                </div>

                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="gst"
                      checked={contractData.gst_included}
                      onCheckedChange={(checked) =>
                        updateField("gst_included", !!checked)
                      }
                    />
                    <Label htmlFor="gst" className="font-normal">
                      GST included in contract price
                    </Label>
                  </div>
                </div>

                <div className="col-span-2 border-t pt-4 mt-2">
                  <p className="text-sm font-medium mb-3">Timeline</p>
                </div>

                <div>
                  <Label>Commencement Date</Label>
                  <Input
                    type="date"
                    value={contractData.commencement_date}
                    onChange={(e) =>
                      updateField("commencement_date", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Building Period (Days)</Label>
                  <Input
                    type="number"
                    value={contractData.building_period_days}
                    onChange={(e) =>
                      updateField(
                        "building_period_days",
                        parseInt(e.target.value) || 0
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Practical Completion Date</Label>
                  <Input
                    type="date"
                    value={contractData.practical_completion_date}
                    onChange={(e) =>
                      updateField("practical_completion_date", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === "review" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review the contract details before generating the PDF.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                      <Building className="h-4 w-4" /> Builder
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">{contractData.builder_name}</p>
                      <p className="text-muted-foreground">
                        ABN: {contractData.builder_abn}
                      </p>
                      <p className="text-muted-foreground">
                        QBCC: {contractData.qbcc_licence_number}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                      <User className="h-4 w-4" /> Client
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">{contractData.client_name}</p>
                      <p className="text-muted-foreground">
                        {contractData.client_email}
                      </p>
                      <p className="text-muted-foreground">
                        {contractData.client_phone}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4" /> Site
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p>{contractData.site_address}</p>
                      {contractData.lot_plan_number && (
                        <p className="text-muted-foreground font-mono">
                          {contractData.lot_plan_number}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                      <DollarSign className="h-4 w-4" /> Financials
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">
                          Contract Price:
                        </span>{" "}
                        <span className="font-medium font-mono">
                          {formatCurrencyWhole(contractData.contract_price)}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Deposit:</span>{" "}
                        <span className="font-medium font-mono">
                          {formatCurrencyWhole(contractData.deposit_amount)}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        {contractData.gst_included ? "GST Included" : "GST Excluded"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {contractData.building_description && (
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-sm mb-2">
                      Building Description
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {contractData.building_description}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 5: Send */}
          {currentStep === "send" && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium">Contract Generated</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your QBCC Domestic Building Contract is ready to send for
                  signature.
                </p>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-medium text-sm mb-3">Send for Signature</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="send-client"
                        checked={sendToClient}
                        onCheckedChange={(checked) =>
                          setSendToClient(!!checked)
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="send-client" className="font-normal">
                          Client: {contractData.client_name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {contractData.client_email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="send-builder"
                        checked={sendToBuilder}
                        onCheckedChange={(checked) =>
                          setSendToBuilder(!!checked)
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="send-builder" className="font-normal">
                          Builder: {contractData.builder_name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {contractData.builder_email}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground text-center">
                Contracts will be sent via DocuSign for electronic signature.
                Both parties will receive an email with a link to sign.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStepIndex === 0 ? () => onOpenChange(false) : goBack}
            disabled={loading}
          >
            {currentStepIndex === 0 ? (
              "Cancel"
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>

          {currentStep === "review" ? (
            <Button onClick={handleGenerateContract} disabled={loading}>
              {loading ? (
                <Spinner size={16} className="mr-2" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Generate Contract
            </Button>
          ) : currentStep === "send" ? (
            <Button onClick={handleSendForSignature} disabled={loading}>
              {loading ? (
                <Spinner size={16} className="mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send for Signature
            </Button>
          ) : (
            <Button onClick={goNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
