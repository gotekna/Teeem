/**
 * SaveViewModal Component
 *
 * Modal for saving current table filters and settings as a named view.
 * Supports both personal and global (all users) views.
 * Extracted from TeeemTableView to improve code organization.
 *
 * @see Phase 7 refactoring - Modal Consolidation
 */

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Spinner } from "@/components/ui/spinner";
import { User, Globe, Save } from "lucide-react";

export interface SaveViewModalProps {
  /** Whether modal is open */
  open: boolean;

  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;

  /** New view name */
  newViewName: string;

  /** Set new view name */
  setNewViewName: (name: string) => void;

  /** Whether to save as global view (all users) */
  saveAsGlobal: boolean;

  /** Set save as global */
  setSaveAsGlobal: (global: boolean) => void;

  /** Whether view is being saved */
  savingView: boolean;

  /** Save view handler */
  saveNewView: () => Promise<void>;
}

/**
 * Modal for saving table view configuration
 */
export function SaveViewModal({
  open,
  onOpenChange,
  newViewName,
  setNewViewName,
  saveAsGlobal,
  setSaveAsGlobal,
  savingView,
  saveNewView,
}: SaveViewModalProps) {
  const handleClose = () => {
    onOpenChange(false);
    setSaveAsGlobal(false);
    setNewViewName("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setSaveAsGlobal(false);
        setNewViewName("");
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save View</DialogTitle>
          <DialogDescription>
            Save the current filters and settings as a named view
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>View name</Label>
            <Input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g., Active Jobs, Pending Orders..."
            />
          </div>

          {/* Global vs Personal toggle */}
          <div className="space-y-2">
            <Label>View type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!saveAsGlobal ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setSaveAsGlobal(false)}
              >
                <User className="h-4 w-4 mr-2" />
                Personal
              </Button>
              <Button
                type="button"
                variant={saveAsGlobal ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setSaveAsGlobal(true)}
              >
                <Globe className="h-4 w-4 mr-2" />
                Global (All Users)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {saveAsGlobal
                ? "Global views are visible to all users and appear first in the view list."
                : "Personal views are only visible to you."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            onClick={saveNewView}
            disabled={!newViewName.trim() || savingView}
          >
            {savingView ? (
              <Spinner size={16} className="mr-1" />
            ) : saveAsGlobal ? (
              <Globe className="h-4 w-4 mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {saveAsGlobal ? "Save Global View" : "Save View"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
