"use client";

/**
 * TrustDeedTab - Shows trust deed information
 *
 * Extracted from corporate page for unified tab system.
 * Placeholder - directs users to TRUST document category.
 */

import { Button } from "@/components/ui/button";

interface TrustDeedTabProps {
  entityId?: string;
  companyId?: string;
  onNavigate?: (tab: string) => void;
}

export function TrustDeedTab({ onNavigate }: TrustDeedTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Trust Deed</h3>
      <p className="text-sm text-muted-foreground">
        View the trust deed document and any deed variations.
      </p>
      <div className="text-center text-muted-foreground py-8 border rounded-lg">
        Trust deed documents are shown in the TRUST document category tab.
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate?.("trust")}
          >
            Go to TRUST Documents
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TrustDeedTab;
