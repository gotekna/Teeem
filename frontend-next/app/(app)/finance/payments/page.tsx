"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  Download,
  CheckCircle,
  Clock,
  CreditCard,
  Building2,
  DollarSign,
  FileText,
  Send,
  Eye,
  Filter,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";

interface BankAccount {
  id: number;
  account_name: string;
  bsb: string;
  account_number: string;
  institution_name?: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
}

interface BillPaymentBatch {
  id: number;
  batch_reference: string;
  payment_date: string;
  status: string;
  total_amount: number;
  payment_count: number;
  processing_description: string | null;
  aba_file_name: string | null;
  created_at: string;
  bank_account: BankAccount | null;
  created_by: User | null;
  approved_by: User | null;
}

interface BatchesResponse {
  batches: BillPaymentBatch[];
  meta: {
    total_count: number;
    total_pages: number;
    current_page: number;
  };
}

interface CorporateCompany {
  id: number;
  name: string;
  code: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-foreground dark:bg-muted/50 dark:text-muted-foreground",
  pending_approval: "bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500",
  approved: "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400",
};

export default function PaymentBatchesPage() {
  const [batches, setBatches] = useState<BillPaymentBatch[]>([]);
  const [companies, setCompanies] = useState<CorporateCompany[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Create batch dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("per_page", "25");
      if (statusFilter !== "all") params.set("status", statusFilter);

      // If company filter is set, use nested route
      const url = companyFilter !== "all"
        ? `/api/v1/companies/${companyFilter}/bill_payment_batches?${params}`
        : `/api/v1/bill_payment_batches?${params}`;

      const response = await api.get<BatchesResponse>(url);
      setBatches(response.batches || []);
      setTotalPages(response.meta?.total_pages || 1);
      setTotalCount(response.meta?.total_count || 0);
    } catch (error) {
      console.error("Failed to load batches:", error);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, companyFilter]);

  const loadCompaniesAndAccounts = useCallback(async () => {
    try {
      const [companiesRes, accountsRes] = await Promise.all([
        api.get<{ companies: CorporateCompany[] } | CorporateCompany[]>("/api/v1/companies"),
        api.get<{ bank_accounts: BankAccount[] } | BankAccount[]>("/api/v1/bank_accounts?is_ap_enabled=true"),
      ]);
      setCompanies(Array.isArray(companiesRes) ? companiesRes : (companiesRes.companies || []));
      setBankAccounts(Array.isArray(accountsRes) ? accountsRes : (accountsRes.bank_accounts || []));
    } catch (error) {
      console.error("Failed to load companies/accounts:", error);
    }
  }, []);

  useEffect(() => {
    loadBatches();
    loadCompaniesAndAccounts();
  }, [loadBatches, loadCompaniesAndAccounts]);

  const handleCreateBatch = async () => {
    if (!selectedCompany || !selectedBankAccount) return;
    setCreating(true);
    try {
      await api.post(`/api/v1/companies/${selectedCompany}/bill_payment_batches`, {
        bank_account_id: selectedBankAccount,
        payment_date: paymentDate || undefined,
        description: description || undefined,
      });
      setCreateDialogOpen(false);
      setSelectedCompany("");
      setSelectedBankAccount("");
      setPaymentDate("");
      setDescription("");
      await loadBatches();
    } catch (error) {
      console.error("Failed to create batch:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadAba = async (batchId: number) => {
    try {
      const response = await fetch(`/api/v1/bill_payment_batches/${batchId}/download_aba`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const filename = response.headers.get("Content-Disposition")?.split("filename=")[1] || "payment.aba";
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.replace(/"/g, "");
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleGenerateAba = async (batchId: number) => {
    try {
      await api.post(`/api/v1/bill_payment_batches/${batchId}/generate_aba`);
      await loadBatches();
    } catch (error) {
      console.error("Generate ABA failed:", error);
    }
  };

  const handleSubmitForApproval = async (batchId: number) => {
    try {
      await api.post(`/api/v1/bill_payment_batches/${batchId}/submit_for_approval`);
      await loadBatches();
    } catch (error) {
      console.error("Submit for approval failed:", error);
    }
  };

  const handleApprove = async (batchId: number) => {
    try {
      await api.post(`/api/v1/bill_payment_batches/${batchId}/approve`);
      await loadBatches();
    } catch (error) {
      console.error("Approve failed:", error);
    }
  };

  const filteredBatches = batches.filter((batch) =>
    batch.batch_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
    batch.processing_description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
<BackButton fallbackHref="/finance" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Payment Batches</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalCount} batches - ABA file generation for bank payments
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Batch
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search batches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={companyFilter}
              onValueChange={(v) => {
                setCompanyFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.code} - {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Batches Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Spinner />
        </div>
      ) : filteredBatches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No payment batches found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create a batch to start grouping bills for payment.
            </p>
            <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Batch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Bank Account</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBatches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {batch.batch_reference}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {batch.processing_description || "-"}
                  </TableCell>
                  <TableCell>
                    {batch.bank_account ? (
                      <span className="text-sm">
                        {batch.bank_account.account_name}
                        <br />
                        <span className="text-xs text-muted-foreground font-mono">
                          {batch.bank_account.bsb} / {batch.bank_account.account_number}
                        </span>
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {batch.payment_date
                      ? new Date(batch.payment_date).toLocaleDateString("en-AU")
                      : "-"}
                  </TableCell>
                  <TableCell className="font-mono">{batch.payment_count}</TableCell>
                  <TableCell className="font-mono font-medium">
                    ${(batch.total_amount || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[batch.status] || statusColors.draft}>
                      {batch.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {batch.created_by
                      ? `${batch.created_by.first_name} ${batch.created_by.last_name}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {batch.status === "draft" && batch.payment_count > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleGenerateAba(batch.id)}
                          title="Generate ABA File"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      {batch.aba_file_name && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadAba(batch.id)}
                          title="Download ABA File"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {batch.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSubmitForApproval(batch.id)}
                          title="Submit for Approval"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {batch.status === "pending_approval" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600"
                          onClick={() => handleApprove(batch.id)}
                          title="Approve"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" asChild title="View Details">
                        <Link href={`/finance/payments/${batch.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Create Batch Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payment Batch</DialogTitle>
            <DialogDescription>
              Create a new batch to group bills for ABA bank payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.code} - {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bank Account</Label>
              <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.account_name} ({account.bsb} / {account.account_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                placeholder="e.g., Weekly supplier payments"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateBatch}
              disabled={creating || !selectedCompany || !selectedBankAccount}
            >
              {creating ? "Creating..." : "Create Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
