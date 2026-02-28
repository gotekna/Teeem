"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { portalApi } from "@/lib/portal-api";

interface QuoteRecord {
  id: string;
  source: "quote_tracker" | "custom_quote";
  builder: string;
  builderId: number;
  jobName: string | null;
  itemName: string | null;
  priceQuoted: number | null;
  quoteNumber: string | null;
  sentAt: string | null;
  dateReceived: string | null;
  validTo: string | null;
  status: string;
  daysWaiting: number | null;
  isBestPrice: boolean;
  purchaseOrderId: number | null;
  timeframe: string | null;
  responseNotes: string | null;
}

interface Builder {
  id: number;
  name: string;
}

interface QuoteTrackersData {
  builders: Builder[];
  awaiting_response: QuoteRecord[];
  responded: QuoteRecord[];
  accepted: QuoteRecord[];
  rejected: QuoteRecord[];
}

type TabKey = "awaiting_response" | "responded" | "accepted" | "rejected";

const TAB_CONFIG = [
  {
    key: "awaiting_response" as TabKey,
    urlSlug: "awaiting",
    name: "Awaiting My Quote",
    icon: ClockIcon,
    activeColor: "border-yellow-500 text-yellow-600 dark:text-yellow-400",
    badgeColor: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400",
  },
  {
    key: "responded" as TabKey,
    urlSlug: "responded",
    name: "Responded",
    icon: DocumentTextIcon,
    activeColor: "border-blue-500 text-blue-600 dark:text-blue-400",
    badgeColor: "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400",
  },
  {
    key: "accepted" as TabKey,
    urlSlug: "accepted",
    name: "Accepted",
    icon: CheckCircleIcon,
    activeColor: "border-green-500 text-green-600 dark:text-green-400",
    badgeColor: "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400",
  },
  {
    key: "rejected" as TabKey,
    urlSlug: "rejected",
    name: "Rejected",
    icon: XCircleIcon,
    activeColor: "border-border text-muted-foreground dark:text-muted-foreground",
    badgeColor: "bg-muted text-muted-foreground",
  },
];

const INACTIVE_TAB =
  "border-transparent text-muted-foreground hover:text-foreground hover:border-border";
const INACTIVE_BADGE = "bg-muted text-muted-foreground";

function slugToKey(slug: string | null): TabKey {
  const match = TAB_CONFIG.find((t) => t.urlSlug === slug);
  return match?.key ?? "awaiting_response";
}

function keyToSlug(key: TabKey): string {
  return TAB_CONFIG.find((t) => t.key === key)?.urlSlug ?? "awaiting";
}

export default function PortalQuotes() {
  const pathname = usePathname();
  const router = useRouter();

  const activeTabSlug = useMemo(() => {
    if (!pathname) return null;
    const parts = pathname.replace("/portal/quotes", "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname]);

  useEffect(() => {
    if (activeTabSlug === null) {
      router.replace("/portal/quotes/awaiting", { scroll: false });
    }
  }, [activeTabSlug, router]);

  const activeTab = slugToKey(activeTabSlug);

  const setActiveTab = useCallback(
    (key: TabKey) => {
      router.push(`/portal/quotes/${keyToSlug(key)}`, { scroll: false });
    },
    [router]
  );

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuoteTrackersData>({
    builders: [],
    awaiting_response: [],
    responded: [],
    accepted: [],
    rejected: [],
  });

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      const response = await portalApi.get("/api/v1/portal/quote_trackers");
      if (response?.data?.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error("Failed to load quotes:", error);
    } finally {
      setLoading(false);
    }
  };

  const multiBuilder = data.builders.length > 1;
  const currentQuotes = data[activeTab] || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white">Quotes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {multiBuilder
            ? `Quotes from ${data.builders.map((b) => b.name).join(", ")}`
            : "View and track your quotes"}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = (data[tab.key] || []).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  ${isActive ? tab.activeColor : INACTIVE_TAB}
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  flex items-center gap-2
                `}
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
                <span
                  className={`ml-1 py-0.5 px-2.5 rounded-full text-xs font-medium ${
                    isActive ? tab.badgeColor : INACTIVE_BADGE
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Quote List */}
      {currentQuotes.length === 0 ? (
        <div className="bg-card rounded-lg shadow">
          <EmptyState
            title={`No ${TAB_CONFIG.find((t) => t.key === activeTab)?.name?.toLowerCase() || ""} quotes`}
            description={
              activeTab === "awaiting_response"
                ? "No builders are currently waiting for your quotes."
                : `No quotes in this category.`
            }
            icon={<DocumentTextIcon className="h-12 w-12" />}
          />
        </div>
      ) : (
        <div className="bg-card shadow rounded-lg overflow-hidden">
          <ul role="list" className="divide-y divide-border">
            {currentQuotes.map((quote) => (
              <QuoteRow
                key={quote.id}
                quote={quote}
                activeTab={activeTab}
                showBuilder={multiBuilder}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QuoteRow({
  quote,
  activeTab,
  showBuilder,
}: {
  quote: QuoteRecord;
  activeTab: TabKey;
  showBuilder: boolean;
}) {
  const isExpired = quote.validTo && new Date(quote.validTo) < new Date();

  return (
    <li className="px-4 py-4 sm:px-6 hover:bg-muted/50">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {/* Top line: builder badge + job name */}
          <div className="flex items-center gap-2 flex-wrap">
            {showBuilder && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                {quote.builder}
              </span>
            )}
            <p className="text-base font-medium text-foreground dark:text-white truncate">
              {quote.jobName || "Unknown Job"}
            </p>
          </div>

          {/* Item/task name */}
          {quote.itemName && (
            <p className="mt-1 text-sm text-muted-foreground truncate">
              {quote.itemName}
            </p>
          )}

          {/* Details row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {/* Price (responded/accepted/rejected) */}
            {quote.priceQuoted != null && (
              <span className="font-medium text-foreground dark:text-white">
                ${quote.priceQuoted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            )}

            {/* Sent date */}
            {quote.sentAt && (
              <span>Sent {formatDate(quote.sentAt)}</span>
            )}

            {/* Received date */}
            {quote.dateReceived && (
              <span>Received {formatDate(quote.dateReceived)}</span>
            )}

            {/* Timeframe */}
            {quote.timeframe && <span>{quote.timeframe}</span>}

            {/* Valid to */}
            {quote.validTo && (
              <span className={isExpired ? "text-red-500 dark:text-red-400 font-medium" : ""}>
                {isExpired ? "Expired" : `Valid to ${formatDate(quote.validTo)}`}
              </span>
            )}

            {/* Best price badge */}
            {quote.isBestPrice && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                Best Price
              </span>
            )}
          </div>
        </div>

        {/* Right side: days waiting or status indicator */}
        <div className="ml-4 flex-shrink-0 flex items-center gap-3">
          {activeTab === "awaiting_response" && quote.daysWaiting != null && (
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">Waiting</span>
              <span className="text-sm font-medium text-foreground dark:text-white">
                {quote.daysWaiting}d
              </span>
            </div>
          )}

          {activeTab === "accepted" && (
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
          )}

          {activeTab === "rejected" && (
            <XCircleIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>
    </li>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
