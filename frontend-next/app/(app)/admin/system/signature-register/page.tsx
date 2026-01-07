"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileSignature,
  FileText,
  User,
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";

interface SignatureUsage {
  id: number;
  signed_at: string;
  signed_at_formatted: string;
  certificate_type: string;
  certificate_type_display: string;
  document_name: string;
  purpose: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
  job?: {
    id: number;
    job_code: string;
    name: string;
    address: string;
  };
  document_type?: {
    id: number;
    name: string;
    display_name: string;
  };
}

interface CertificateType {
  value: string;
  label: string;
  count: number;
}

export default function SignatureRegisterPage() {
  const [loading, setLoading] = React.useState(true);
  const [signatureUsages, setSignatureUsages] = React.useState<SignatureUsage[]>([]);
  const [certificateTypes, setCertificateTypes] = React.useState<CertificateType[]>([]);
  const [pagination, setPagination] = React.useState({
    current_page: 1,
    per_page: 20,
    total_count: 0,
    total_pages: 0,
  });
  const [summary, setSummary] = React.useState<{
    total_signatures: number;
    unique_signers: number;
    by_certificate_type: Record<string, number>;
  } | null>(null);

  // Filters
  const [filterCertificateType, setFilterCertificateType] = React.useState<string>("");
  const [filterUserId, setFilterUserId] = React.useState<string>("");
  const [filterSearch, setFilterSearch] = React.useState<string>("");

  // Fetch certificate types for filter dropdown
  const fetchCertificateTypes = async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: CertificateType[];
      }>("/api/v1/signature_usages/certificate_types");

      if (response?.success) {
        setCertificateTypes(response.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch certificate types:", error);
    }
  };

  // Fetch signature usages
  const fetchSignatureUsages = async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("per_page", "20");

      if (filterCertificateType) {
        params.append("certificate_type", filterCertificateType);
      }
      if (filterUserId) {
        params.append("user_id", filterUserId);
      }

      const response = await api.get<{
        success: boolean;
        data: SignatureUsage[];
        pagination: typeof pagination;
        summary: typeof summary;
      }>(`/api/v1/signature_usages?${params.toString()}`);

      if (response?.success) {
        setSignatureUsages(response.data || []);
        setPagination(response.pagination);
        setSummary(response.summary);
      }
    } catch (error) {
      console.error("Failed to fetch signature usages:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  React.useEffect(() => {
    fetchCertificateTypes();
    fetchSignatureUsages();
  }, []);

  // Refetch when filters change
  React.useEffect(() => {
    fetchSignatureUsages(1);
  }, [filterCertificateType, filterUserId]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      fetchSignatureUsages(newPage);
    }
  };

  // Filter usages by search term (client-side)
  const filteredUsages = React.useMemo(() => {
    if (!filterSearch) return signatureUsages;
    const search = filterSearch.toLowerCase();
    return signatureUsages.filter(
      (usage) =>
        usage.document_name.toLowerCase().includes(search) ||
        usage.user?.name.toLowerCase().includes(search) ||
        usage.job?.job_code.toLowerCase().includes(search) ||
        usage.job?.name.toLowerCase().includes(search)
    );
  }, [signatureUsages, filterSearch]);

  return (
    <div className="space-y-6">

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <FileSignature className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.total_signatures}</p>
                  <p className="text-sm text-muted-foreground">Total Signatures</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <User className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.unique_signers}</p>
                  <p className="text-sm text-muted-foreground">Unique Signers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-full">
                  <FileText className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {Object.keys(summary.by_certificate_type).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Certificate Types</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Search by name, job, document..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-48">
              <Label className="text-xs text-muted-foreground">Certificate Type</Label>
              <Select
                value={filterCertificateType || "all"}
                onValueChange={(value) => setFilterCertificateType(value === "all" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {certificateTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label} ({type.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterCertificateType("");
                setFilterUserId("");
                setFilterSearch("");
              }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Signature Usages List */}
      <Card>
        <CardHeader>
          <CardTitle>Signature History</CardTitle>
          <CardDescription>
            Showing {filteredUsages.length} of {pagination.total_count} records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size={32} />
            </div>
          ) : filteredUsages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No signature usages found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsages.map((usage) => (
                <div
                  key={usage.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="p-2 bg-primary/10 rounded-full shrink-0">
                    <FileSignature className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium truncate">{usage.document_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {usage.certificate_type_display}
                        </p>
                      </div>
                      <div className="text-right text-sm shrink-0">
                        <p className="text-muted-foreground">{usage.signed_at_formatted}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      {usage.user && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>{usage.user.name}</span>
                        </div>
                      )}
                      {usage.job && (
                        <a
                          href={`/jobs/${usage.job.id}`}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Building2 className="h-4 w-4" />
                          <span>{usage.job.job_code}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {usage.purpose && (
                      <p className="text-xs text-muted-foreground mt-1">{usage.purpose}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {pagination.current_page} of {pagination.total_pages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page === pagination.total_pages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
