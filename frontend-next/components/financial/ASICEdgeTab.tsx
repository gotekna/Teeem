"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Settings,
  Send,
  Clock,
  Shield,
  Users,
  Calendar,
  RefreshCw,
  Info,
  Link as LinkIcon,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";

// ASIC Form Types that can be lodged via EDGE
const ASIC_FORMS = [
  {
    code: "201",
    name: "Application for registration as an Australian company",
    description: "Register a new Pty Ltd or Public company",
    category: "Registration",
    available: true,
  },
  {
    code: "484",
    name: "Change to company details",
    description: "Update registered office, directors, secretary, shareholdings",
    category: "Changes",
    available: true,
  },
  {
    code: "361",
    name: "Notification by a company to extract",
    description: "Request official company extract",
    category: "Extracts",
    available: true,
  },
  {
    code: "362",
    name: "Application for historical company information",
    description: "Request historical company data",
    category: "Extracts",
    available: true,
  },
  {
    code: "6010",
    name: "Annual statement",
    description: "Lodge annual company review (due yearly)",
    category: "Annual",
    available: true,
  },
  {
    code: "205",
    name: "Notification of resolution",
    description: "Notify ASIC of special resolutions",
    category: "Notifications",
    available: false,
  },
  {
    code: "492",
    name: "Voluntary deregistration",
    description: "Apply to deregister a company",
    category: "Deregistration",
    available: false,
  },
];

interface CompanyLookupResult {
  success: boolean;
  data?: {
    name: string;
    acn: string | null;
    abn: string | null;
    status: string;
    company_type: string;
    registered_address?: string;
    registration_date?: string;
    directors?: Array<{ name: string; appointment_date: string }>;
    annual_review_date?: string;
  };
  error?: string;
}

interface LodgementHistoryItem {
  id: string;
  form_code: string;
  company_name: string;
  acn: string;
  lodged_at: string;
  status: "pending" | "accepted" | "rejected";
  reference?: string;
}

export default function ASICEdgeTab() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [acnInput, setACNInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyResult, setCompanyResult] = useState<CompanyLookupResult | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showLodgeDialog, setShowLodgeDialog] = useState(false);
  const [selectedForm, setSelectedForm] = useState<typeof ASIC_FORMS[0] | null>(null);
  const [lodgementHistory] = useState<LodgementHistoryItem[]>([]);

  const handleCompanyLookup = useCallback(async () => {
    if (!acnInput.trim()) return;

    setLoading(true);
    setCompanyResult(null);

    try {
      // Use existing ASIC lookup endpoint
      const response = await api.get<{ success: boolean; data?: CompanyLookupResult["data"]; error?: string }>(
        `/api/v1/asic/lookup_acn?acn=${encodeURIComponent(acnInput.replace(/\s/g, ""))}`
      );

      if (response.success && response.data) {
        setCompanyResult({ success: true, data: response.data });
      } else {
        setCompanyResult({ success: false, error: response.error || "Company not found" });
      }
    } catch (error) {
      setCompanyResult({ success: false, error: "Failed to lookup company" });
    } finally {
      setLoading(false);
    }
  }, [acnInput]);

  const handleStartLodgement = (form: typeof ASIC_FORMS[0]) => {
    setSelectedForm(form);
    setShowLodgeDialog(true);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Registration":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Changes":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "Extracts":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "Annual":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
      case "Notifications":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "Deregistration":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Integration Status Banner */}
      {!isConfigured ? (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-medium text-amber-800 dark:text-amber-200">
                    ASIC EDGE Not Configured
                  </h3>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Connect to GetEDGE to enable direct ASIC form lodgement
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-800 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-green-800 dark:text-green-200">
                  ASIC EDGE Connected
                </h3>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Direct ASIC lodgement is available
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company Lookup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Registry Lookup
          </CardTitle>
          <CardDescription>
            Look up company details from the ASIC registry before lodging forms
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="acn">ACN (Australian Company Number)</Label>
              <Input
                id="acn"
                placeholder="Enter 9-digit ACN (e.g., 123 456 789)"
                value={acnInput}
                onChange={(e) => setACNInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCompanyLookup()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCompanyLookup} disabled={loading || !acnInput.trim()}>
                {loading ? <Spinner className="h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Lookup
              </Button>
            </div>
          </div>

          {/* Company Result */}
          {companyResult && (
            <div className="mt-4">
              {companyResult.success && companyResult.data ? (
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <Label className="text-muted-foreground">Company Name</Label>
                          <p className="font-medium text-lg">{companyResult.data.name}</p>
                        </div>
                        <div className="flex gap-4">
                          <div>
                            <Label className="text-muted-foreground">ACN</Label>
                            <p className="font-mono">{companyResult.data.acn || "N/A"}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">ABN</Label>
                            <p className="font-mono">{companyResult.data.abn || "N/A"}</p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Status</Label>
                          <Badge
                            className={
                              companyResult.data.status === "Registered"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                            }
                          >
                            {companyResult.data.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-muted-foreground">Company Type</Label>
                          <p>{companyResult.data.company_type || "N/A"}</p>
                        </div>
                        {companyResult.data.registered_address && (
                          <div>
                            <Label className="text-muted-foreground">Registered Address</Label>
                            <p className="text-sm">{companyResult.data.registered_address}</p>
                          </div>
                        )}
                        {companyResult.data.annual_review_date && (
                          <div>
                            <Label className="text-muted-foreground">Annual Review Date</Label>
                            <p>{companyResult.data.annual_review_date}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-4 pt-4 border-t flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartLodgement(ASIC_FORMS.find((f) => f.code === "484")!)}
                        disabled={!isConfigured}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Update Details (484)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartLodgement(ASIC_FORMS.find((f) => f.code === "6010")!)}
                        disabled={!isConfigured}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Annual Statement
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://connectonline.asic.gov.au/`, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        ASIC Portal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-red-200 dark:border-red-800">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <XCircle className="h-5 w-5" />
                      <span>{companyResult.error || "Company not found"}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Forms */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Available ASIC Forms
          </CardTitle>
          <CardDescription>
            Lodge company forms directly to ASIC via the EDGE gateway
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Form</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ASIC_FORMS.map((form) => (
                <TableRow key={form.code}>
                  <TableCell className="font-mono font-medium">{form.code}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{form.name}</p>
                      <p className="text-sm text-muted-foreground">{form.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getCategoryColor(form.category)}>{form.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {form.available ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-400 border-gray-400">
                        Coming Soon
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={form.available && isConfigured ? "default" : "outline"}
                      disabled={!form.available || !isConfigured}
                      onClick={() => handleStartLodgement(form)}
                    >
                      {form.available && isConfigured ? (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Lodge
                        </>
                      ) : (
                        <>
                          <Info className="h-4 w-4 mr-2" />
                          {!isConfigured ? "Configure First" : "Not Available"}
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Lodgement History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Lodgement History
          </CardTitle>
          <CardDescription>Track your ASIC form submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {lodgementHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No lodgements yet</p>
              <p className="text-sm mt-1">Your ASIC form submissions will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>ACN</TableHead>
                  <TableHead>Lodged</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lodgementHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.form_code}</TableCell>
                    <TableCell>{item.company_name}</TableCell>
                    <TableCell className="font-mono">{item.acn}</TableCell>
                    <TableCell>{new Date(item.lodged_at).toLocaleDateString()}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="font-mono text-sm">{item.reference || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* About ASIC EDGE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            About ASIC EDGE
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            ASIC EDGE (Electronic Data Gathering and Exchange) is ASIC&apos;s business-to-business
            interface that enables registered software providers to submit company forms
            electronically on behalf of their clients.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium">Faster Processing</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Forms are processed immediately without manual data entry delays
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Validation</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Real-time validation catches errors before submission
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-purple-600" />
                <h4 className="font-medium">Bulk Lodgement</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Submit multiple forms for different companies efficiently
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => window.open("https://getedge.com.au", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              GetEDGE Website
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open("https://asic.gov.au/for-business/registering-a-company/software-companies-edge/", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              ASIC EDGE Info
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configure Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configure ASIC EDGE
            </DialogTitle>
            <DialogDescription>
              Connect to GetEDGE to enable direct ASIC form lodgement from T.A.S.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                About GetEDGE
              </h4>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                GetEDGE is an ASIC-approved EDGE gateway provider. You&apos;ll need a GetEDGE
                subscription ($249/month) to enable ASIC form lodgement through T.A.S.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="edge-api-key">GetEDGE API Key</Label>
                <Input
                  id="edge-api-key"
                  type="password"
                  placeholder="Enter your GetEDGE API key"
                />
              </div>
              <div>
                <Label htmlFor="edge-agent-number">Registered Agent Number</Label>
                <Input
                  id="edge-agent-number"
                  placeholder="Enter your ASIC registered agent number"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                ASIC EDGE integration requires you to be a registered ASIC agent. Contact GetEDGE
                to set up your account and obtain API credentials.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsConfigured(true);
                setShowConfigDialog(false);
              }}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lodge Form Dialog */}
      <Dialog open={showLodgeDialog} onOpenChange={setShowLodgeDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Lodge Form {selectedForm?.code}
            </DialogTitle>
            <DialogDescription>{selectedForm?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {companyResult?.data ? (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{companyResult.data.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  ACN: {companyResult.data.acn}
                </p>
              </div>
            ) : (
              <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                <p>Look up a company first to pre-fill form details</p>
              </div>
            )}

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                Form {selectedForm?.code} - {selectedForm?.description}
              </h4>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                This form will be submitted electronically to ASIC via the EDGE gateway.
                Processing typically takes 24-48 hours.
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm">
                You&apos;ll be guided through the form fields in the next step.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLodgeDialog(false)}>
              Cancel
            </Button>
            <Button disabled={!companyResult?.data}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
