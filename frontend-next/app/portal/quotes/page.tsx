"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { Spinner } from "@/components/ui/spinner";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

interface Construction {
  id: number;
  name: string;
}

interface QuoteRequest {
  id: number;
  title: string;
  construction: Construction;
  trade_category?: string;
  budget_min?: number;
  budget_max?: number;
}

interface MyResponse {
  status: string;
  price?: number;
  timeframe?: string;
}

interface Quote {
  quote_request: QuoteRequest;
  my_response?: MyResponse;
  days_waiting?: number;
}

interface QuotesData {
  pending: Quote[];
  submitted: Quote[];
  accepted: Quote[];
  rejected: Quote[];
}

type TabKey = keyof QuotesData;

export default function PortalQuotes() {
  const pathname = usePathname();
  const router = useRouter();

  // Path-based tab navigation
  const activeTabRaw = useMemo(() => {
    const parts = pathname.replace("/portal/quotes", "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname]);

  useEffect(() => {
    if (activeTabRaw === null) {
      router.replace("/portal/quotes/pending", { scroll: false });
    }
  }, [activeTabRaw, router]);

  const setActiveTab = useCallback((tab: string) => {
    router.push(`/portal/quotes/${tab}`, { scroll: false });
  }, [router]);

  const activeTab = (activeTabRaw || "pending") as TabKey;

  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<QuotesData>({
    pending: [],
    submitted: [],
    accepted: [],
    rejected: [],
  });

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      const token = getStorageItem(STORAGE_KEYS.PORTAL_TOKEN, "");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      const response = await axios.get("/api/v1/portal/quote_requests");

      if (response?.data.success) {
        setQuotes(response.data.data);
      }
    } catch (error) {
      console.error("Failed to load quotes:", error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    {
      key: "pending" as TabKey,
      name: "Pending",
      count: quotes.pending.length,
      icon: ClockIcon,
      color: "yellow",
    },
    {
      key: "submitted" as TabKey,
      name: "Submitted",
      count: quotes.submitted.length,
      icon: DocumentTextIcon,
      color: "blue",
    },
    {
      key: "accepted" as TabKey,
      name: "Accepted",
      count: quotes.accepted.length,
      icon: CheckCircleIcon,
      color: "green",
    },
    {
      key: "rejected" as TabKey,
      name: "Rejected",
      count: quotes.rejected.length,
      icon: XCircleIcon,
      color: "gray",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300";
      case "submitted":
        return "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300";
      case "accepted":
        return "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300";
      case "rejected":
        return "bg-muted dark:bg-muted text-foreground dark:text-muted-foreground";
      default:
        return "bg-muted dark:bg-muted text-foreground dark:text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  const currentQuotes = quotes[activeTab] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white">Quote Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
          View and respond to quote requests from builders
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border dark:border-border">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const colorClasses: Record<string, string> = {
              yellow: isActive
                ? "border-yellow-500 text-yellow-600 dark:text-yellow-400"
                : "border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground hover:border-border dark:hover:border-border",
              blue: isActive
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground hover:border-border dark:hover:border-border",
              green: isActive
                ? "border-green-500 text-green-600 dark:text-green-400"
                : "border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground hover:border-border dark:hover:border-border",
              gray: isActive
                ? "border-border text-muted-foreground dark:text-muted-foreground"
                : "border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground hover:border-border dark:hover:border-border",
            };

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  ${colorClasses[tab.color as keyof typeof colorClasses] || colorClasses.gray}
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  flex items-center gap-2
                `}
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
                <span
                  className={`
                  ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium
                  ${
                    isActive
                      ? `bg-${tab.color}-100 dark:bg-${tab.color}-900/50 text-${tab.color}-600 dark:text-${tab.color}-400`
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

      {/* Quote List */}
      {currentQuotes.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg shadow">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-muted-foreground dark:text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-foreground dark:text-white">
            No {activeTab} quotes
          </h3>
          <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
            {activeTab === "pending"
              ? "You don't have any pending quote requests at the moment."
              : `No quotes in ${activeTab} status.`}
          </p>
        </div>
      ) : (
        <div className="bg-card shadow rounded-lg overflow-hidden">
          <ul role="list" className="divide-y divide-border dark:divide-border">
            {currentQuotes.map((quote) => (
              <li key={quote.quote_request.id} className="hover:bg-muted dark:hover:bg-muted">
                <Link
                  href={`/portal/quotes/${quote.quote_request.id}`}
                  className="block px-4 py-4 sm:px-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="text-base font-medium text-foreground dark:text-white truncate">
                          {quote.quote_request.title}
                        </p>
                        {quote.my_response && (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              quote.my_response.status
                            )}`}
                          >
                            {quote.my_response.status}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:space-x-6">
                        <div className="flex items-center text-sm text-muted-foreground dark:text-muted-foreground">
                          <svg
                            className="flex-shrink-0 mr-1.5 h-5 w-5 text-muted-foreground dark:text-muted-foreground"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
                            />
                          </svg>
                          {quote.quote_request.construction.name}
                        </div>

                        {quote.quote_request.trade_category && (
                          <div className="flex items-center text-sm text-muted-foreground dark:text-muted-foreground">
                            <svg
                              className="flex-shrink-0 mr-1.5 h-5 w-5 text-muted-foreground dark:text-muted-foreground"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="1.5"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
                              />
                            </svg>
                            {quote.quote_request.trade_category}
                          </div>
                        )}

                        {quote.quote_request.budget_min &&
                          quote.quote_request.budget_max && (
                            <div className="flex items-center text-sm text-muted-foreground dark:text-muted-foreground">
                              <svg
                                className="flex-shrink-0 mr-1.5 h-5 w-5 text-muted-foreground dark:text-muted-foreground"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="1.5"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              ${quote.quote_request.budget_min.toLocaleString()} -
                              ${quote.quote_request.budget_max.toLocaleString()}
                            </div>
                          )}
                      </div>

                      {quote.my_response && (
                        <div className="mt-2 text-sm text-foreground dark:text-white">
                          <span className="font-medium">Your quote:</span> $
                          {quote.my_response.price?.toLocaleString()}
                          {quote.my_response.timeframe && (
                            <span className="ml-3 text-muted-foreground dark:text-muted-foreground">
                              • Timeframe: {quote.my_response.timeframe}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="ml-5 flex-shrink-0 flex items-center gap-4">
                      {activeTab === "pending" && (
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-muted-foreground dark:text-muted-foreground">Waiting</span>
                          <span className="text-sm font-medium text-foreground dark:text-white">
                            {quote.days_waiting} days
                          </span>
                        </div>
                      )}

                      <svg
                        className="h-5 w-5 text-muted-foreground dark:text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
