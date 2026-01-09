"use client";

/**
 * DistributionsTab - Shows trust distributions
 *
 * Extracted from corporate page for unified tab system.
 * Placeholder for tracking income and capital distributions.
 */

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface DistributionsTabProps {
  entityId?: string;
  companyId?: string;
  onAddDistribution?: () => void;
}

export function DistributionsTab({ onAddDistribution }: DistributionsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Distributions</h3>
        <Button variant="outline" size="sm" onClick={onAddDistribution}>
          <Plus className="h-4 w-4 mr-1" />
          Record Distribution
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Track income and capital distributions to beneficiaries.
      </p>
      <div className="text-center text-muted-foreground py-8 border rounded-lg">
        No distributions recorded yet.
        <div className="text-sm mt-2">
          Distributions will appear here once recorded.
        </div>
      </div>
    </div>
  );
}

export default DistributionsTab;
