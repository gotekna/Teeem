"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import {
  Download,
  FileText,
  Search,
  FolderOpen,
  FileSignature,
  Shield,
  ClipboardCheck,
  Wrench,
  Heart,
  Award,
  DollarSign,
  Camera,
  File,
} from "lucide-react";

interface DocumentCategory {
  name: string;
  document_types: {
    id: number;
    name: string;
    abbreviation: string;
    description: string;
  }[];
}

interface PortalDocument {
  id: string;
  name: string;
  category: string;
  document_type: string | null;
  uploaded_at: string;
  file_size: number | null;
  content_type: string | null;
  download_url: string | null;
  property: { id: number; name: string; address: string } | null;
}

function portalFetch(path: string) {
  const baseUrl = getApiBaseUrl();
  const token = getStorageItem<string>(STORAGE_KEYS.PORTAL_TOKEN, "");
  return fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  }).then((r) => r.json());
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const categoryIcons: Record<string, React.ElementType> = {
  "Contracts & Leases": FileSignature,
  Insurance: Shield,
  Inspections: ClipboardCheck,
  Maintenance: Wrench,
  "SDA Documents": Heart,
  Certificates: Award,
  Financial: DollarSign,
  Photos: Camera,
  General: FolderOpen,
};

export default function DocumentsPage() {
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    portalFetch("/api/v1/portal/property/documents")
      .then((res) => {
        if (res.success) {
          setCategories(res.data.categories || []);
          setDocuments(res.data.documents || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = (doc: PortalDocument) => {
    if (doc.download_url) {
      window.open(doc.download_url, "_blank");
    }
  };

  // Filter documents
  const filtered = documents.filter((doc) => {
    const matchesSearch =
      !search ||
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.category?.toLowerCase().includes(search.toLowerCase()) ||
      doc.document_type?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      !activeCategory || doc.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Documents</h1>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory(null)}
        >
          All ({documents.length})
        </Button>
        {categories.map((cat) => {
          const count = documents.filter(
            (d) => d.category === cat.name
          ).length;
          const Icon = categoryIcons[cat.name] || FolderOpen;
          return (
            <Button
              key={cat.name}
              variant={activeCategory === cat.name ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setActiveCategory(
                  activeCategory === cat.name ? null : cat.name
                )
              }
            >
              <Icon className="h-3 w-3 mr-1.5" />
              {cat.name} {count > 0 && `(${count})`}
            </Button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Documents List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {documents.length === 0
                  ? "No documents uploaded yet"
                  : "No documents match your search"}
              </p>
              {search && (
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => setSearch("")}
                >
                  Clear Search
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {activeCategory || "All Documents"} ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filtered.map((doc) => {
                const Icon = categoryIcons[doc.category] || File;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => handleDownload(doc)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {doc.category}
                        </Badge>
                        {doc.document_type && (
                          <span className="text-xs text-muted-foreground">
                            {doc.document_type}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(doc.uploaded_at)}
                        </span>
                        {doc.file_size && (
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(doc.file_size)}
                          </span>
                        )}
                      </div>
                      {doc.property && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {doc.property.address}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Types Reference (collapsed) */}
      {categories.length > 0 && (
        <DocumentTypesReference categories={categories} />
      )}
    </div>
  );
}

function DocumentTypesReference({
  categories,
}: {
  categories: DocumentCategory[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <button
        className="w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">
              Document Types Reference
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {expanded ? "Hide" : "Show"}
            </span>
          </div>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const Icon = categoryIcons[cat.name] || FolderOpen;
              return (
                <div key={cat.name}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm">{cat.name}</h4>
                  </div>
                  <div className="space-y-1">
                    {cat.document_types.map((dt) => (
                      <div
                        key={dt.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] px-1"
                        >
                          {dt.abbreviation}
                        </Badge>
                        <span className="text-muted-foreground">
                          {dt.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
