"use client";

import React from "react";
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
import { NODE_TYPE_META, SERVICE_TASK_TYPES, BpmnNodeData } from "../types";

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
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
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
        <p className="text-xs text-slate-500">{meta.description}</p>
      </div>

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
    </div>
  );
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
        <p className="mt-1 text-xs text-slate-500">
          PT1H = 1 hour, PT30M = 30 minutes, P1D = 1 day
        </p>
      </div>
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
      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
        <p className="text-sm font-medium">Sequence Flow</p>
        <p className="text-xs text-slate-500">Connection between nodes</p>
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
          <p className="mt-1 text-xs text-slate-500">
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
