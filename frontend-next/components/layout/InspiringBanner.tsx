"use client";

import * as React from "react";
import { Quote as QuoteIcon } from "lucide-react";
import { api } from "@/lib/api";
import { POLLING_QUOTE_REFRESH_MS } from "@/lib/constants/timeout-constants";

interface Quote {
  quote: string;
  author?: string;
}

export function InspiringBanner() {
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    const loadDailyQuote = async () => {
      try {
        const response = await api.get<{ success: boolean; data: Quote }>("/api/v1/inspiring_quotes/daily");
        if (mounted && response?.success && response?.data) {
          setQuote(response.data);
        }
      } catch (error) {
        console.debug("Daily quote unavailable:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDailyQuote();
    const interval = setInterval(loadDailyQuote, POLLING_QUOTE_REFRESH_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading || !quote) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-muted-foreground max-w-xl">
      <QuoteIcon className="h-3 w-3 flex-shrink-0 opacity-50" />
      <p className="text-xs italic truncate">
        {quote.quote}
      </p>
    </div>
  );
}
