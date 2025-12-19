"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, GripVertical, Check, User } from "lucide-react";
import type { Signer, SignerPanelProps, SignatureField } from "./types";
import { SIGNER_COLORS } from "./types";
import { cn } from "@/lib/utils";

interface ExtendedSignerPanelProps extends SignerPanelProps {
  fields?: SignatureField[];
}

export function SignerPanel({
  signers,
  selectedSigner,
  onAddSigner,
  onRemoveSigner,
  onSelectSigner,
  onReorderSigners,
  fields = [],
}: ExtendedSignerPanelProps) {
  const [newSignerEmail, setNewSignerEmail] = React.useState("");
  const [newSignerName, setNewSignerName] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);

  const handleAddSigner = () => {
    if (!newSignerEmail.trim()) return;

    onAddSigner(newSignerEmail.trim(), newSignerName.trim() || undefined);
    setNewSignerEmail("");
    setNewSignerName("");
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSigner();
    } else if (e.key === "Escape") {
      setIsAdding(false);
      setNewSignerEmail("");
      setNewSignerName("");
    }
  };

  // Count fields per signer
  const fieldCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const field of fields) {
      counts[field.signerId] = (counts[field.signerId] || 0) + 1;
    }
    return counts;
  }, [fields]);

  return (
    <Card className="w-64 shrink-0 flex flex-col h-full border-l rounded-none">
      <CardHeader className="py-3 px-3 border-b shrink-0">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Signers</span>
          <Badge variant="secondary" className="text-xs">
            {signers.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-2 space-y-1">
        {signers.length === 0 && !isAdding && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No signers yet</p>
            <p className="text-xs mt-1">Add signers to place signature fields</p>
          </div>
        )}

        {signers.map((signer, index) => {
          const isSelected = selectedSigner?.id === signer.id;
          const fieldCount = fieldCounts[signer.id] || 0;

          return (
            <div
              key={signer.id}
              className={cn(
                "group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors border-2",
                isSelected
                  ? "ring-2 ring-offset-1"
                  : "hover:bg-muted/50 border-transparent"
              )}
              style={{
                backgroundColor: isSelected ? `${signer.color}15` : undefined,
                borderColor: isSelected ? signer.color : undefined,
                // @ts-expect-error - CSS custom property for ring color
                "--tw-ring-color": isSelected ? signer.color : undefined,
              }}
              onClick={() => onSelectSigner(isSelected ? null : signer)}
            >
              {/* Color indicator / drag handle */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                style={{ backgroundColor: signer.color }}
              >
                {index + 1}
              </div>

              {/* Signer info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {signer.name || signer.email.split("@")[0]}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {signer.email}
                </div>
              </div>

              {/* Field count badge */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={fieldCount > 0 ? "default" : "outline"}
                      className="text-xs shrink-0"
                      style={
                        fieldCount > 0
                          ? { backgroundColor: signer.color }
                          : undefined
                      }
                    >
                      {fieldCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {fieldCount === 0
                      ? "No fields assigned"
                      : `${fieldCount} field${fieldCount !== 1 ? "s" : ""}`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSigner(signer.id);
                }}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          );
        })}

        {/* Add signer form */}
        {isAdding && (
          <div className="p-2 rounded-md border bg-muted/30 space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="signer@example.com"
                value={newSignerEmail}
                onChange={(e) => setNewSignerEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name (optional)</Label>
              <Input
                type="text"
                placeholder="John Doe"
                value={newSignerName}
                onChange={(e) => setNewSignerName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={handleAddSigner}
                disabled={!newSignerEmail.trim()}
              >
                <Check className="h-3 w-3 mr-1" />
                Add
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setIsAdding(false);
                  setNewSignerEmail("");
                  setNewSignerName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Add signer button */}
      {!isAdding && (
        <div className="p-2 border-t shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Signer
          </Button>
        </div>
      )}

      {/* Selected signer indicator */}
      {selectedSigner && (
        <div
          className="p-2 border-t text-xs text-center text-white shrink-0"
          style={{ backgroundColor: selectedSigner.color }}
        >
          Placing fields for: {selectedSigner.name || selectedSigner.email}
        </div>
      )}
    </Card>
  );
}
