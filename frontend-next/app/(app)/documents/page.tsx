"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationById } from "@/hooks/useFoundationById";
import {
  Upload,
  FolderOpen,
  Cloud,
  CheckCircle,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { AIVerificationModal } from "@/components/documents/ai-verification-modal";
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal";

// Foundation ID for Documents table
const DOCUMENTS_FOUNDATION_ID = 434;

interface Document {
  id: number;
  name: string;
  display_title?: string;
  type: string;
  size: number;
  url?: string;
  job_title?: string;
  job_id?: number;
  uploaded_at: string;
  uploaded_by: string;
  folder_path?: string;
  document_type?: {
    id: number;
    name: string;
    abbreviation: string;
  };
  fiscal_year?: string;
  company_name?: string;
  verified: boolean;
  verified_at?: string;
  verified_by?: string;
}

interface Folder {
  id: string;
  name: string;
  path: string;
  documents_count: number;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([
    { id: "1", name: "Contracts", path: "/contracts", documents_count: 12 },
    { id: "2", name: "Financial", path: "/financial", documents_count: 8 },
    { id: "3", name: "Compliance", path: "/compliance", documents_count: 5 },
  ]);
  const [oneDriveConnected, setOneDriveConnected] = useState(false);

  // Modal states
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);

  // Use foundation hook for TeeemTableView
  const { foundation, columns, records, isLoading, refresh } = useFoundationById(DOCUMENTS_FOUNDATION_ID);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/${DOCUMENTS_FOUNDATION_ID}/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update document:", error);
      throw error;
    }
  }, [refresh]);

  const handleVerificationComplete = async (data: {
    display_title: string;
    document_type_id: number;
    fiscal_year?: string;
    verified: boolean;
  }) => {
    if (!selectedDocument) return;

    try {
      await api.patch(`/api/v1/documents/${selectedDocument.id}`, {
        display_title: data.display_title,
        document_type_id: data.document_type_id,
        fiscal_year: data.fiscal_year,
        verified: data.verified,
      });
      refresh();
    } catch (error) {
      console.error("Failed to update document:", error);
    }
  };

  const handlePreview = (doc: Document) => {
    setSelectedDocument(doc);
    setPreviewModalOpen(true);
  };

  const handleVerify = (doc: Document) => {
    setSelectedDocument(doc);
    setVerificationModalOpen(true);
  };

  // Stats from records
  const stats = useMemo(() => ({
    total: records.length,
    verified: records.filter((d) => d.verified).length,
    pending: records.filter((d) => !d.verified).length,
  }), [records]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader />
      </div>
    );
  }

  // Left actions - Upload button
  const leftActions = (
    <Button>
      <Upload className="h-4 w-4 mr-2" />
      Upload
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage project documents and files
            <span className="ml-2 text-xs font-mono">Table #434</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!oneDriveConnected && (
            <Button
              variant="outline"
              onClick={() => router.push("/settings/integrations/microsoft")}
            >
              <Cloud className="h-4 w-4 mr-2" />
              Connect OneDrive
            </Button>
          )}
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* OneDrive Status */}
      {oneDriveConnected && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <p className="font-medium text-blue-900">OneDrive Connected</p>
                <p className="text-sm text-blue-700">
                  Documents are synced with your Microsoft OneDrive
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/settings/integrations/microsoft")}
              >
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-blue-600" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
            <p className="text-sm text-muted-foreground">Total Documents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{stats.verified}</span>
            </div>
            <p className="text-sm text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="text-2xl font-bold text-orange-600">{stats.pending}</span>
            </div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-purple-600" />
              <span className="text-2xl font-bold">{folders.length}</span>
            </div>
            <p className="text-sm text-muted-foreground">Folders</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folders Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Folders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {folders.length > 0 ? (
              folders.map((folder) => (
                <Button
                  key={folder.id}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <FolderOpen className="h-4 w-4 mr-2 text-blue-500" />
                  <span className="flex-1 text-left truncate">{folder.name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {folder.documents_count}
                  </Badge>
                </Button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No folders yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Documents Table */}
        <div className="lg:col-span-3">
          <TeeemTableView
            entries={records}
            columns={columns}
            foundationId={String(DOCUMENTS_FOUNDATION_ID)}
            foundationIdNumeric={DOCUMENTS_FOUNDATION_ID}
            tableName={foundation?.name || "Documents"}
            enableExport={true}
            onRefresh={refresh}
            onRowUpdate={handleRowUpdate}
            leftActions={leftActions}
          />
        </div>
      </div>

      {/* Modals */}
      <AIVerificationModal
        open={verificationModalOpen}
        onOpenChange={setVerificationModalOpen}
        document={selectedDocument}
        onVerificationComplete={handleVerificationComplete}
      />

      <DocumentPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        document={selectedDocument}
        onVerify={() => {
          setPreviewModalOpen(false);
          setVerificationModalOpen(true);
        }}
        onDownload={() => {
          // TODO: Implement download
        }}
        onOpenExternal={() => {
          // TODO: Open in OneDrive
        }}
      />
    </div>
  );
}
