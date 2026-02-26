"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/formatters";

interface DiffSection {
  section_name: string;
  items_v1: DiffItem[];
  items_v2: DiffItem[];
}

interface DiffItem {
  id: number;
  line_number: number;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  item_type: string;
  source_po_number: string | null;
}

interface TenderDiffViewProps {
  versionA: number;
  versionB: number;
  sections: DiffSection[];
}

export function TenderDiffView({ versionA, versionB, sections }: TenderDiffViewProps) {
  if (sections.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No differences found between versions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">v{versionA}</Badge>
        <span>compared with</span>
        <Badge variant="outline">v{versionB}</Badge>
      </div>

      {sections.map((section) => {
        const v1Total = section.items_v1
          .filter((i) => i.item_type === "priced")
          .reduce((sum, i) => sum + (i.total_amount || 0), 0);
        const v2Total = section.items_v2
          .filter((i) => i.item_type === "priced")
          .reduce((sum, i) => sum + (i.total_amount || 0), 0);
        const diff = v2Total - v1Total;

        return (
          <Card key={section.section_name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{section.section_name}</CardTitle>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    v{versionA}: {formatCurrency(v1Total)}
                  </span>
                  <span className="text-muted-foreground">
                    v{versionB}: {formatCurrency(v2Total)}
                  </span>
                  {diff !== 0 && (
                    <Badge variant={diff > 0 ? "destructive" : "default"}>
                      {diff > 0 ? "+" : ""}
                      {formatCurrency(diff)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* V1 column */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Version {versionA}
                  </p>
                  <div className="space-y-1">
                    {section.items_v1.map((item) => (
                      <DiffItemRow key={item.id} item={item} />
                    ))}
                    {section.items_v1.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No items</p>
                    )}
                  </div>
                </div>
                {/* V2 column */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Version {versionB}
                  </p>
                  <div className="space-y-1">
                    {section.items_v2.map((item) => (
                      <DiffItemRow key={item.id} item={item} />
                    ))}
                    {section.items_v2.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No items</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DiffItemRow({ item }: { item: DiffItem }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-border/30">
      <span className="truncate flex-1 mr-2">
        {item.line_number}. {item.description}
      </span>
      {item.item_type === "priced" ? (
        <span className="font-medium whitespace-nowrap">
          {formatCurrency(item.total_amount || 0)}
        </span>
      ) : (
        <span className="text-muted-foreground italic whitespace-nowrap">
          {item.item_type === "included" ? "Included" : "—"}
        </span>
      )}
    </div>
  );
}

export type { DiffSection, DiffItem };
