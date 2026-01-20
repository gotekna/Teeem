"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Banknote,
  Star,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  History,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api";

interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_base_currency: boolean;
  active: boolean;
  display_name: string;
  current_rate: number | null;
  created_at: string;
}

interface BaseCurrency {
  id: number;
  code: string;
  name: string;
  symbol: string;
}

function formatRate(rate: number | null): string {
  if (rate === null) return "-";
  return rate.toFixed(6);
}

export default function CurrenciesTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<BaseCurrency | null>(null);
  const [ratesStale, setRatesStale] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [currenciesRes, staleRes] = await Promise.all([
        api.get<{ success: boolean; data: Currency[]; base_currency: BaseCurrency }>("/api/v1/gl/currencies"),
        api.get<{ success: boolean; stale: boolean }>("/api/v1/gl/currencies/rates/stale"),
      ]);

      if (currenciesRes?.success) {
        setCurrencies(currenciesRes.data || []);
        setBaseCurrency(currenciesRes.base_currency);
      }
      if (staleRes?.success) setRatesStale(staleRes.stale);
    } catch (error) {
      console.error("Failed to fetch currencies:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleFetchRates = async () => {
    try {
      await api.post("/api/v1/gl/currencies/rates/fetch");
      fetchData();
    } catch (error) {
      console.error("Failed to fetch rates:", error);
    }
  };

  const handleSetAsBase = async (currency: Currency) => {
    try {
      await api.post(`/api/v1/gl/currencies/${currency.id}/set_as_base`);
      fetchData();
    } catch (error) {
      console.error("Failed to set base currency:", error);
    }
  };

  const handleSetupDefaults = async () => {
    try {
      await api.post("/api/v1/gl/currencies/setup_defaults");
      fetchData();
    } catch (error) {
      console.error("Failed to setup defaults:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const activeCurrencies = currencies.filter((c) => c.active);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Star className="h-4 w-4" />
              Base Currency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {baseCurrency ? `${baseCurrency.symbol} ${baseCurrency.code}` : "Not set"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{baseCurrency?.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Active Currencies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCurrencies.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              of {currencies.length} configured
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4" />
              Rate Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ratesStale ? (
                <span className="text-yellow-600">Stale</span>
              ) : (
                <span className="text-green-600">Current</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {ratesStale ? "rates need updating" : "rates are up to date"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button size="sm" variant="outline" onClick={handleFetchRates} className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              Fetch Latest Rates
            </Button>
            {currencies.length === 0 && (
              <Button size="sm" onClick={handleSetupDefaults} className="w-full">
                Setup Default Currencies
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Currencies List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Currencies & Exchange Rates
          </CardTitle>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {currencies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No currencies configured</p>
              <p className="text-sm mt-1">Set up currencies to manage multi-currency transactions</p>
              <Button className="mt-4" onClick={handleSetupDefaults}>
                Setup Default Currencies
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Currency</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Exchange Rate</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.map((currency) => (
                  <TableRow key={currency.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{currency.name}</span>
                        {currency.is_base_currency && (
                          <Badge className="bg-status-warning text-status-warning-foreground dark:bg-yellow-900/30 dark:text-yellow-400">
                            <Star className="h-3 w-3 mr-1" />
                            Base
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{currency.code}</TableCell>
                    <TableCell>{currency.symbol}</TableCell>
                    <TableCell className="text-right">
                      {currency.is_base_currency ? (
                        <span className="text-muted-foreground">1.000000</span>
                      ) : currency.current_rate ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-mono">{formatRate(currency.current_rate)}</span>
                          {currency.current_rate > 1 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No rate</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={currency.active ? "default" : "secondary"}>
                        {currency.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!currency.is_base_currency && currency.active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetAsBase(currency)}
                        >
                          <Star className="h-4 w-4 mr-1" />
                          Set Base
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
