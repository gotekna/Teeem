"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DocumentDuplicateIcon,
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "@/components/ui/use-toast";

interface Invoice {
  id: number;
  po_number: string;
  construction_name: string;
  amount?: number;
  status: string;
  created_at?: string;
  paid_at?: string;
  can_retry?: boolean;
}

interface Summary {
  total_invoiced?: number;
  total_paid?: number;
  total_outstanding?: number;
  invoices_count?: number;
  paid_invoices_count?: number;
  outstanding_invoices_count?: number;
}

interface InvoicesData {
  pending: Invoice[];
  synced: Invoice[];
  paid: Invoice[];
  failed: Invoice[];
  all_invoices: Invoice[];
  summary: Summary;
}

type TabKey = "all" | "pending" | "synced" | "paid" | "failed";

export default function PortalInvoices() {
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  // Path-based tab navigation
  const activeTabRaw = useMemo(() => {
    const parts = pathname.replace("/portal/invoices", "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname]);

  useEffect(() => {
    if (activeTabRaw === null) {
      router.replace("/portal/invoices/all", { scroll: false });
    }
  }, [activeTabRaw, router]);

  const setActiveTab = useCallback((tab: string) => {
    router.push(`/portal/invoices/${tab}`, { scroll: false });
  }, [router]);

  const activeTab = (activeTabRaw || "all") as TabKey;

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoicesData>({
    pending: [],
    synced: [],
    paid: [],
    failed: [],
    all_invoices: [],
    summary: {},
  });

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const token = localStorage.getItem("portal_token");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      const response = await axios.get("/api/v1/portal/invoices");

      if (response?.data.success) {
        setInvoices(response.data.data);
      }
    } catch (error) {
      console.error("Failed to load invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySync = async (invoiceId: number) => {
    try {
      const token = localStorage.getItem("portal_token");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      const response = await axios.post(
        `/api/v1/portal/invoices/${invoiceId}/retry_sync`
      );

      if (response?.data.success) {
        loadInvoices();
      }
    } catch (error: any) {
      console.error("Failed to retry sync:", error);
      toast({
        title: "Error",
        description: "Failed to retry sync: " + (error.response?.data?.error || error.message),
        variant: "destructive",
      });
    }
  };

  const tabs = [
    { key: "all" as TabKey, name: "All", count: invoices.all_invoices.length },
    {
      key: "pending" as TabKey,
      name: "Pending",
      count: invoices.pending.length,
      icon: ClockIcon,
    },
    {
      key: "synced" as TabKey,
      name: "Synced",
      count: invoices.synced.length,
      icon: ArrowPathIcon,
    },
    {
      key: "paid" as TabKey,
      name: "Paid",
      count: invoices.paid.length,
      icon: CheckCircleIcon,
    },
    {
      key: "failed" as TabKey,
      name: "Failed",
      count: invoices.failed.length,
      icon: XCircleIcon,
    },
  ];

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { bg: "bg-yellow-100 dark:bg-yellow-900/50", text: "text-yellow-800 dark:text-yellow-300", label: "Pending" },
      synced: { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-800 dark:text-blue-300", label: "Synced" },
      paid: { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-800 dark:text-green-300", label: "Paid" },
      failed: { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-800 dark:text-red-300", label: "Failed" },
    };
    const badge =
      badges[status as keyof typeof badges] || badges.pending;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
      >
        {badge.label}
      </span>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const currentInvoices =
    activeTab === "all" ? invoices.all_invoices : invoices[activeTab] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-white">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
            Manage your invoices and track payments
          </p>
        </div>
        <button
          onClick={() => toast({ title: "Coming Soon", description: "Create invoice functionality coming soon" })}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-card overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DocumentDuplicateIcon className="h-6 w-6 text-muted-foreground dark:text-muted-foreground" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground dark:text-muted-foreground truncate">
                    Total Invoiced
                  </dt>
                  <dd className="text-2xl font-semibold text-foreground dark:text-white">
                    ${invoices.summary.total_invoiced?.toLocaleString() || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground dark:text-muted-foreground truncate">
                    Total Paid
                  </dt>
                  <dd className="text-2xl font-semibold text-green-600 dark:text-green-400">
                    ${invoices.summary.total_paid?.toLocaleString() || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground dark:text-muted-foreground truncate">
                    Outstanding
                  </dt>
                  <dd className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">
                    ${invoices.summary.total_outstanding?.toLocaleString() || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border dark:border-border">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  ${
                    isActive
                      ? "border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground hover:border-border dark:hover:border-border"
                  }
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  flex items-center gap-2
                `}
              >
                {tab.icon && <tab.icon className="h-5 w-5" />}
                {tab.name}
                <span
                  className={`
                  ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium
                  ${
                    isActive
                      ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
                      : "bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground"
                  }
                `}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Invoice List */}
      {currentInvoices.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg shadow">
          <DocumentDuplicateIcon className="mx-auto h-12 w-12 text-muted-foreground dark:text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-foreground dark:text-white">No invoices</h3>
          <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
            Get started by creating your first invoice.
          </p>
        </div>
      ) : (
        <div className="bg-card shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader className="bg-muted dark:bg-muted">
                <TableRow>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                    PO Number
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                    Construction
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                    Amount
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                    Created
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                    Paid
                  </TableHead>
                  <TableHead className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-card divide-y divide-border dark:divide-border">
                {currentInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="hover:bg-muted dark:hover:bg-muted">
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground dark:text-white">
                      {invoice.po_number}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-muted-foreground">
                      {invoice.construction_name}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground dark:text-white">
                      ${invoice.amount?.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(invoice.status)}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-muted-foreground">
                      {formatDate(invoice.created_at)}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-muted-foreground">
                      {formatDate(invoice.paid_at)}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {invoice.can_retry && (
                        <button
                          onClick={() => handleRetrySync(invoice.id)}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-3"
                        >
                          Retry
                        </button>
                      )}
                      <Link
                        href={`/portal/invoices/${invoice.id}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Days Outstanding Info */}
      {invoices.summary.invoices_count && invoices.summary.invoices_count > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <ClockIcon className="h-5 w-5 text-blue-400 dark:text-blue-300" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Payment Stats</h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <p>
                  Total invoices: {invoices.summary.invoices_count} • Paid:{" "}
                  {invoices.summary.paid_invoices_count} • Outstanding:{" "}
                  {invoices.summary.outstanding_invoices_count}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
