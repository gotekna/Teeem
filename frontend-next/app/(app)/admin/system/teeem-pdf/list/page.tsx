"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FileText, Plus, Trash2, Clock, MoreVertical, Files } from "lucide-react";
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

interface PdfSummary {
  id: number;
  name: string;
  description?: string;
  isTemplate: boolean;
  jobId?: number;
  jobName?: string;
  pageCount: number;
  updatedAt: string;
  createdAt: string;
}

export default function PdfListPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [pdfs, setPdfs] = React.useState<PdfSummary[]>([]);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Load PDFs
  React.useEffect(() => {
    const loadPdfs = async () => {
      setLoading(true);
      try {
        const response = await api.get<{ success: boolean; data: PdfSummary[] }>(
          "/api/v1/teeem_pdfs"
        );
        if (response?.success && response.data) {
          setPdfs(response.data);
        }
      } catch (error) {
        console.error("Failed to load PDFs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPdfs();
  }, []);

  // Create new PDF
  const handleCreate = () => {
    router.push("/admin/system/teeem-pdf");
  };

  // Open PDF
  const handleOpen = (id: number) => {
    router.push(`/admin/system/teeem-pdf?id=${id}`);
  };

  // Delete PDF
  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      await api.delete(`/api/v1/teeem_pdfs/${deleteId}`);
      setPdfs((prev) => prev.filter((p) => p.id !== deleteId));
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
          <div className="h-12 w-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">TeeemPDF</h1>
            <p className="text-muted-foreground">
              Your saved PDF documents
            </p>
          </div>
        </div>

        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New PDF
        </Button>
      </div>

      {/* PDF list */}
      {pdfs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No PDFs yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first PDF document to get started
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create PDF
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pdfs.map((pdf) => (
            <Card
              key={pdf.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleOpen(pdf.id)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-10 w-10 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{pdf.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Files className="h-3 w-3" />
                      {pdf.pageCount} page{pdf.pageCount !== 1 ? "s" : ""}
                    </span>
                    {pdf.jobName && (
                      <span className="truncate max-w-32">{pdf.jobName}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(pdf.updatedAt), { addSuffix: true })}
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
                      handleOpen(pdf.id);
                    }}>
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(pdf.id);
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
            <AlertDialogTitle>Delete PDF?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the PDF document.
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
