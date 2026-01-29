"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import axios from "axios";
import {
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
  CalendarIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import RequestPaymentModal from "@/components/portal/RequestPaymentModal";
import PayNowRequestDetailModal from "@/components/portal/PayNowRequestDetailModal";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

interface PayNowRequest {
  id: number;
  purchase_order_number: string;
  status: string;
  status_display: string;
  original_amount: string;
  discount_percentage: number;
  discount_amount: string;
  discounted_amount: string;
  requested_at: string;
  rejection_reason?: string;
  reviewed_at?: string;
  paid_at?: string;
  reviewed_by?: string;
  supervisor_notes?: string;
  supplier_notes?: string;
  invoice_file_url?: string;
  proof_photos?: string[];
  purchase_order?: { construction_name?: string };
  payment?: { amount: number; payment_date: string; reference_number: string };
  [key: string]: any;
}

interface Requests {
  pending: PayNowRequest[];
  approved: PayNowRequest[];
  paid: PayNowRequest[];
  rejected: PayNowRequest[];
  cancelled: PayNowRequest[];
}

interface Stats {
  total_requests?: number;
  total_paid?: number | string;
  total_savings?: number | string;
  this_week_requests?: number;
}

interface WeeklyLimit {
  remaining_amount?: string;
  total_limit?: string;
  utilization_percentage?: number;
}

interface Tab {
  key: keyof Requests;
  name: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export default function PortalPayNow() {
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  // Path-based tab navigation
  // Note: pathname can be null during SSR/hydration
  const activeTabRaw = useMemo(() => {
    if (!pathname) return null;
    const parts = pathname.replace("/portal/paynow", "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname]);

  useEffect(() => {
    if (activeTabRaw === null) {
      router.replace("/portal/paynow/pending", { scroll: false });
    }
  }, [activeTabRaw, router]);

  const setActiveTab = useCallback((tab: string) => {
    router.push(`/portal/paynow/${tab}`, { scroll: false });
  }, [router]);

  const activeTab = (activeTabRaw || "pending") as keyof Requests;

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Requests>({
    pending: [],
    approved: [],
    paid: [],
    rejected: [],
    cancelled: [],
  });
  const [stats, setStats] = useState<Stats>({});
  const [weeklyLimit, setWeeklyLimit] = useState<WeeklyLimit>({});
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PayNowRequest | null>(
    null
  );

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const token = getStorageItem(STORAGE_KEYS.PORTAL_TOKEN, "");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      const response = await axios.get("/api/v1/portal/pay_now_requests");

      if (response?.data.success) {
        setRequests(response.data.data.requests);
        setStats(response.data.data.stats);
        setWeeklyLimit(response.data.data.weekly_limit);
      }
    } catch (error) {
      console.error("Failed to load Pay Now requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSuccess = () => {
    setShowRequestModal(false);
    loadRequests();
  };

  const handleViewDetails = (request: PayNowRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!confirm("Are you sure you want to cancel this payment request?")) {
      return;
    }

    try {
      const token = getStorageItem(STORAGE_KEYS.PORTAL_TOKEN, "");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      const response = await axios.delete(
        `/api/v1/portal/pay_now_requests/${requestId}`
      );

      if (response?.data.success) {
        toast({ title: "Success", description: "Payment request cancelled successfully" });
        loadRequests();
      }
    } catch (error) {
      console.error("Failed to cancel request:", error);
      toast({ title: "Error", description: "Failed to cancel request. Please try again.", variant: "destructive" });
    }
  };

  const tabs: Tab[] = [
    {
      key: "pending",
      name: "Pending",
      count: requests.pending.length,
      icon: ClockIcon,
      color: "yellow",
    },
    {
      key: "approved",
      name: "Approved",
      count: requests.approved.length,
      icon: CheckCircleIcon,
      color: "green",
    },
    {
      key: "paid",
      name: "Paid",
      count: requests.paid.length,
      icon: CurrencyDollarIcon,
      color: "blue",
    },
    {
      key: "rejected",
      name: "Rejected",
      count: requests.rejected.length,
      icon: XCircleIcon,
      color: "red",
    },
  ];

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      pending: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300",
      approved: "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300",
      paid: "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300",
      rejected: "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300",
      cancelled: "bg-muted dark:bg-muted text-foreground dark:text-muted-foreground",
    };
    return classes[status] || "bg-muted dark:bg-muted text-foreground dark:text-muted-foreground";
  };

  const formatCurrency = (amount: number | string): string => {
    if (typeof amount === "string") {
      return amount; // Already formatted from backend
    }
    return `$${Number(amount).toLocaleString("en-AU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString: string): string | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  const currentRequests = requests[activeTab] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-white">Pay Now</h1>
          <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
            Request early payment with a 5% discount
          </p>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <BanknotesIcon className="-ml-1 mr-2 h-5 w-5" />
          Request Payment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BanknotesIcon className="h-6 w-6 text-muted-foreground dark:text-muted-foreground" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground dark:text-muted-foreground truncate">
                    Total Requests
                  </dt>
                  <dd className="text-lg font-medium text-foreground dark:text-white">
                    {stats.total_requests || 0}
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
                <CurrencyDollarIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground dark:text-muted-foreground truncate">
                    Total Paid
                  </dt>
                  <dd className="text-lg font-medium text-foreground dark:text-white">
                    {formatCurrency(stats.total_paid || 0)}
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
                <ChartBarIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground dark:text-muted-foreground truncate">
                    Total Savings
                  </dt>
                  <dd className="text-lg font-medium text-foreground dark:text-white">
                    {formatCurrency(stats.total_savings || 0)}
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
                <CalendarIcon className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground dark:text-muted-foreground truncate">
                    This Week
                  </dt>
                  <dd className="text-lg font-medium text-foreground dark:text-white">
                    {stats.this_week_requests || 0} requests
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Limit Info */}
      {weeklyLimit && weeklyLimit.remaining_amount && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                Weekly Limit Available
              </h3>
              <p className="mt-1 text-2xl font-semibold text-indigo-900 dark:text-indigo-100">
                {weeklyLimit.remaining_amount}
              </p>
              <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">
                {weeklyLimit.utilization_percentage}% of {weeklyLimit.total_limit}{" "}
                used
              </p>
            </div>
            <div className="w-32 h-32">
              <div className="relative">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-indigo-200 dark:text-indigo-800"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${
                      (weeklyLimit.utilization_percentage || 0) * 3.52
                    } 352`}
                    className="text-indigo-600 dark:text-indigo-400"
                  />
                </svg>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                  <span className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                    {Math.round(weeklyLimit.utilization_percentage || 0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border dark:border-border">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
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
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                `}
              >
                <Icon
                  className={`
                    ${
                      isActive
                        ? "text-indigo-500 dark:text-indigo-400"
                        : "text-muted-foreground dark:text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground"
                    }
                    -ml-0.5 mr-2 h-5 w-5
                  `}
                />
                <span>{tab.name}</span>
                {tab.count > 0 && (
                  <span
                    className={`
                    ${
                      isActive
                        ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
                        : "bg-muted dark:bg-muted text-foreground dark:text-muted-foreground"
                    }
                    hidden ml-3 py-0.5 px-2.5 rounded-full text-xs font-medium md:inline-block
                  `}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Requests List */}
      <div className="bg-card shadow overflow-hidden sm:rounded-md">
        {currentRequests.length === 0 ? (
          <div className="text-center py-12">
            <BanknotesIcon className="mx-auto h-12 w-12 text-muted-foreground dark:text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-foreground dark:text-white">
              No requests
            </h3>
            <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
              {activeTab === "pending"
                ? "You have no pending payment requests."
                : `No ${activeTab} payment requests found.`}
            </p>
            {activeTab === "pending" && (
              <div className="mt-6">
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <BanknotesIcon className="-ml-1 mr-2 h-5 w-5" />
                  Request Payment
                </button>
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border dark:divide-border">
            {currentRequests.map((request) => (
              <li key={request.id}>
                <div
                  className="px-4 py-4 sm:px-6 hover:bg-muted dark:hover:bg-muted cursor-pointer"
                  onClick={() => handleViewDetails(request)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                          PO #{request.purchase_order_number}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                              request.status
                            )}`}
                          >
                            {request.status_display}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <div className="flex items-center text-sm text-muted-foreground dark:text-muted-foreground">
                          <BanknotesIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
                          <span className="font-medium text-foreground dark:text-white">
                            {request.discounted_amount}
                          </span>
                          <span className="ml-1">
                            (saved {request.discount_amount})
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground dark:text-muted-foreground">
                          <CalendarIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
                          {formatDate(request.requested_at)}
                        </div>
                      </div>
                      {request.rejection_reason && (
                        <div className="mt-2 flex items-start text-sm text-red-600 dark:text-red-400">
                          <XCircleIcon className="flex-shrink-0 mr-1.5 h-5 w-5" />
                          <span>{request.rejection_reason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {request.status === "pending" && (
                    <div className="mt-2 flex items-center justify-end space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelRequest(request.id);
                        }}
                        className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        Cancel Request
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modals */}
      {showRequestModal && (
        <RequestPaymentModal
          isOpen={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          onSuccess={handleRequestSuccess}
        />
      )}

      {showDetailModal && selectedRequest && (
        <PayNowRequestDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          request={selectedRequest}
        />
      )}
    </div>
  );
}
