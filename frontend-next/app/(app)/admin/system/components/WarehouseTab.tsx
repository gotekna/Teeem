"use client";

import * as React from "react";
import { DocumentTypesTab } from "./DocumentTypesTab";

// Folders & Tabs removed - now use Entity Configuration > Corporate > Documents (SSoT)

export function WarehouseTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Data Warehouse Configuration</h2>
      </div>

      {/* Document Types is the only config here now */}
      {/* Folders/Tabs moved to Entity Configuration > Corporate > Documents */}
      <DocumentTypesTab />
    </div>
  );
}
