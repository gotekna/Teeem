"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
  Users,
  FolderOpen,
  ArrowRight,
  Settings2,
  Check,
  X,
  Info,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";
import { Spinner } from "@/components/ui/spinner";
import { fetchEntityTypes, EntityTypeMetadata } from "@/lib/entity-types";
import { useConfirm } from "@/contexts/ConfirmationContext";

// Entity type field configuration - defines which fields are used/required for each type
const ENTITY_TYPE_FIELDS = [
  { field: "first_name", label: "First Name", description: "Person's first name" },
  { field: "middle_name", label: "Middle Name", description: "Person's middle name" },
  { field: "last_name", label: "Last Name", description: "Person's last name" },
  { field: "company_name_or_trust", label: "Company/Trust Name", description: "Business entity name - updates display_name on save" },
  { field: "display_name", label: "Display Name", description: "Display name (auto-synced from name fields)" },
  { field: "email", label: "Email", description: "Primary email address" },
  { field: "phone", label: "Phone", description: "Primary phone number" },
  { field: "website", label: "Website", description: "Website URL" },
  { field: "address", label: "Address", description: "Physical address" },
  { field: "abn", label: "ABN/Tax Number", description: "Australian Business Number (11 digits)" },
  { field: "employees", label: "Can Have Employees", description: "Can have people linked as employees" },
  { field: "employer", label: "Can Have Employer", description: "Can be linked to a company as employee" },
];

// Field applicability matrix - which fields apply to which entity types
const FIELD_MATRIX: Record<string, Record<string, "required" | "optional" | "computed" | "na">> = {
  person: {
    first_name: "required",
    middle_name: "optional",
    last_name: "required",
    company_name_or_trust: "na",
    display_name: "computed", // computed from first + middle + last
    email: "optional",
    phone: "optional",
    website: "optional",
    address: "optional",
    abn: "optional", // only if sole trader with ABN
    employees: "na",
    employer: "optional",
  },
  sole_trader: {
    first_name: "required",
    middle_name: "optional",
    last_name: "required",
    company_name_or_trust: "na",
    display_name: "computed",
    email: "optional",
    phone: "optional",
    website: "optional",
    address: "optional",
    abn: "optional",
    employees: "optional",
    employer: "na",
  },
  company: {
    first_name: "na",
    middle_name: "na",
    last_name: "na",
    company_name_or_trust: "required",
    display_name: "required", // SSoT: company_name_or_trust syncs TO display_name
    email: "optional",
    phone: "optional",
    website: "optional",
    address: "optional",
    abn: "optional",
    employees: "optional",
    employer: "na",
  },
  trust: {
    first_name: "na",
    middle_name: "na",
    last_name: "na",
    company_name_or_trust: "required",
    display_name: "required", // SSoT: company_name_or_trust syncs TO display_name
    email: "optional",
    phone: "optional",
    website: "optional",
    address: "optional",
    abn: "optional",
    employees: "optional",
    employer: "na",
  },
  price_only: {
    first_name: "na",
    middle_name: "na",
    last_name: "na",
    company_name_or_trust: "na",
    display_name: "required", // only field used - AUTO UPPERCASE on save
    email: "na",
    phone: "na",
    website: "na",
    address: "na",
    abn: "na",
    employees: "na",
    employer: "na",
  },
};

function FieldStatusBadge({ status }: { status: "required" | "optional" | "computed" | "na" }) {
  switch (status) {
    case "required":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Required</Badge>;
    case "optional":
      return <Badge variant="outline" className="text-blue-600 border-blue-300">Optional</Badge>;
    case "computed":
      return <Badge variant="outline" className="text-purple-600 border-purple-300">Auto</Badge>;
    case "na":
      return <span className="text-muted-foreground text-xs">—</span>;
  }
}

function EntityTypesReferenceCard() {
  const [entityTypes, setEntityTypes] = React.useState<EntityTypeMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchEntityTypes()
      .then((response) => {
        setEntityTypes(response.metadata);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <Spinner size={24} className="text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Entity Types Reference</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          This table shows which fields are used for each entity type. The database column updated depends on the entity type.
          <strong className="text-foreground"> SSoT:</strong> Backend <code className="text-xs bg-muted px-1 rounded">Contact::ENTITY_TYPES</code>
        </p>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm border-b pb-3">
          <div className="flex items-center gap-1.5">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs">Required</Badge>
            <span className="text-muted-foreground">Must be filled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">Optional</Badge>
            <span className="text-muted-foreground">Can be filled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-purple-600 border-purple-300 text-xs">Auto</Badge>
            <span className="text-muted-foreground">Computed automatically</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">—</span>
            <span className="text-muted-foreground">Not applicable (ignored)</span>
          </div>
        </div>

        {/* Entity Type Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entityTypes.map((entityType) => {
            const fieldMatrix = FIELD_MATRIX[entityType.value] || {};
            return (
              <div key={entityType.value} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{entityType.label}</h4>
                    <p className="text-xs text-muted-foreground">{entityType.description}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {entityType.value}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  {ENTITY_TYPE_FIELDS.map((field) => {
                    const status = fieldMatrix[field.field] || "na";
                    if (status === "na") return null; // Don't show N/A fields
                    return (
                      <div key={field.field} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{field.label}</span>
                        <FieldStatusBadge status={status} />
                      </div>
                    );
                  })}
                </div>

                {/* Special notes for entity type */}
                {entityType.value === "price_only" && (
                  <div className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 px-2 py-1.5 rounded border border-amber-200 dark:border-amber-800">
                    <strong>Auto-uppercase:</strong> Name is automatically converted to CAPITALS on save
                  </div>
                )}

                {/* Capabilities */}
                <div className="pt-2 border-t space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    {entityType.can_have_employees ? (
                      <span className="flex items-center gap-1 text-green-600"><Check className="h-3 w-3" /> Can have employees</span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground"><X className="h-3 w-3" /> No employees</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {entityType.can_have_employer ? (
                      <span className="flex items-center gap-1 text-green-600"><Check className="h-3 w-3" /> Can have employer</span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground"><X className="h-3 w-3" /> No employer</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full Matrix Table */}
        <div className="pt-4 border-t">
          <h4 className="font-medium mb-3">Full Field Matrix</h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background">Field</TableHead>
                  {entityTypes.map((et) => (
                    <TableHead key={et.value} className="text-center whitespace-nowrap">
                      {et.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ENTITY_TYPE_FIELDS.map((field) => (
                  <TableRow key={field.field}>
                    <TableCell className="sticky left-0 bg-background font-medium">
                      <div>
                        {field.label}
                        <p className="text-xs text-muted-foreground font-normal">{field.description}</p>
                      </div>
                    </TableCell>
                    {entityTypes.map((et) => {
                      const matrix = FIELD_MATRIX[et.value] || {};
                      const status = matrix[field.field] || "na";
                      return (
                        <TableCell key={et.value} className="text-center">
                          <FieldStatusBadge status={status} />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Card>
  );
}

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
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [contactTypes, setContactTypes] = React.useState<ContactType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [editingType, setEditingType] = React.useState<ContactType | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);
  const [contactDocPath, setContactDocPath] = React.useState("");
  const [contactFolderFormat, setContactFolderFormat] = React.useState("id_name");
  const [savingPath, setSavingPath] = React.useState(false);
  const [savingFormat, setSavingFormat] = React.useState(false);
  const [showFolderPicker, setShowFolderPicker] = React.useState(false);

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
      // Load contact documents path from company_settings
      const settings = await api.get<any>("/api/v1/company_settings");
      setContactDocPath(settings.contact_documents_path || "");

      // SSoT: Load folder format from StorageConfiguration templates
      const storageConfig = await api.get<{ success: boolean; data: any }>("/api/v1/storage_configuration");
      const contactTemplate = storageConfig.data?.scope_templates?.contact || "{{ContactId}} - {{ContactName}}";
      setContactFolderFormat(templateToFormat(contactTemplate));
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  // SSoT: Map dropdown value to StorageConfiguration template string
  const formatToTemplate: Record<string, string> = {
    id_name: "{{ContactId}} - {{ContactName}}",
    id_only: "{{ContactId}}",
    name_only: "{{ContactName}}",
  };

  const templateToFormat = (template: string): string => {
    if (template.includes("{{ContactId}}") && template.includes("{{ContactName}}")) return "id_name";
    if (template.includes("{{ContactId}}") && !template.includes("{{ContactName}}")) return "id_only";
    if (!template.includes("{{ContactId}}") && template.includes("{{ContactName}}")) return "name_only";
    return "id_name";
  };

  const handleSaveFolderFormat = async (format: string) => {
    setSavingFormat(true);
    setContactFolderFormat(format);
    try {
      // SSoT: Save to StorageConfiguration templates
      await api.patch("/api/v1/storage_configuration", {
        storage: { scope_templates: { contact: formatToTemplate[format] } },
      });
      toast({
        title: "Success",
        description: "Folder naming format saved successfully",
      });
    } catch (error) {
      console.error("Failed to save folder format:", error);
      toast({
        title: "Error",
        description: "Failed to save folder naming format",
        variant: "destructive",
      });
    } finally {
      setSavingFormat(false);
    }
  };

  // Generate folder name preview based on format
  const getFolderNameExample = (format: string) => {
    const exampleContact = { id: 456, name: "All Clear Electrical" };
    switch (format) {
      case "id_name":
        return `${exampleContact.id} - ${exampleContact.name}`;
      case "name_only":
        return exampleContact.name;
      case "id_only":
        return `${exampleContact.id}`;
      default:
        return `${exampleContact.id} - ${exampleContact.name}`;
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
    if (!(await confirm("Are you sure you want to delete this contact type?"))) return;

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

  const handleOpenExtractPage = () => {
    router.push("/admin/system/extract-employees");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contacts Settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage contact types, entity types, and configure where contact documents are stored.
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
            Select the SharePoint folder where documents associated with contacts should be stored.
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

      {/* Contact Folder Naming Format */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Contact Folder Naming</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Choose how contact folders are named. Using the Contact ID ensures all documents for a supplier
            (e.g., All Clear Electrical) sort together and remain consistent even if the contact name changes.
          </p>
          <div className="space-y-3">
            <Select
              value={contactFolderFormat}
              onValueChange={handleSaveFolderFormat}
              disabled={savingFormat}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select folder naming format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id_name">ID + Name - Recommended (e.g., &quot;456 - All Clear Electrical&quot;)</SelectItem>
                <SelectItem value="id_only">ID Only (e.g., &quot;456&quot;)</SelectItem>
                <SelectItem value="name_only">Name Only (e.g., &quot;All Clear Electrical&quot;)</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
              <span className="font-medium">Preview:</span>{" "}
              <span className="font-mono">{contactDocPath || "Contacts"}/{getFolderNameExample(contactFolderFormat)}/BILLS/</span>
            </div>
          </div>
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
            <Button onClick={handleOpenExtractPage}>
              <Users className="h-4 w-4 mr-2" />
              Extract Employees
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Entity Types Reference */}
      <EntityTypesReferenceCard />

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
                            <Spinner size={16} />
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
                  <Spinner size={16} className="mr-2" />
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
    </div>
  );
}
