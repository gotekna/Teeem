/**
 * SchemaModals Component
 *
 * Contains modals for table schema operations:
 * - Create Column: Add new column with type selection
 * - Delete Column: Remove existing column
 * - View Schema: Display all columns and their types
 *
 * Extracted from TeeemTableView to improve code organization.
 *
 * @see Phase 7 refactoring - Modal Consolidation
 */

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Spinner } from "@/components/ui/spinner";
import { PlusCircle, MinusCircle, Check } from "lucide-react";
import { cn } from '@/lib/utils';
import type { TableColumn } from '../types';

interface ColumnType {
  value: string;
  label: string;
  sqlType: string;
  description: string;
  example: string;
  usedFor?: string;
}

export interface SchemaModalsProps {
  /** All table columns */
  COLUMNS: TableColumn[];

  /** Table name */
  tableName: string;

  /** COLUMN_TYPES array from constants */
  COLUMN_TYPES: ColumnType[];

  /** Whether schema operations are loading */
  schemaLoading: boolean;

  // Create Column Modal
  showCreateColumnModal: boolean;
  setShowCreateColumnModal: (show: boolean) => void;
  newColumnName: string;
  setNewColumnName: (name: string) => void;
  newColumnType: string;
  setNewColumnType: (type: string) => void;
  handleCreateColumn: () => Promise<void>;

  // Delete Column Modal
  showDeleteColumnModal: boolean;
  setShowDeleteColumnModal: (show: boolean) => void;
  selectedColumnToDelete: string;
  setSelectedColumnToDelete: (key: string) => void;
  handleDeleteColumn: () => Promise<void>;

  // View Schema Modal
  showViewSchemaModal: boolean;
  setShowViewSchemaModal: (show: boolean) => void;

  // Helper functions
  getColumnTypeEmoji: (type: string) => string;
  getColumnTypeLabel: (type: string) => string;
  getColumnTypeSqlType: (type: string) => string;
}

/**
 * Schema management modals
 */
export function SchemaModals({
  COLUMNS,
  tableName,
  COLUMN_TYPES,
  schemaLoading,
  showCreateColumnModal,
  setShowCreateColumnModal,
  newColumnName,
  setNewColumnName,
  newColumnType,
  setNewColumnType,
  handleCreateColumn,
  showDeleteColumnModal,
  setShowDeleteColumnModal,
  selectedColumnToDelete,
  setSelectedColumnToDelete,
  handleDeleteColumn,
  showViewSchemaModal,
  setShowViewSchemaModal,
  getColumnTypeEmoji,
  getColumnTypeLabel,
  getColumnTypeSqlType,
}: SchemaModalsProps) {
  return (
    <>
      {/* Create Column Modal - Table-based type selection */}
      <Dialog open={showCreateColumnModal} onOpenChange={setShowCreateColumnModal}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Create New Column</DialogTitle>
            <DialogDescription>
              Add a new column to this table. Select a column type from the list below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Column Name</Label>
              <Input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="e.g., Status, Due Date, Priority..."
              />
            </div>

            <div className="space-y-2">
              <Label>Column Type</Label>
              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="w-48">Type</TableHead>
                      <TableHead className="w-32">SQL Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-48">Example</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COLUMN_TYPES.map((colType) => {
                      const isSelected = newColumnType === colType.value;
                      return (
                        <TableRow
                          key={colType.value}
                          className={cn(
                            "cursor-pointer hover:bg-muted/50",
                            isSelected && "bg-primary/10 border-l-2 border-l-primary"
                          )}
                          onClick={() => setNewColumnType(colType.value)}
                        >
                          <TableCell>
                            <div className="flex items-center justify-center">
                              {isSelected ? (
                                <Check className="h-4 w-4 text-primary" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{getColumnTypeEmoji(colType.value)}</span>
                              <span className="font-medium">{colType.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {colType.sqlType}
                            </code>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {colType.description}
                            </span>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs text-muted-foreground">
                              {colType.example.length > 30
                                ? colType.example.substring(0, 30) + "..."
                                : colType.example}
                            </code>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              {newColumnType && (
                <div className="p-3 bg-muted/50 rounded-md border">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{getColumnTypeEmoji(newColumnType)}</span>
                    <span className="font-medium">{getColumnTypeLabel(newColumnType)}</span>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {getColumnTypeSqlType(newColumnType)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {COLUMN_TYPES.find(t => t.value === newColumnType)?.usedFor || ""}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateColumnModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateColumn} disabled={schemaLoading || !newColumnName || !newColumnType}>
              {schemaLoading ? (
                <Spinner size={16} className="mr-1" />
              ) : (
                <PlusCircle className="h-4 w-4 mr-1" />
              )}
              Create Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Column Modal */}
      <Dialog open={showDeleteColumnModal} onOpenChange={setShowDeleteColumnModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Column</DialogTitle>
            <DialogDescription>
              Select a column to delete. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Column</Label>
              <Select value={selectedColumnToDelete} onValueChange={setSelectedColumnToDelete}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column to delete" />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.filter(
                    (c) =>
                      c.key !== "select" &&
                      c.key !== "actions" &&
                      c.key !== "id" &&
                      c.key !== "created_at" &&
                      c.key !== "updated_at"
                  ).map((col) => (
                    <SelectItem key={col.key} value={col.key}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedColumnToDelete && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">
                  Warning: Deleting this column will remove all data stored in it. This cannot be undone.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteColumnModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteColumn}
              disabled={!selectedColumnToDelete || schemaLoading}
            >
              {schemaLoading ? (
                <Spinner size={16} className="mr-1" />
              ) : (
                <MinusCircle className="h-4 w-4 mr-1" />
              )}
              Delete Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Schema Modal */}
      <Dialog open={showViewSchemaModal} onOpenChange={setShowViewSchemaModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Table Schema</DialogTitle>
            <DialogDescription>
              {tableName} - {COLUMNS.filter(c => c.key !== "select" && c.key !== "actions").length} columns
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {COLUMNS.filter(c => c.key !== "select" && c.key !== "actions").map((col, index) => (
                <div
                  key={col.key}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
                    <div>
                      <p className="font-medium">{col.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{col.key}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {col.column_type || "text"}
                    </Badge>
                    {col.key === "id" || col.key === "created_at" || col.key === "updated_at" ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        System
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewSchemaModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
