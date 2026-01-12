"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FileSpreadsheet, Plus, Trash2, Clock, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface SpreadsheetSummary {
  id: number;
  name: string;
  isTemplate: boolean;
  sheetCount: number;
  updatedAt: string;
  createdAt: string;
}

export default function SpreadsheetListPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [spreadsheets, setSpreadsheets] = React.useState<SpreadsheetSummary[]>([]);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Load spreadsheets
  React.useEffect(() => {
    const loadSpreadsheets = async () => {
      setLoading(true);
      try {
        const response = await api.get<{ success: boolean; data: SpreadsheetSummary[] }>(
          "/api/v1/teeem_spreadsheets"
        );
        if (response?.success && response.data) {
          setSpreadsheets(response.data);
        }
      } catch (error) {
        console.error("Failed to load spreadsheets:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSpreadsheets();
  }, []);

  // Create new spreadsheet
  const handleCreate = () => {
    router.push("/admin/system/teeem-xl");
  };

  // Open spreadsheet
  const handleOpen = (id: number) => {
    router.push(`/admin/system/teeem-xl?id=${id}`);
  };

  // Delete spreadsheet
  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      await api.delete(`/api/v1/teeem_spreadsheets/${deleteId}`);
      setSpreadsheets((prev) => prev.filter((s) => s.id !== deleteId));
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <FileSpreadsheet className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">TeeemXL Spreadsheets</h1>
            <p className="text-muted-foreground">
              Your saved spreadsheets
            </p>
          </div>
        </div>

        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Spreadsheet
        </Button>
      </div>

      {/* Spreadsheet list */}
      {spreadsheets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No spreadsheets yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first spreadsheet to get started
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Spreadsheet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {spreadsheets.map((spreadsheet) => (
            <Card
              key={spreadsheet.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleOpen(spreadsheet.id)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-10 w-10 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{spreadsheet.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{spreadsheet.sheetCount} sheet{spreadsheet.sheetCount !== 1 ? "s" : ""}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(spreadsheet.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleOpen(spreadsheet.id);
                    }}>
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(spreadsheet.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Spreadsheet?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the spreadsheet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? <Spinner size={16} className="mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
