"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Copy,
  Trash2,
  Folder,
  FolderTree,
  ChevronRight,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FolderTemplateItem {
  id: number;
  name: string;
  item_type: "folder" | "file";
  parent_id: number | null;
  order: number;
  children?: FolderTemplateItem[];
}

interface FolderTemplate {
  id: number;
  name: string;
  description: string;
  template_type: "system" | "user";
  items: FolderTemplateItem[];
  created_at: string;
}

function buildTree(items: FolderTemplateItem[]): FolderTemplateItem[] {
  const itemMap = new Map<number, FolderTemplateItem>();
  const roots: FolderTemplateItem[] = [];

  // First pass: create map
  items.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  // Second pass: build tree
  items.forEach((item) => {
    const node = itemMap.get(item.id)!;
    if (item.parent_id === null) {
      roots.push(node);
    } else {
      const parent = itemMap.get(item.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    }
  });

  // Sort children by order
  const sortChildren = (items: FolderTemplateItem[]) => {
    items.sort((a, b) => a.order - b.order);
    items.forEach((item) => {
      if (item.children && item.children.length > 0) {
        sortChildren(item.children);
      }
    });
  };

  sortChildren(roots);
  return roots;
}

function FolderTreeView({ items, level = 0 }: { items: FolderTemplateItem[]; level?: number }) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.id}>
          <div
            className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50"
            style={{ paddingLeft: `${level * 16 + 8}px` }}
          >
            {item.item_type === "folder" ? (
              <Folder className="h-4 w-4 text-yellow-500" />
            ) : (
              <FileText className="h-4 w-4 text-blue-500" />
            )}
            <span className="text-sm">{item.name}</span>
          </div>
          {item.children && item.children.length > 0 && (
            <FolderTreeView items={item.children} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );
}

export function FoldersTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<FolderTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [duplicating, setDuplicating] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState<number | null>(null);

  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await api.get<FolderTemplate[]>("/api/v1/folder_templates");
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
      // Mock data
      setTemplates([
        {
          id: 1,
          name: "Standard Job Folder",
          description: "Default folder structure for new jobs",
          template_type: "system",
          items: [
            { id: 1, name: "01 - Pre-Construction", item_type: "folder", parent_id: null, order: 1 },
            { id: 2, name: "Contracts", item_type: "folder", parent_id: 1, order: 1 },
            { id: 3, name: "Permits", item_type: "folder", parent_id: 1, order: 2 },
            { id: 4, name: "02 - Construction", item_type: "folder", parent_id: null, order: 2 },
            { id: 5, name: "Daily Reports", item_type: "folder", parent_id: 4, order: 1 },
            { id: 6, name: "Site Photos", item_type: "folder", parent_id: 4, order: 2 },
            { id: 7, name: "03 - Completion", item_type: "folder", parent_id: null, order: 3 },
            { id: 8, name: "Handover", item_type: "folder", parent_id: 7, order: 1 },
            { id: 9, name: "Warranties", item_type: "folder", parent_id: 7, order: 2 },
          ],
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: "Quote Folder",
          description: "Folder structure for quotes and proposals",
          template_type: "user",
          items: [
            { id: 10, name: "Documents", item_type: "folder", parent_id: null, order: 1 },
            { id: 11, name: "Images", item_type: "folder", parent_id: null, order: 2 },
            { id: 12, name: "Revisions", item_type: "folder", parent_id: null, order: 3 },
          ],
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    setDuplicating(id);
    try {
      await api.post(`/api/v1/folder_templates/${id}/duplicate`);
      toast({ title: "Success", description: "Template duplicated successfully" });
      loadTemplates();
    } catch (error) {
      console.error("Failed to duplicate template:", error);
      toast({ title: "Error", description: "Failed to duplicate template", variant: "destructive" });
    } finally {
      setDuplicating(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/folder_templates/${id}`);
      toast({ title: "Success", description: "Template deleted successfully" });
      loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const systemTemplates = templates.filter((t) => t.template_type === "system");
  const userTemplates = templates.filter((t) => t.template_type === "user");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Folder Templates</h2>
      </div>

      {/* System Templates */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">System Templates</h3>
        {systemTemplates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No system templates found.
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {systemTemplates.map((template) => {
              const tree = buildTree(template.items);
              return (
                <AccordionItem key={template.id} value={String(template.id)} className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <FolderTree className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-xs text-muted-foreground">{template.description}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        System
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 border rounded-lg p-3 bg-muted/30">
                        <FolderTreeView items={tree} />
                      </div>
                      <div className="ml-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={duplicating === template.id}
                            >
                              {duplicating === template.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {/* User Templates */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">User Templates</h3>
        {userTemplates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No user templates found. Duplicate a system template to create one.
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {userTemplates.map((template) => {
              const tree = buildTree(template.items);
              return (
                <AccordionItem key={template.id} value={String(template.id)} className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <FolderTree className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-xs text-muted-foreground">{template.description}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-2">
                        Custom
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 border rounded-lg p-3 bg-muted/30">
                        <FolderTreeView items={tree} />
                      </div>
                      <div className="ml-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={duplicating === template.id || deleting === template.id}
                            >
                              {(duplicating === template.id || deleting === template.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(template.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}
