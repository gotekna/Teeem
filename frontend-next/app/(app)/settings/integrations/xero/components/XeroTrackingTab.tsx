"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink, Link2, Unlink } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TrackingOption {
  id: string;
  name: string;
  status: string;
  linked_job: {
    id: number;
    name: string;
    job_code: string;
    variant: string | null;
    is_primary: boolean;
  } | null;
}

export function XeroTrackingTab() {
  const router = useRouter();
  const { toast } = useToast();
  const [options, setOptions] = React.useState<TrackingOption[]>([]);
  const [categoryName, setCategoryName] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [stats, setStats] = React.useState({ total: 0, linked: 0, unlinked: 0 });

  const loadOptions = React.useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        tracking_category: string;
        tracking_options: TrackingOption[];
        total: number;
        linked: number;
        unlinked: number;
      }>("/api/v1/xero/tracking_options");

      if (response?.success) {
        setOptions(response.tracking_options || []);
        setCategoryName(response.tracking_category || "");
        setStats({
          total: response.total || 0,
          linked: response.linked || 0,
          unlinked: response.unlinked || 0,
        });
      }
    } catch (error) {
      console.error("Failed to load tracking options:", error);
      toast({
        title: "Error",
        description: "Failed to load Xero tracking options",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear backend cache by calling import
      await api.post<{ success: boolean }>("/api/v1/xero/import_tracking_categories");
      toast({ title: "Success", description: "Tracking categories refreshed from Xero" });
      await loadOptions();
    } catch (error) {
      console.error("Failed to refresh:", error);
      toast({
        title: "Error",
        description: "Failed to refresh from Xero. You may be rate limited.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const query = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(query) ||
        opt.linked_job?.name?.toLowerCase().includes(query) ||
        opt.linked_job?.job_code?.toLowerCase().includes(query)
    );
  }, [options, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Xero Tracking Category: <span className="text-primary">{categoryName}</span>
              </CardTitle>
              <CardDescription>
                Tracking options from Xero used to link jobs to invoices and bills
              </CardDescription>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing..." : "Refresh from Xero"}
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline">{stats.total} total</Badge>
            <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200">
              <Link2 className="h-3 w-3 mr-1" />
              {stats.linked} linked
            </Badge>
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200">
              <Unlink className="h-3 w-3 mr-1" />
              {stats.unlinked} unlinked
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Search + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="w-full max-w-sm">
            <SearchInput
              placeholder="Search tracking options or jobs..."
              value={search}
              onChange={setSearch}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background border-b">
                <TableRow>
                  <TableHead className="font-medium">Tracking Option</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium">Linked Job</TableHead>
                  <TableHead className="font-medium">Job Code</TableHead>
                  <TableHead className="font-medium">Variant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {search ? "No tracking options match your search." : "No tracking options found. Click 'Refresh from Xero' to sync."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOptions.map((opt) => (
                    <TableRow key={opt.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{opt.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            opt.status === "ACTIVE"
                              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {opt.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {opt.linked_job ? (
                          <button
                            className="text-primary hover:underline text-left"
                            onClick={() => router.push(`/jobs/${opt.linked_job!.id}`)}
                          >
                            {opt.linked_job.name}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {opt.linked_job ? (
                          <Badge variant="outline" className="text-xs font-mono">
                            {opt.linked_job.job_code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {opt.linked_job?.variant ? (
                          <Badge variant="outline" className="text-xs">
                            {opt.linked_job.variant}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filteredOptions.length > 0 && (
            <div className="px-4 py-2 border-t text-sm text-muted-foreground">
              Showing {filteredOptions.length} of {options.length} tracking options
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
