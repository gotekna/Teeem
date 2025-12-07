"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
  Users,
  FolderOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";

interface ContactType {
  id: number;
  name: string;
  display_name: string;
  tab_label: string | null;
  description: string | null;
  active: boolean;
  position: number;
}

export function ContactTypesTab() {
  const { toast } = useToast();

  const [contactTypes, setContactTypes] = React.useState<ContactType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [editingType, setEditingType] = React.useState<ContactType | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);
  const [contactDocPath, setContactDocPath] = React.useState("");
  const [savingPath, setSavingPath] = React.useState(false);
  const [showFolderPicker, setShowFolderPicker] = React.useState(false);
  const [extracting, setExtracting] = React.useState(false);
  const [extractionResult, setExtractionResult] = React.useState<any>(null);
  const [showExtractDialog, setShowExtractDialog] = React.useState(false);
  const [emailPatterns, setEmailPatterns] = React.useState<string[]>([]);
  const [previewData, setPreviewData] = React.useState<any[]>([]);
  const [selectedExtractions, setSelectedExtractions] = React.useState<Set<number>>(new Set());

  const [formData, setFormData] = React.useState({
    name: "",
    display_name: "",
    tab_label: "",
    description: "",
    active: true,
  });

  React.useEffect(() => {
    loadData();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, []);

  const loadData = async () => {
    try {
      const data = await api.get<ContactType[]>("/api/v1/contact_types");
      setContactTypes(data);
    } catch (error) {
      console.error("Failed to load contact types:", error);
      toast({
        title: "Error",
        description: "Failed to load contact types",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await api.get<any>("/api/v1/company_settings");
      setContactDocPath(settings.contact_documents_path || "");
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const handleSaveDocPath = async (path?: string) => {
    setSavingPath(true);
    const pathToSave = path !== undefined ? path : contactDocPath;
    try {
      await api.put("/api/v1/company_settings", {
        company_setting: { contact_documents_path: pathToSave },
      });
      toast({
        title: "Success",
        description: "Contact documents path saved successfully",
      });
    } catch (error) {
      console.error("Failed to save path:", error);
      toast({
        title: "Error",
        description: "Failed to save contact documents path",
        variant: "destructive",
      });
    } finally {
      setSavingPath(false);
    }
  };

  const handleFolderSelect = (folder: any, path: string) => {
    const fullPath = path || "";
    setContactDocPath(fullPath);
    handleSaveDocPath(fullPath);
    setShowFolderPicker(false);
  };

  const handleOpenAddDialog = () => {
    setFormData({
      name: "",
      display_name: "",
      tab_label: "",
      description: "",
      active: true,
    });
    setEditingType(null);
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (type: ContactType) => {
    setFormData({
      name: type.name,
      display_name: type.display_name,
      tab_label: type.tab_label || "",
      description: type.description || "",
      active: type.active,
    });
    setEditingType(type);
    setShowAddDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.display_name) {
      toast({
        title: "Error",
        description: "Name and Display Name are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingType) {
        await api.patch(`/api/v1/contact_types/${editingType.id}`, {
          contact_type: formData,
        });
        toast({ title: "Success", description: "Contact type updated" });
      } else {
        await api.post("/api/v1/contact_types", {
          contact_type: formData,
        });
        toast({ title: "Success", description: "Contact type created" });
      }
      setShowAddDialog(false);
      loadData();
    } catch (error: any) {
      console.error("Failed to save contact type:", error);
      const errors = error?.response?.data?.errors || [];
      const errorMsg = Array.isArray(errors)
        ? errors.map((e: any) => typeof e === 'string' ? e : (e.error || JSON.stringify(e))).join("; ")
        : "Failed to save";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this contact type?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/contact_types/${id}`);
      toast({ title: "Success", description: "Contact type deleted" });
      loadData();
    } catch (error: any) {
      console.error("Failed to delete contact type:", error);
      toast({
        title: "Cannot Delete",
        description: error?.response?.data?.error || "Failed to delete contact type",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (type: ContactType) => {
    try {
      await api.patch(`/api/v1/contact_types/${type.id}`, {
        contact_type: { active: !type.active },
      });
      loadData();
    } catch (error) {
      console.error("Failed to toggle active:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleOpenExtractDialog = () => {
    setShowExtractDialog(true);
    setEmailPatterns([]);
    setPreviewData([]);
    setSelectedExtractions(new Set());
  };

  const handlePreviewExtractions = async () => {
    if (emailPatterns.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one email pattern",
        variant: "destructive",
      });
      return;
    }

    setExtracting(true);
    try {
      const result = await api.get<any>("/api/v1/contacts/preview_employee_extraction", {
        params: { email_patterns: emailPatterns.join(',') }
      });
      setPreviewData(result.preview || []);
      // Select all by default
      setSelectedExtractions(new Set(result.preview.map((_: any, idx: number) => idx)));
      toast({
        title: "Preview Ready",
        description: `Found ${result.total_found} contacts to process`,
      });
    } catch (error: any) {
      console.error("Failed to preview:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to preview extractions",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleExecuteExtractions = async () => {
    const selected = previewData.filter((_, idx) => selectedExtractions.has(idx));

    if (selected.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one extraction to execute",
        variant: "destructive",
      });
      return;
    }

    setExtracting(true);
    try {
      const result = await api.post<any>("/api/v1/contacts/extract_employees", {
        extractions: selected
      });
      setExtractionResult(result);
      toast({
        title: "Success",
        description: `Created ${result.employments_created} employment relationships`,
      });
      setShowExtractDialog(false);
    } catch (error: any) {
      console.error("Failed to extract employees:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to extract employees",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const toggleExtraction = (idx: number) => {
    const newSelected = new Set(selectedExtractions);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedExtractions(newSelected);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contacts Settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage contact types and configure where contact documents are stored.
          </p>
        </div>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Type
        </Button>
      </div>

      {/* Contact Documents Path Configuration */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Contact Documents Path</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Select the OneDrive folder where documents associated with contacts should be stored.
            This path will be used when uploading or linking documents to contact records.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFolderPicker(true)}
              className="flex-1 justify-start"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {contactDocPath || "Select Folder..."}
            </Button>
            {contactDocPath && (
              <Button
                variant="ghost"
                onClick={() => {
                  setContactDocPath("");
                  handleSaveDocPath();
                }}
              >
                Clear
              </Button>
            )}
          </div>
          {contactDocPath && (
            <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
              Current path: <span className="font-mono">{contactDocPath}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Employee Extraction Tool */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Employee-Company Relationships</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Search your email warehouse to find people who have communicated with specific email addresses.
            Creates contacts, companies, and employment relationships based on email correspondence.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleOpenExtractDialog}
            >
              <Users className="h-4 w-4 mr-2" />
              Extract Employees
            </Button>
          </div>
          {extractionResult && (
            <div className="bg-muted px-4 py-3 rounded-md space-y-2">
              <div className="text-sm font-medium">Extraction Complete:</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>✓ {extractionResult.employments_created} employment relationships created</div>
                <div>✓ {extractionResult.companies_created} companies created</div>
                <div>✓ {extractionResult.total_employees} employees processed</div>
                <div>✓ {extractionResult.total_employers} employers found</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Tab Label</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contactTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No contact types found. Click &quot;Add Type&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              contactTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {type.name}
                    </div>
                  </TableCell>
                  <TableCell>{type.display_name}</TableCell>
                  <TableCell>{type.tab_label || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={type.active ? "default" : "secondary"}>
                      {type.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleting === type.id}
                        >
                          {deleting === type.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEditDialog(type)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(type)}>
                          {type.active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(type.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Contact Type" : "Add Contact Type"}</DialogTitle>
            <DialogDescription>
              {editingType
                ? "Update the contact type details."
                : "Create a new contact type for categorizing contacts."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name (Internal)</Label>
              <Input
                id="name"
                placeholder="e.g., customer"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })
                }
              />
              <p className="text-xs text-muted-foreground">
                Used internally. Lowercase, no spaces.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                placeholder="e.g., Customer"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tab_label">Tab Label (Optional)</Label>
              <Input
                id="tab_label"
                placeholder="e.g., Customers"
                value={formData.tab_label}
                onChange={(e) => setFormData({ ...formData, tab_label: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Label shown on tabs in the Contacts page.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="e.g., Customer contacts"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingType ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFolderPicker} onOpenChange={setShowFolderPicker}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Contact Documents Folder</DialogTitle>
          </DialogHeader>
          <SharePointFolderBrowser
            onSelect={handleFolderSelect}
            className="max-h-[400px]"
          />
        </DialogContent>
      </Dialog>

      {/* Employee Extraction Wizard */}
      <Dialog open={showExtractDialog} onOpenChange={setShowExtractDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Extract Employee-Company Relationships</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Step 1: Email Selection */}
            <div className="space-y-3">
              <h4 className="font-medium">Step 1: Select Email Addresses</h4>
              <p className="text-sm text-muted-foreground">
                Enter email addresses to search your email warehouse for people who have communicated with them (e.g., rachel@tekna.com.au, accounts@tekna.com.au)
              </p>
              <div className="space-y-2">
                {emailPatterns.map((pattern, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={pattern}
                      onChange={(e) => {
                        const newPatterns = [...emailPatterns];
                        newPatterns[idx] = e.target.value;
                        setEmailPatterns(newPatterns);
                      }}
                      placeholder="email@domain.com"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEmailPatterns(emailPatterns.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailPatterns([...emailPatterns, ""])}
                >
                  Add Email Address
                </Button>
              </div>
              <Button onClick={handlePreviewExtractions} disabled={extracting || emailPatterns.length === 0}>
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  "Search & Preview"
                )}
              </Button>
            </div>

            {/* Step 2: Preview & Confirm */}
            {previewData.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Step 2: Review & Confirm</h4>
                <p className="text-sm text-muted-foreground">
                  Select which employee relationships to create ({selectedExtractions.size} of {previewData.length} selected)
                </p>
                <div className="border rounded-lg max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            checked={selectedExtractions.size === previewData.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedExtractions(new Set(previewData.map((_, idx) => idx)));
                              } else {
                                setSelectedExtractions(new Set());
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedExtractions.has(idx)}
                              onChange={() => toggleExtraction(idx)}
                            />
                          </TableCell>
                          <TableCell>{item.employee_name}</TableCell>
                          <TableCell className="font-mono text-xs">{item.employee_email}</TableCell>
                          <TableCell>{item.company_name}</TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              {item.employment_exists && (
                                <Badge variant="secondary">Already linked</Badge>
                              )}
                              {item.would_create_contact && (
                                <Badge variant="default" className="bg-purple-600">Will create contact</Badge>
                              )}
                              {item.would_create_company && (
                                <Badge variant="outline">Will create company</Badge>
                              )}
                              {item.would_create_employment && !item.employment_exists && (
                                <Badge>Will create link</Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtractDialog(false)}>
              Cancel
            </Button>
            {previewData.length > 0 && (
              <Button onClick={handleExecuteExtractions} disabled={extracting || selectedExtractions.size === 0}>
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  `Create ${selectedExtractions.size} Relationships`
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
