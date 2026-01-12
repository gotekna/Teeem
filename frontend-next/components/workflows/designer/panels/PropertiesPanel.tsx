"use client";

import React, { useState, useEffect } from "react";
import { Node, Edge } from "@xyflow/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  Settings2,
  Database,
  FileQuestion,
} from "lucide-react";
import { api } from "@/lib/api";
import { NODE_TYPE_META, SERVICE_TASK_TYPES, BpmnNodeData } from "../types";

interface DocumentTemplate {
  id: number;
  name: string;
  description?: string;
  category: string;
  output_format: string;
  is_active: boolean;
  sharepoint_linked: boolean;
}

interface PropertiesPanelProps {
  selectedNode: Node<BpmnNodeData> | null;
  selectedEdge: Edge | null;
  onNodeUpdate: (nodeId: string, data: Partial<BpmnNodeData>) => void;
  onEdgeUpdate: (edgeId: string, data: Record<string, unknown>) => void;
}

export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  onNodeUpdate,
  onEdgeUpdate,
}: PropertiesPanelProps) {
  if (!selectedNode && !selectedEdge) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a node or edge to edit properties
      </div>
    );
  }

  if (selectedEdge) {
    return (
      <EdgeProperties edge={selectedEdge} onUpdate={onEdgeUpdate} />
    );
  }

  if (selectedNode) {
    return (
      <NodeProperties node={selectedNode} onUpdate={onNodeUpdate} />
    );
  }

  return null;
}

function NodeProperties({
  node,
  onUpdate,
}: {
  node: Node<BpmnNodeData>;
  onUpdate: (nodeId: string, data: Partial<BpmnNodeData>) => void;
}) {
  const data = node.data;
  const meta = NODE_TYPE_META[data.nodeType];

  const handleChange = (field: string, value: string) => {
    onUpdate(node.id, { [field]: value });
  };

  const handleConfigChange = (field: string, value: string) => {
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    });
  };

  return (
    <div className="space-y-4">
      {/* Node type header */}
      <div
        className={`rounded-lg bg-${meta.color}-50 dark:bg-${meta.color}-950/30 p-3`}
      >
        <p className="text-sm font-medium">{meta.label}</p>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
      </div>

      <Tabs defaultValue="element" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="element" className="text-xs">
            <Settings2 className="mr-1.5 h-3 w-3" />
            Element
          </TabsTrigger>
          <TabsTrigger value="data" className="text-xs">
            <Database className="mr-1.5 h-3 w-3" />
            Data
          </TabsTrigger>
          <TabsTrigger value="docs" className="text-xs">
            <FileQuestion className="mr-1.5 h-3 w-3" />
            Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="element" className="space-y-4 pt-4">
          {/* Basic properties */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={data.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter name..."
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={data.description || ""}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Enter description..."
                rows={2}
              />
            </div>
          </div>

          {/* Type-specific properties */}
          {data.nodeType === "user_task" && (
            <UserTaskProperties data={data} onChange={handleConfigChange} />
          )}

          {data.nodeType === "service_task" && (
            <ServiceTaskProperties data={data} onChange={handleConfigChange} />
          )}

          {data.nodeType === "timer_event" && (
            <TimerEventProperties data={data} onChange={handleConfigChange} />
          )}

          {data.nodeType === "intermediate_event" && (
            <IntermediateEventProperties data={data} onChange={handleConfigChange} />
          )}
        </TabsContent>

        <TabsContent value="data" className="space-y-4 pt-4">
          <div className="rounded-md border border-dashed p-4 text-center">
            <Database className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
              Data Bindings
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure input/output variables and data mappings for this element.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Coming soon...
            </p>
          </div>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4 pt-4">
          <div className="rounded-md border bg-muted p-4 dark:border-border dark:bg-slate-800">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileQuestion className="h-4 w-4 text-blue-500" />
              {meta.label}
            </h4>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              {getNodeDocumentation(data.nodeType)}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getNodeDocumentation(nodeType: string): string {
  const docs: Record<string, string> = {
    start_event:
      "A Start Event marks the beginning of a workflow. Every workflow must have exactly one start event. When the workflow is triggered, execution begins from this point.",
    end_event:
      "An End Event marks the completion of a workflow branch. A workflow can have multiple end events. When execution reaches an end event, that branch terminates.",
    user_task:
      "A User Task requires human interaction. The task is assigned to a user or role and waits for completion. Configure the assignee and optional due date.",
    service_task:
      "A Service Task executes an automated action like sending emails, generating documents, or updating records. Configure the task type and required parameters.",
    exclusive_gateway:
      "An Exclusive Gateway (XOR) represents a decision point where only one outgoing path is taken based on conditions. Configure conditions on the outgoing edges.",
    parallel_gateway:
      "A Parallel Gateway (AND) splits execution into multiple parallel branches or joins multiple branches back together. All outgoing paths are executed simultaneously.",
    timer_event:
      "A Timer Event pauses execution for a specified duration. Use ISO 8601 duration format (e.g., PT1H for 1 hour, P1D for 1 day).",
    intermediate_event:
      "An Intermediate Event can catch or throw events mid-process. Use for message passing, signal handling, or waiting for conditions.",
    sub_process:
      "A Sub-Process contains a nested workflow. It can be collapsed for simplicity or expanded to show details.",
    annotation:
      "An Annotation provides documentation or notes about the workflow. It does not affect execution flow.",
    pool:
      "A Pool represents a participant in the process, typically an organization or system. Contains lanes for different roles.",
    lane:
      "A Lane represents a role or department within a pool. Use to organize tasks by responsibility.",
    data_store_reference:
      "A Data Store Reference represents persistent data storage like a database. Use to indicate where data is read from or written to.",
  };
  return docs[nodeType] || "No documentation available for this element type.";
}

function UserTaskProperties({
  data,
  onChange,
}: {
  data: BpmnNodeData;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-3 border-t pt-3">
      <h4 className="text-sm font-medium">Assignment</h4>

      <div>
        <Label>Assignee Type</Label>
        <Select
          value={data.config?.assignee_type || ""}
          onValueChange={(value) => onChange("assignee_type", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="role">Role</SelectItem>
            <SelectItem value="user">Specific User</SelectItem>
            <SelectItem value="variable">From Variable</SelectItem>
            <SelectItem value="subject_field">From Subject Field</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Assignee Value</Label>
        <Input
          value={data.config?.assignee_value || ""}
          onChange={(e) => onChange("assignee_value", e.target.value)}
          placeholder={
            data.config?.assignee_type === "role"
              ? "e.g., admin, supervisor"
              : "Enter value..."
          }
        />
      </div>

      <div>
        <Label>Due Days</Label>
        <Input
          type="number"
          value={data.config?.due_days || ""}
          onChange={(e) => onChange("due_days", e.target.value)}
          placeholder="Days until due"
        />
      </div>
    </div>
  );
}

function ServiceTaskProperties({
  data,
  onChange,
}: {
  data: BpmnNodeData;
  onChange: (field: string, value: string) => void;
}) {
  const taskType = data.config?.task_type;
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Fetch document templates when task type is generate_document
  useEffect(() => {
    if (taskType === "generate_document") {
      setLoadingTemplates(true);
      api.get<{ success: boolean; document_templates: DocumentTemplate[] }>(
        "/api/v1/document_templates?active_only=true"
      )
        .then((response) => {
          if (response?.success) {
            setTemplates(response.document_templates);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch templates:", err);
        })
        .finally(() => {
          setLoadingTemplates(false);
        });
    }
  }, [taskType]);

  const selectedTemplate = templates.find(
    (t) => t.id === Number(data.config?.template_id)
  );

  return (
    <div className="space-y-3 border-t pt-3">
      <h4 className="text-sm font-medium">Service Task</h4>

      <div>
        <Label>Task Type</Label>
        <Select
          value={taskType || ""}
          onValueChange={(value) => onChange("task_type", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select task type..." />
          </SelectTrigger>
          <SelectContent>
            {SERVICE_TASK_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {taskType === "generate_document" && (
        <div className="space-y-3">
          <div>
            <Label>Document Template</Label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Spinner size={16} />
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
                <FileText className="mx-auto mb-1 h-5 w-5" />
                No document templates found.
                <br />
                <span className="text-xs">Create templates in Settings.</span>
              </div>
            ) : (
              <Select
                value={data.config?.template_id?.toString() || ""}
                onValueChange={(value) => onChange("template_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{template.name}</span>
                        {!template.sharepoint_linked && (
                          <Badge variant="outline" className="text-xs">
                            Not linked
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedTemplate && (
            <div className="rounded-md bg-muted p-3 text-sm dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedTemplate.name}</span>
              </div>
              {selectedTemplate.description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedTemplate.description}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <Badge variant="secondary" className="text-xs">
                  {selectedTemplate.category}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {selectedTemplate.output_format.toUpperCase()}
                </Badge>
                {selectedTemplate.sharepoint_linked ? (
                  <Badge variant="default" className="bg-green-600 text-xs">
                    Storage Linked
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    Not Linked
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div>
            <Label>Output Destination</Label>
            <Select
              value={data.config?.output_destination || ""}
              onValueChange={(value) => onChange("output_destination", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Where to save..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="job_documents">Job Documents Folder</SelectItem>
                <SelectItem value="sharepoint">Cloud Storage (same location as template)</SelectItem>
                <SelectItem value="email_attachment">Email as Attachment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {taskType === "send_email" && (
        <>
          <div>
            <Label>Subject</Label>
            <Input
              value={data.config?.subject || ""}
              onChange={(e) => onChange("subject", e.target.value)}
              placeholder="Email subject (use {{variable}} for interpolation)"
            />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea
              value={data.config?.body || ""}
              onChange={(e) => onChange("body", e.target.value)}
              placeholder="Email body..."
              rows={4}
            />
          </div>
          <div>
            <Label>Recipient Type</Label>
            <Select
              value={data.config?.recipient_type || ""}
              onValueChange={(value) => onChange("recipient_type", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="static">Static Email</SelectItem>
                <SelectItem value="variable">From Variable</SelectItem>
                <SelectItem value="role">Users with Role</SelectItem>
                <SelectItem value="subject_field">From Subject Field</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Recipient Value</Label>
            <Input
              value={data.config?.recipient_value || ""}
              onChange={(e) => onChange("recipient_value", e.target.value)}
              placeholder="Email or variable name..."
            />
          </div>
        </>
      )}

      {taskType === "set_variable" && (
        <div>
          <Label>Variables (JSON)</Label>
          <Textarea
            value={
              typeof data.config?.variables === "object"
                ? JSON.stringify(data.config.variables, null, 2)
                : ""
            }
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange("variables", JSON.stringify(parsed));
              } catch {
                // Allow invalid JSON while typing
              }
            }}
            placeholder='{"varName": "value"}'
            rows={4}
            className="font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}

function TimerEventProperties({
  data,
  onChange,
}: {
  data: BpmnNodeData;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-3 border-t pt-3">
      <h4 className="text-sm font-medium">Timer</h4>

      <div>
        <Label>Duration (ISO 8601)</Label>
        <Input
          value={data.config?.duration || ""}
          onChange={(e) => onChange("duration", e.target.value)}
          placeholder="e.g., PT1H (1 hour), P1D (1 day)"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          PT1H = 1 hour, PT30M = 30 minutes, P1D = 1 day
        </p>
      </div>
    </div>
  );
}

function IntermediateEventProperties({
  data,
  onChange,
}: {
  data: BpmnNodeData;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-3 border-t pt-3">
      <h4 className="text-sm font-medium">Intermediate Event</h4>

      <div>
        <Label>Event Type</Label>
        <Select
          value={(data.config?.eventType as string) || "message"}
          onValueChange={(value) => onChange("eventType", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select event type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="message">Message</SelectItem>
            <SelectItem value="timer">Timer</SelectItem>
            <SelectItem value="signal">Signal</SelectItem>
            <SelectItem value="conditional">Conditional</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isThrowing"
          checked={(data.config?.isThrowing as boolean) || false}
          onChange={(e) => onChange("isThrowing", String(e.target.checked))}
          className="h-4 w-4"
        />
        <Label htmlFor="isThrowing" className="cursor-pointer">
          Throwing (sends event)
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Catching events wait for triggers. Throwing events send signals.
      </p>
    </div>
  );
}

function EdgeProperties({
  edge,
  onUpdate,
}: {
  edge: Edge;
  onUpdate: (edgeId: string, data: Record<string, unknown>) => void;
}) {
  const data = (edge.data || {}) as Record<string, unknown>;
  const name = (data.name as string) || "";
  const conditionExpression = (data.conditionExpression as string) || "";
  const isDefault = (data.isDefault as boolean) || false;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted p-3 dark:bg-slate-800">
        <p className="text-sm font-medium">Sequence Flow</p>
        <p className="text-xs text-muted-foreground">Connection between nodes</p>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Label</Label>
          <Input
            value={name}
            onChange={(e) =>
              onUpdate(edge.id, { ...data, name: e.target.value })
            }
            placeholder="Optional label..."
          />
        </div>

        <div>
          <Label>Condition Expression</Label>
          <Textarea
            value={conditionExpression}
            onChange={(e) =>
              onUpdate(edge.id, {
                ...data,
                conditionExpression: e.target.value,
              })
            }
            placeholder="e.g., status == 'approved'"
            rows={3}
            className="font-mono text-xs"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Leave empty for unconditional flow
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isDefault"
            checked={isDefault}
            onChange={(e) =>
              onUpdate(edge.id, { ...data, isDefault: e.target.checked })
            }
            className="h-4 w-4"
          />
          <Label htmlFor="isDefault" className="cursor-pointer">
            Default path (if no conditions match)
          </Label>
        </div>
      </div>
    </div>
  );
}
