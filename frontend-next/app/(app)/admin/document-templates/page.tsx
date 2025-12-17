"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Eye,
  RefreshCw,
  ExternalLink,
  Loader2,
  BookOpen,
  TestTube,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface DocumentTemplate {
  id: number;
  name: string;
  description?: string;
  category: string;
  output_format: string;
  is_active: boolean;
  sharepoint_linked: boolean;
  sharepoint_path?: string;
  available_fields?: string[];
}

interface FieldGroup {
  name: string;
  description: string;
  fields: { path: string; description: string; example?: string }[];
  isLoop?: boolean;
}

// Available merge fields organized by category
const FIELD_REFERENCE: FieldGroup[] = [
  {
    name: "✨ Smart Tags (Letters)",
    description: "Use for LETTERS - shows owner names for companies",
    fields: [
      { path: "dear", description: "Complete greeting - handles any client combo", example: "Dear Keith & John," },
      { path: "client_names", description: "All client names formatted", example: "ABC Pty Ltd (Keith Miller) & John Smith" },
      { path: "client_first_names", description: "First names (owner's for companies)", example: "Keith & John" },
      { path: "client_last_names", description: "Last names (owner's for companies)", example: "Miller & Smith" },
      { path: "client_display_names", description: "Display names with company", example: "Keith Miller (ABC Pty Ltd) & John Smith" },
      { path: "client_emails", description: "All client emails", example: "keith@abc.com, john@example.com" },
      { path: "client_phones", description: "All client phone numbers", example: "0400 111 222, 0400 333 444" },
    ],
  },
  {
    name: "📄 Contract Tags",
    description: "Use for CONTRACTS - shows company names, NOT owner names",
    fields: [
      { path: "contract_dear", description: "Formal greeting using company names", example: "Dear ABC Pty Ltd & John," },
      { path: "contract_client_names", description: "Formal names (company only, no owner)", example: "ABC Pty Ltd & John Smith" },
      { path: "contract_parties", description: "Party names with ABN for contracts", example: "ABC Pty Ltd ABN 12 345 678 901 & John Smith" },
    ],
  },
  {
    name: "Job",
    description: "Job/Project information",
    fields: [
      { path: "job.job_number", description: "Job number", example: "101" },
      { path: "job.title", description: "Job title/name", example: "Smith Residence" },
      { path: "job.address", description: "Street address", example: "123 Main Street" },
      { path: "job.suburb", description: "Suburb", example: "Brisbane" },
      { path: "job.state", description: "State", example: "QLD" },
      { path: "job.postcode", description: "Postcode", example: "4000" },
      { path: "job.full_address", description: "Complete formatted address", example: "123 Main Street, Brisbane QLD 4000" },
      { path: "job.lot", description: "Lot number", example: "Lot 5" },
      { path: "job.plan_number", description: "Plan/SP number", example: "SP123456" },
      { path: "job.contract_price", description: "Contract price (formatted)", example: "$450,000.00" },
      { path: "job.contract_date", description: "Contract date", example: "15/12/2025" },
      { path: "job.site_start_date", description: "Site start date", example: "01/01/2026" },
      { path: "job.practical_completion_date", description: "Practical completion date", example: "01/06/2026" },
      { path: "job.deposit", description: "Deposit amount", example: "$45,000.00" },
      { path: "job.build_period", description: "Build period", example: "6 months" },
      { path: "job.council", description: "Council name", example: "Brisbane City Council" },
      { path: "job.status", description: "Current status", example: "In Progress" },
    ],
  },
  {
    name: "Clients (Loop)",
    description: "Loop through each client individually",
    isLoop: true,
    fields: [
      { path: "display_name", description: "Full name", example: "John Smith" },
      { path: "first_name", description: "First name", example: "John" },
      { path: "last_name", description: "Last name", example: "Smith" },
      { path: "email", description: "Email address", example: "john@example.com" },
      { path: "phone", description: "Phone number", example: "0400 123 456" },
      { path: "mobile", description: "Mobile number", example: "0400 123 456" },
      { path: "company_name", description: "Company name (if company)", example: "ABC Pty Ltd" },
      { path: "abn", description: "ABN", example: "12 345 678 901" },
      { path: "is_company", description: "True if entity is a company", example: "true/false" },
      { path: "is_person", description: "True if entity is a person", example: "true/false" },
      { path: "owner_first_name", description: "Owner's first name (for companies)", example: "Keith" },
      { path: "owner_name", description: "Owner's full name (for companies)", example: "Keith Miller" },
      { path: "address_line_1", description: "Address line 1", example: "123 Main Street" },
      { path: "suburb", description: "Suburb", example: "Brisbane" },
      { path: "state", description: "State", example: "QLD" },
      { path: "postcode", description: "Postcode", example: "4000" },
      { path: "full_address", description: "Complete address", example: "123 Main Street, Brisbane QLD 4000" },
    ],
  },
  {
    name: "Client 1 / Client 2",
    description: "Direct access to primary and secondary client",
    fields: [
      { path: "client_1.display_name", description: "Primary client name", example: "John Smith" },
      { path: "client_1.first_name", description: "Primary client first name", example: "John" },
      { path: "client_1.email", description: "Primary client email", example: "john@example.com" },
      { path: "client_1.company_name", description: "Primary client company", example: "ABC Pty Ltd" },
      { path: "client_1.owner_first_name", description: "Company owner first name", example: "Keith" },
      { path: "client_2.display_name", description: "Secondary client name", example: "Jane Smith" },
      { path: "client_2.first_name", description: "Secondary client first name", example: "Jane" },
      { path: "client_2.email", description: "Secondary client email", example: "jane@example.com" },
    ],
  },
  {
    name: "Builder",
    description: "Builder/Company information",
    fields: [
      { path: "builder.display_name", description: "Builder name", example: "Up Homes Pty Ltd" },
      { path: "builder.abn", description: "ABN", example: "12 345 678 901" },
      { path: "builder.qbcc_license", description: "QBCC License number", example: "1234567" },
      { path: "builder.phone", description: "Phone number", example: "07 3000 0000" },
      { path: "builder.email", description: "Email address", example: "info@uphomes.com.au" },
      { path: "builder.address", description: "Business address", example: "1 Builder Street, Brisbane QLD 4000" },
    ],
  },
  {
    name: "Document",
    description: "Document generation metadata",
    fields: [
      { path: "generated_date", description: "Date document was generated", example: "11/12/2025" },
      { path: "generated_time", description: "Time document was generated", example: "2:30 PM" },
      { path: "generated_by", description: "User who generated", example: "Robert Harder" },
    ],
  },
];

export default function DocumentTemplatesPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const editTemplateId = searchParams.get("edit");

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["✨ Smart Tags (Letters)", "📄 Contract Tags"]);
  const [previewJobId, setPreviewJobId] = useState<string>("");
  const [previewing, setPreviewing] = useState(false);
  const [activeTab, setActiveTab] = useState<"templates" | "fields" | "preview">("templates");

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Auto-select template from URL parameter
  useEffect(() => {
    if (editTemplateId && templates.length > 0) {
      const template = templates.find(t => t.id.toString() === editTemplateId);
      if (template) {
        setSelectedTemplate(template);
        setActiveTab("templates");
      }
    }
  }, [editTemplateId, templates]);

  const fetchTemplates = async () => {
    try {
      const response = await api.get<{ success: boolean; document_templates: DocumentTemplate[] }>(
        "/api/v1/document_templates"
      );
      if (response?.success) {
        setTemplates(response.document_templates);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      toast({ title: "Error", description: "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(text);
    setTimeout(() => setCopiedField(null), 2000);
    toast({ title: "Copied", description: `${text} copied to clipboard` });
  };

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
    );
  };

  const handlePreview = async () => {
    if (!selectedTemplate || !previewJobId) {
      toast({ title: "Error", description: "Select a template and enter a Job ID", variant: "destructive" });
      return;
    }

    setPreviewing(true);
    try {
      // This would call the preview endpoint
      const response = await api.get<{ success: boolean; preview_url?: string; errors?: string[] }>(
        `/api/v1/document_templates/${selectedTemplate.id}/preview?job_id=${previewJobId}`
      );

      if (response?.success && response.preview_url) {
        window.open(response.preview_url, "_blank");
      } else {
        toast({
          title: "Preview",
          description: response?.errors?.join(", ") || "Preview generated - check downloads",
        });
      }
    } catch (error) {
      console.error("Preview failed:", error);
      toast({ title: "Error", description: "Failed to generate preview", variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Document Templates</h1>
        <p className="text-sm text-slate-500">
          Manage Word templates for automated document generation
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "templates"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="h-4 w-4" />
          Templates ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab("fields")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "fields"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Field Reference
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "preview"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <TestTube className="h-4 w-4" />
          Test Preview
        </button>
      </div>

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <Card>
          <CardHeader>
            <CardTitle>Available Templates</CardTitle>
            <CardDescription>
              Word templates linked to SharePoint. Edit templates in Word, use merge fields from the Field Reference tab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>SharePoint</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{template.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.output_format.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      {template.sharepoint_linked ? (
                        <Badge className="bg-green-600">Linked</Badge>
                      ) : (
                        <Badge variant="destructive">Not Linked</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setActiveTab("preview");
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {template.sharepoint_path && (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={`https://gotekna.sharepoint.com/sites/TEEEM/Shared%20Documents/${template.sharepoint_path.split('/').map(s => encodeURIComponent(s)).join('/')}?web=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Edit in Word Online"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Field Reference Tab */}
      {activeTab === "fields" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Merge Field Reference</CardTitle>
              <CardDescription>
                Copy these fields and paste them into your Word templates. Click any field to copy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-950/30">
                <h4 className="font-medium text-blue-800 dark:text-blue-200">How to use merge fields</h4>
                <ol className="mt-2 list-decimal list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>Open your Word template in Microsoft Word</li>
                  <li>Click where you want to insert data</li>
                  <li>Type the field exactly as shown (e.g., <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{{job.address}}"}</code>)</li>
                  <li>Save and upload to SharePoint</li>
                </ol>
              </div>

              <Accordion type="multiple" value={expandedGroups} onValueChange={setExpandedGroups} className="space-y-2">
                {FIELD_REFERENCE.map((group) => (
                  <AccordionItem
                    key={group.name}
                    value={group.name}
                    className="border-none"
                  >
                    <AccordionTrigger className="flex w-full items-center justify-between rounded-lg bg-slate-100 p-3 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 hover:no-underline [&>svg]:hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{group.name}</span>
                        {group.isLoop && (
                          <Badge variant="outline" className="text-xs">Loop</Badge>
                        )}
                      </div>
                      <span className="text-sm text-slate-500">{group.description}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="mt-2 rounded-lg border">
                        {group.isLoop && (
                          <div className="border-b bg-amber-50 p-3 dark:bg-amber-950/30">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                              <strong>Loop syntax:</strong> Use <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">{"{{#clients}}"}</code> to start and <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">{"{{/clients}}"}</code> to end. Content between will repeat for each client.
                            </p>
                            <div className="mt-2 flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard("{{#clients}}")}
                              >
                                {copiedField === "{{#clients}}" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                {"{{#clients}}"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard("{{/clients}}")}
                              >
                                {copiedField === "{{/clients}}" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                {"{{/clients}}"}
                              </Button>
                            </div>
                          </div>
                        )}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[250px]">Field</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="w-[200px]">Example</TableHead>
                              <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.fields.map((field) => {
                              const fullPath = group.isLoop
                                ? `{{${field.path}}}`
                                : `{{${field.path}}}`;
                              return (
                                <TableRow key={field.path}>
                                  <TableCell>
                                    <code className="rounded bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">
                                      {fullPath}
                                    </code>
                                  </TableCell>
                                  <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                    {field.description}
                                  </TableCell>
                                  <TableCell className="text-sm text-slate-500">
                                    {field.example}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(fullPath)}
                                    >
                                      {copiedField === fullPath ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Example Templates */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>✨</span> Letter Template
                </CardTitle>
                <CardDescription>
                  Uses owner names for companies (friendly/personal)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="rounded-lg bg-slate-900 p-4 text-sm text-slate-100 overflow-x-auto whitespace-pre-wrap">
{`{{dear}}

Re: {{job.full_address}}

Thank you for choosing us for your new home.

Contract Details:
    Price: {{job.contract_price}}
    Deposit: {{job.deposit}}

To: {{client_names}}
Emails: {{client_emails}}

Kind regards,
{{builder.display_name}}`}
                </pre>
                <p className="mt-3 text-xs text-slate-500">
                  Output for company with owner: &quot;Dear Keith, ... To: ABC Pty Ltd (Keith Miller)&quot;
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>📄</span> Contract Template
                </CardTitle>
                <CardDescription>
                  Uses company names only (formal/legal)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="rounded-lg bg-slate-900 p-4 text-sm text-slate-100 overflow-x-auto whitespace-pre-wrap">
{`BUILDING CONTRACT

Between:
{{contract_parties}}
("the Owner")

And:
{{builder.display_name}}
ABN: {{builder.abn}}
("the Builder")

Property: {{job.full_address}}
Contract Price: {{job.contract_price}}

{{contract_dear}}

This contract is made on {{job.contract_date}}.`}
                </pre>
                <p className="mt-3 text-xs text-slate-500">
                  Output for company: &quot;ABC Pty Ltd ABN 12 345 678 901&quot; (no owner name)
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Test Template Preview</CardTitle>
            <CardDescription>
              Generate a preview of a template with real job data to verify merge fields are working
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Select Template</Label>
                <Select
                  value={selectedTemplate?.id.toString() || ""}
                  onValueChange={(value) => {
                    const template = templates.find((t) => t.id.toString() === value);
                    setSelectedTemplate(template || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                        {!template.sharepoint_linked && " (Not linked)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Job ID</Label>
                <Input
                  type="number"
                  placeholder="Enter Job ID to preview with..."
                  value={previewJobId}
                  onChange={(e) => setPreviewJobId(e.target.value)}
                />
              </div>
            </div>

            {selectedTemplate && (
              <div className="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                <h4 className="font-medium">{selectedTemplate.name}</h4>
                <p className="text-sm text-slate-500">{selectedTemplate.description}</p>
                <div className="mt-2 flex gap-2">
                  <Badge variant="secondary">{selectedTemplate.category}</Badge>
                  <Badge variant="outline">{selectedTemplate.output_format.toUpperCase()}</Badge>
                  {selectedTemplate.sharepoint_linked ? (
                    <Badge className="bg-green-600">SharePoint Linked</Badge>
                  ) : (
                    <Badge variant="destructive">Not Linked - Cannot Preview</Badge>
                  )}
                </div>
                {selectedTemplate.sharepoint_path && (
                  <p className="mt-2 text-xs text-slate-500">
                    Path: {selectedTemplate.sharepoint_path}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                onClick={handlePreview}
                disabled={!selectedTemplate?.sharepoint_linked || !previewJobId || previewing}
              >
                {previewing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                Generate Preview
              </Button>
              <Button variant="outline" onClick={fetchTemplates}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Templates
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
