"use client";

import type { CustomQuoteData } from "./types";

interface CustomQuoteSummaryBarProps {
  quote: CustomQuoteData;
}

export function CustomQuoteSummaryBar({ quote }: CustomQuoteSummaryBarProps) {
  const variance = quote.variance;
  const varianceColor = variance > 0
    ? "text-amber-600 dark:text-amber-400"
    : variance < 0
      ? "text-red-600 dark:text-red-400"
      : "text-green-600 dark:text-green-400";

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-muted/30 border-b text-sm">
      <div>
        <span className="text-muted-foreground">Status:</span>{" "}
        <span className="font-medium capitalize">{quote.status.replace("_", " ")}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Total Quoted:</span>{" "}
        <span className="font-medium">${(quote.totalQuoted || 0).toLocaleString()}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Allocated:</span>{" "}
        <span className="font-medium">${(quote.totalAllocated || 0).toLocaleString()}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Variance:</span>{" "}
        <span className={`font-medium ${varianceColor}`}>
          ${Math.abs(variance).toLocaleString()}
          {variance > 0 ? " over" : variance < 0 ? " under" : ""}
        </span>
      </div>
      {quote.templateName && (
        <div className="ml-auto">
          <span className="text-muted-foreground">Template:</span>{" "}
          <span className="font-medium">{quote.templateName}</span>
        </div>
      )}
    </div>
  );
}
