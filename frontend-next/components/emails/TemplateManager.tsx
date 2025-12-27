"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  FileText,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Star,
  StarOff,
  Search,
  Zap,
  Share2,
  Code,
  Eye,
} from "lucide-react";

// Types
export interface EmailTemplate {
  id: number;
  name: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  variables: string[];
  category: string | null;
  category_label: string | null;
  is_shared: boolean;
  is_favorite: boolean;
  usage_count: number;
  position: number;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateCategory {
  value: string;
  label: string;
}

export interface SystemVariable {
  name: string;
  description: string;
  token: string;
}

// API Response Types
interface TemplatesResponse {
  data: { templates: EmailTemplate[]; categories: Record<string, string>; system_variables: Record<string, string> };
}

interface QuickRepliesResponse {
  data: { templates: EmailTemplate[] };
}

interface VariablesResponse {
  data: { variables: SystemVariable[] };
}

interface CategoriesResponse {
  data: { categories: TemplateCategory[] };
}

interface TemplateResponse {
  data: EmailTemplate;
}

interface ApplyTemplateResponse {
  data: { subject: string; body_html: string; body_text: string; missing_variables: string[] };
}

interface ToggleFavoriteResponse {
  data: { is_favorite: boolean };
}

interface CreateDefaultsResponse {
  data: { templates: EmailTemplate[] };
}

// API Functions
async function fetchTemplates(params?: {
  category?: string;
  favorites?: boolean;
  search?: string;
}): Promise<{ templates: EmailTemplate[]; categories: Record<string, string>; system_variables: Record<string, string> }> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.favorites) searchParams.set("favorites", "true");
  if (params?.search) searchParams.set("search", params.search);

  const response = await api.get<TemplatesResponse>(`/api/v1/email_templates?${searchParams.toString()}`);
  return (response as TemplatesResponse).data;
}

async function fetchQuickReplies(): Promise<EmailTemplate[]> {
  const response = await api.get<QuickRepliesResponse>("/api/v1/email_templates/quick_replies");
  return (response as QuickRepliesResponse).data.templates || [];
}

async function fetchVariables(): Promise<SystemVariable[]> {
  const response = await api.get<VariablesResponse>("/api/v1/email_templates/variables");
  return (response as VariablesResponse).data.variables || [];
}

async function fetchCategories(): Promise<TemplateCategory[]> {
  const response = await api.get<CategoriesResponse>("/api/v1/email_templates/categories");
  return (response as CategoriesResponse).data.categories || [];
}

async function createTemplate(data: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const response = await api.post<TemplateResponse>("/api/v1/email_templates", { template: data });
  return (response as TemplateResponse).data;
}

async function updateTemplate(id: number, data: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const response = await api.patch<TemplateResponse>(`/api/v1/email_templates/${id}`, { template: data });
  return (response as TemplateResponse).data;
}

async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`/api/v1/email_templates/${id}`);
}

async function applyTemplate(
  id: number,
  context: Record<string, string>
): Promise<{ subject: string; body_html: string; body_text: string; missing_variables: string[] }> {
  const response = await api.post<ApplyTemplateResponse>(`/api/v1/email_templates/${id}/apply`, { context });
  return (response as ApplyTemplateResponse).data;
}

async function duplicateTemplate(id: number, newName?: string): Promise<EmailTemplate> {
  const response = await api.post<TemplateResponse>(`/api/v1/email_templates/${id}/duplicate`, { new_name: newName });
  return (response as TemplateResponse).data;
}

async function toggleFavorite(id: number): Promise<{ is_favorite: boolean }> {
  const response = await api.post<ToggleFavoriteResponse>(`/api/v1/email_templates/${id}/toggle_favorite`);
  return (response as ToggleFavoriteResponse).data;
}

async function createDefaults(): Promise<EmailTemplate[]> {
  const response = await api.post<CreateDefaultsResponse>("/api/v1/email_templates/create_defaults");
  return (response as CreateDefaultsResponse).data.templates || [];
}

// Variable Badge Component
interface VariableBadgeProps {
  variable: string;
  onClick?: () => void;
}

export function VariableBadge({ variable, onClick }: VariableBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-xs cursor-pointer hover:bg-muted",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <Code className="h-3 w-3 mr-1" />
      {`{{${variable}}}`}
    </Badge>
  );
}

// Template Editor Dialog
interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: EmailTemplate | null;
  categories: TemplateCategory[];
  variables: SystemVariable[];
  onSave: (data: Partial<EmailTemplate>) => Promise<void>;
}

function TemplateEditor({
  open,
  onOpenChange,
  template,
  categories,
  variables,
  onSave,
}: TemplateEditorProps) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [category, setCategory] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (open) {
      setName(template?.name || "");
      setSubject(template?.subject || "");
      setBodyHtml(template?.body_html || "");
      setCategory(template?.category || "");
      setIsShared(template?.is_shared || false);
      setError(null);
      setPreviewMode(false);
    }
  }, [open, template]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        subject: subject.trim() || null,
        body_html: bodyHtml.trim() || null,
        category: category || null,
        is_shared: isShared,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (varName: string) => {
    const token = `{{${varName}}}`;
    setBodyHtml((prev) => prev + token);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Template" : "Create Template"}
          </DialogTitle>
          <DialogDescription>
            Create reusable email templates with variable placeholders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name *</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Follow-up Email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-category">Category</Label>
              <Select value={category || "__none__"} onValueChange={(v) => setCategory(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-subject">Subject Line</Label>
            <Input
              id="template-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Following up - {{original_subject}}"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="template-body">Body</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {previewMode ? "Edit" : "Preview"}
              </Button>
            </div>

            {previewMode ? (
              <div
                className="min-h-[200px] border rounded-md p-4 prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              <Textarea
                id="template-body"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder="<p>Hi {{recipient_name}},</p><p>...</p>"
                className="min-h-[200px] font-mono text-sm"
              />
            )}
          </div>

          {/* Variable Palette */}
          <div className="space-y-2">
            <Label>Insert Variable</Label>
            <div className="flex flex-wrap gap-2">
              {variables.slice(0, 8).map((v) => (
                <VariableBadge
                  key={v.name}
                  variable={v.name}
                  onClick={() => insertVariable(v.name)}
                />
              ))}
              {variables.length > 8 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      +{variables.length - 8} more
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">All Variables</p>
                      <div className="flex flex-wrap gap-2">
                        {variables.map((v) => (
                          <VariableBadge
                            key={v.name}
                            variable={v.name}
                            onClick={() => insertVariable(v.name)}
                          />
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="template-shared"
              checked={isShared}
              onCheckedChange={(checked) => setIsShared(checked === true)}
            />
            <Label htmlFor="template-shared" className="font-normal">
              <Share2 className="h-4 w-4 inline mr-1" />
              Share with team
            </Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Spinner className="mr-2 h-4 w-4" />}
            {template ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Template Card Component
interface TemplateCardProps {
  template: EmailTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  onSelect?: () => void;
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  onSelect,
}: TemplateCardProps) {
  return (
    <div
      className={cn(
        "group border rounded-lg p-4 hover:border-primary/50 transition-colors",
        onSelect && "cursor-pointer"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{template.name}</h3>
            {template.is_favorite && (
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            )}
            {template.is_shared && (
              <Share2 className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          {template.subject && (
            <p className="text-sm text-muted-foreground truncate mt-1">
              {template.subject}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {template.category_label && (
              <Badge variant="secondary" className="text-xs">
                {template.category_label}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Used {template.usage_count} times
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
              {template.is_favorite ? (
                <>
                  <StarOff className="h-4 w-4 mr-2" />
                  Remove from favorites
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  Add to favorites
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {template.variables.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {template.variables.slice(0, 3).map((v) => (
            <Badge key={v} variant="outline" className="text-xs font-mono">
              {`{{${v}}}`}
            </Badge>
          ))}
          {template.variables.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{template.variables.length - 3} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// Template Picker (for compose modal)
interface TemplatePickerProps {
  onSelect: (template: EmailTemplate, applied: { subject: string; body_html: string; body_text: string }) => void;
  context?: Record<string, string>;
  trigger?: React.ReactNode;
  /** Controlled open state (optional) */
  open?: boolean;
  /** Callback when open state changes (required if `open` is controlled) */
  onOpenChange?: (open: boolean) => void;
}

export function TemplatePicker({ onSelect, context = {}, trigger, open: controlledOpen, onOpenChange }: TemplatePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [quickReplies, setQuickReplies] = useState<EmailTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [applying, setApplying] = useState<number | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const [allData, quickData] = await Promise.all([
        fetchTemplates({ search: search || undefined }),
        fetchQuickReplies(),
      ]);
      setTemplates(allData.templates);
      setQuickReplies(quickData);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open, loadTemplates]);

  const handleSelect = async (template: EmailTemplate) => {
    setApplying(template.id);
    try {
      const result = await applyTemplate(template.id, context);
      onSelect(template, result);
      setOpen(false);
    } catch (error) {
      console.error("Failed to apply template:", error);
    } finally {
      setApplying(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <Tabs defaultValue="quick" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b">
              <TabsTrigger value="quick" className="gap-1">
                <Zap className="h-3 w-3" />
                Quick
              </TabsTrigger>
              <TabsTrigger value="all">All Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="m-0">
              <div className="max-h-[300px] overflow-y-auto">
                {quickReplies.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No quick replies yet. Mark templates as favorites!
                  </p>
                ) : (
                  quickReplies.map((template) => (
                    <button
                      key={template.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-0"
                      onClick={() => handleSelect(template)}
                      disabled={applying === template.id}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{template.name}</span>
                        {applying === template.id && (
                          <Spinner className="h-4 w-4" />
                        )}
                      </div>
                      {template.body_text && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {template.body_text}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="all" className="m-0">
              <div className="max-h-[300px] overflow-y-auto">
                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No templates found
                  </p>
                ) : (
                  templates.map((template) => (
                    <button
                      key={template.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-0"
                      onClick={() => handleSelect(template)}
                      disabled={applying === template.id}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{template.name}</span>
                          {template.is_favorite && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                        {applying === template.id && (
                          <Spinner className="h-4 w-4" />
                        )}
                      </div>
                      {template.category_label && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          {template.category_label}
                        </Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Main Template Manager Component
interface TemplateManagerProps {
  onTemplateSelect?: (template: EmailTemplate) => void;
}

export function TemplateManager({ onTemplateSelect }: TemplateManagerProps) {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [variables, setVariables] = useState<SystemVariable[]>([]);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<EmailTemplate | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showFavorites, setShowFavorites] = useState(false);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [templateData, catData, varData] = await Promise.all([
        fetchTemplates({
          category: categoryFilter || undefined,
          favorites: showFavorites || undefined,
          search: search || undefined,
        }),
        fetchCategories(),
        fetchVariables(),
      ]);
      setTemplates(templateData.templates);
      setCategories(catData);
      setVariables(varData);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, showFavorites, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (data: Partial<EmailTemplate>) => {
    await createTemplate(data);
    await loadData();
  };

  const handleUpdate = async (data: Partial<EmailTemplate>) => {
    if (!editTemplate) return;
    await updateTemplate(editTemplate.id, data);
    setEditTemplate(null);
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteTemplate(deleteConfirm.id);
    setDeleteConfirm(null);
    await loadData();
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    await duplicateTemplate(template.id);
    await loadData();
  };

  const handleToggleFavorite = async (template: EmailTemplate) => {
    await toggleFavorite(template.id);
    await loadData();
  };

  const handleCreateDefaults = async () => {
    await createDefaults();
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const favoriteTemplates = templates.filter((t) => t.is_favorite);
  const regularTemplates = templates.filter((t) => !t.is_favorite);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-64"
            />
          </div>

          <Select value={categoryFilter || "__all__"} onValueChange={(v) => setCategoryFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showFavorites ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFavorites(!showFavorites)}
          >
            <Star className={cn("h-4 w-4 mr-1", showFavorites && "fill-current")} />
            Favorites
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {templates.length === 0 && (
            <Button variant="outline" onClick={handleCreateDefaults}>
              <Zap className="h-4 w-4 mr-2" />
              Create Defaults
            </Button>
          )}
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Favorites Section */}
      {favoriteTemplates.length > 0 && !showFavorites && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            Favorites
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoriteTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={() => setEditTemplate(template)}
                onDelete={() => setDeleteConfirm(template)}
                onDuplicate={() => handleDuplicate(template)}
                onToggleFavorite={() => handleToggleFavorite(template)}
                onSelect={onTemplateSelect ? () => onTemplateSelect(template) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Templates */}
      <div>
        {favoriteTemplates.length > 0 && !showFavorites && (
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            All Templates
          </h3>
        )}

        {(showFavorites ? favoriteTemplates : regularTemplates).length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              {showFavorites
                ? "No favorite templates yet"
                : "No templates found"}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(showFavorites ? favoriteTemplates : regularTemplates).map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={() => setEditTemplate(template)}
                onDelete={() => setDeleteConfirm(template)}
                onDuplicate={() => handleDuplicate(template)}
                onToggleFavorite={() => handleToggleFavorite(template)}
                onSelect={onTemplateSelect ? () => onTemplateSelect(template) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <TemplateEditor
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        categories={categories}
        variables={variables}
        onSave={handleCreate}
      />

      {/* Edit Dialog */}
      <TemplateEditor
        open={!!editTemplate}
        onOpenChange={(open) => !open && setEditTemplate(null)}
        template={editTemplate}
        categories={categories}
        variables={variables}
        onSave={handleUpdate}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm?.name}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Hook for using templates
export function useEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTemplates();
      setTemplates(data.templates);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const apply = useCallback(async (templateId: number, context: Record<string, string>) => {
    return applyTemplate(templateId, context);
  }, []);

  return {
    templates,
    loading,
    refresh: loadTemplates,
    apply,
  };
}

export default TemplateManager;
