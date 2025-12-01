"use client";

import { useState } from "react";
import { Lead, LeadStatus, LEAD_STATUS_CONFIG } from "@/types/leads";
import { LeadCard } from "./lead-card";
import { cn } from "@/lib/utils";

interface LeadPipelineProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onStatusChange: (leadId: number, newStatus: LeadStatus) => void;
}

const PIPELINE_COLUMNS: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "contract_sent",
  "won",
  "lost",
];

export function LeadPipeline({
  leads,
  onLeadClick,
  onStatusChange,
}: LeadPipelineProps) {
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter((lead) => lead.status === status);
  };

  const getTotalValue = (status: LeadStatus) => {
    return leads
      .filter((lead) => lead.status === status)
      .reduce((sum, lead) => sum + lead.estimated_value, 0);
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    if (draggedLead && draggedLead.status !== newStatus) {
      onStatusChange(draggedLead.id, newStatus);
    }
    setDraggedLead(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverColumn(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
      {PIPELINE_COLUMNS.map((status) => {
        const statusConfig = LEAD_STATUS_CONFIG[status];
        const columnLeads = getLeadsByStatus(status);
        const totalValue = getTotalValue(status);
        const isDropTarget = dragOverColumn === status;

        return (
          <div
            key={status}
            className="flex-shrink-0 w-[280px]"
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column Header */}
            <div
              className={cn(
                "rounded-t-lg px-2 py-2 border-b-2",
                statusConfig.bgColor
              )}
              style={{
                borderBottomColor:
                  status === "won"
                    ? "#22c55e"
                    : status === "lost"
                    ? "#ef4444"
                    : status === "new"
                    ? "#6b7280"
                    : status === "contacted"
                    ? "#3b82f6"
                    : status === "qualified"
                    ? "#a855f7"
                    : status === "proposal"
                    ? "#eab308"
                    : "#f97316",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium text-sm", statusConfig.color)}>
                    {statusConfig.label}
                  </span>
                  <span className="text-xs bg-background px-1.5 py-0.5 rounded-full font-mono">
                    {columnLeads.length}
                  </span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {formatCurrency(totalValue)}
                </span>
              </div>
            </div>

            {/* Column Content */}
            <div
              className={cn(
                "min-h-[500px] bg-muted/30 rounded-b-lg p-2 space-y-2 transition-colors",
                isDropTarget && "bg-primary/10 ring-2 ring-primary ring-inset"
              )}
            >
              {columnLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                  onDragEnd={handleDragEnd}
                >
                  <LeadCard
                    lead={lead}
                    onClick={() => onLeadClick(lead)}
                    isDragging={draggedLead?.id === lead.id}
                  />
                </div>
              ))}

              {columnLeads.length === 0 && (
                <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                  No leads
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
