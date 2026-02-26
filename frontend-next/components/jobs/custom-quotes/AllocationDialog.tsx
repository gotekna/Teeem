"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomQuoteLineNode, AllocationData } from "./types";

interface AllocationDialogProps {
  open: boolean;
  onClose: () => void;
  supplierName: string;
  quotedAmount: number;
  poLines: CustomQuoteLineNode[];
  existingAllocations: AllocationData[];
  onSave: (allocations: Array<{ lineId: number; amount: number }>) => void;
}

export function AllocationDialog({
  open,
  onClose,
  supplierName,
  quotedAmount,
  poLines,
  existingAllocations,
  onSave,
}: AllocationDialogProps) {
  const [amounts, setAmounts] = useState<Record<number, string>>({});

  // Initialize from existing allocations
  useEffect(() => {
    const initial: Record<number, string> = {};
    poLines.forEach((line) => {
      const existing = existingAllocations.find((a) => a.lineId === line.id);
      initial[line.id] = existing ? String(existing.allocatedAmount) : "";
    });
    setAmounts(initial);
  }, [poLines, existingAllocations]);

  const totalAllocated = Object.values(amounts).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0
  );
  const remaining = quotedAmount - totalAllocated;

  const handleSave = () => {
    const allocations = Object.entries(amounts)
      .filter(([_, val]) => parseFloat(val) > 0)
      .map(([lineId, val]) => ({
        lineId: Number(lineId),
        amount: parseFloat(val),
      }));
    onSave(allocations);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Allocate Quote to PO Lines</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Supplier: <strong>{supplierName}</strong></span>
            <span>Quoted: <strong>${quotedAmount.toLocaleString()}</strong></span>
          </div>

          <div className="space-y-3">
            {poLines.map((line) => (
              <div key={line.id} className="flex items-center gap-3">
                <Label className="text-sm flex-1 truncate">{line.name}</Label>
                <div className="relative w-32">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={amounts[line.id] || ""}
                    onChange={(e) =>
                      setAmounts((prev) => ({ ...prev, [line.id]: e.target.value }))
                    }
                    className="pl-6 text-sm"
                    placeholder="0"
                    step="0.01"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2 border-t text-sm">
            <span>Total Allocated:</span>
            <span className="font-medium">${totalAllocated.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Remaining:</span>
            <span className={`font-medium ${remaining < 0 ? "text-red-600" : remaining > 0 ? "text-amber-600" : "text-green-600"}`}>
              ${Math.abs(remaining).toLocaleString()} {remaining < 0 ? "over" : remaining > 0 ? "unallocated" : ""}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={totalAllocated <= 0 || remaining < 0}>
            Save Allocations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
