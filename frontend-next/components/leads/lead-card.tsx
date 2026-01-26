"use client";

import { Lead } from "@/types/leads";
import { LeadStatusBadge } from "./lead-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, DollarSign } from "lucide-react";
import { formatCurrencyWhole } from "@/utils/formatters";

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  isDragging?: boolean;
}

export function LeadCard({ lead, onClick, isDragging }: LeadCardProps) {

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow w-full ${
        isDragging ? "opacity-50 rotate-2 shadow-lg" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm line-clamp-2">{lead.title}</h3>
        </div>

        <p className="text-xs text-muted-foreground">{lead.client_name}</p>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{lead.site_suburb}</span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
            <DollarSign className="h-3 w-3" />
            {formatCurrencyWhole(lead.estimated_value)}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            {lead.lead_number}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
