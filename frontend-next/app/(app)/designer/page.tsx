"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusIcon, EllipsisVerticalIcon, FolderIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

// Types
interface Table {
  id: number;
  name: string;
  slug: string;
  description?: string;
  record_count: number;
  columns?: unknown[];
}

export default function DesignerHome() {
  const { toast } = useToast();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    foundationId: number | null;
    tableName: string;
  }>({ isOpen: false, foundationId: null, tableName: "" });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ foundations?: Table[]; tables?: Table[] }>(
        "/api/v1/foundations"
      );
      setTables(response.foundations || response.tables || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async () => {
    if (!newTableName.trim()) return;

    setCreating(true);
    try {
      await api.post("/api/v1/foundations", {
        foundation: {
          name: newTableName,
          searchable: true,
        },
      });
      setShowCreateModal(false);
      setNewTableName("");
      fetchTables();
      toast({ title: "Table created successfully" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const openDeleteModal = (foundationId: number, tableName: string) => {
    setDeleteModal({ isOpen: true, foundationId, tableName });
  };

  const closeDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModal({ isOpen: false, foundationId: null, tableName: "" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal.foundationId) return;

    setIsDeleting(true);
    try {
      await api.delete(`/api/v1/foundations/${deleteModal.foundationId}`);
      setDeleteModal({ isOpen: false, foundationId: null, tableName: "" });
      fetchTables();
      toast({ title: "Table deleted successfully" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-6 max-w-lg rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/10">
          <div className="text-sm text-yellow-800 dark:text-yellow-400">
            <p className="font-medium">Could not connect to backend</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        </div>
        <div className="mb-6 text-muted-foreground">
          <p>You can still create a table - it will be saved once the connection is restored.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="mr-2 h-5 w-5" />
          Create Table Anyway
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Designer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your table structures and columns
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="mr-2 h-5 w-5" />
          Create Table
        </Button>
      </div>

      {/* Tables List */}
      {tables.length === 0 ? (
        <div className="py-12 text-center">
          <FolderIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold">No tables</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by creating a new table.
          </p>
          <div className="mt-6">
            <Button onClick={() => setShowCreateModal(true)}>
              <PlusIcon className="mr-2 h-5 w-5" />
              Create Your First Table
            </Button>
          </div>
        </div>
      ) : (
        <ul role="list" className="divide-y">
          {tables.map((table) => (
            <li key={table.id} className="flex items-center justify-between gap-x-6 py-5">
              <div className="min-w-0">
                <div className="flex items-start gap-x-3">
                  <p className="text-sm font-semibold">{table.name}</p>
                  {table.record_count > 0 ? (
                    <Badge
                      variant="outline"
                      className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 dark:bg-green-900/10 dark:text-green-400"
                    >
                      {table.record_count} records
                    </Badge>
                  ) : (
                    <Badge variant="outline">Empty</Badge>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-x-2 text-xs text-muted-foreground">
                  <p className="whitespace-nowrap">{table.columns?.length || 0} columns</p>
                  {table.description && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <p className="truncate">{table.description}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-none items-center gap-x-4">
                <Link href={`/tables/${table.id}/${table.slug}`}>
                  <Button variant="outline" size="sm" className="hidden sm:flex">
                    View table
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <EllipsisVerticalIcon className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/designer/tables/${table.id}`}>Edit</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/tables/${table.id}/${table.slug}`}>View Data</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => openDeleteModal(table.id, table.name)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create Table Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Table</DialogTitle>
            <DialogDescription>Enter a name for your new table.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Table Name</Label>
              <Input
                id="name"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="e.g., Customers, Products"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTable} disabled={creating || !newTableName.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Table Modal */}
      <Dialog open={deleteModal.isOpen} onOpenChange={closeDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Table</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteModal.tableName}</strong>? This action
              cannot be undone and all data in this table will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteModal} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
