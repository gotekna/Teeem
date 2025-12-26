"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Plus,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Pencil,
  Trash2,
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  BarChart3,
  Search,
  Filter,
  PackageOpen,
  PackageX,
  Boxes,
  History,
} from "lucide-react";
import { api } from "@/lib/api";

interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit_of_measure?: string;
  cost_price: number | null;
  sale_price: number | null;
  costing_method: string;
  quantity_on_hand: number;
  quantity_committed: number;
  quantity_on_order: number;
  quantity_available: number;
  reorder_point: number | null;
  reorder_quantity: number | null;
  track_inventory: boolean;
  status: string;
  stock_status: string;
  needs_reorder: boolean;
  inventory_value: number;
  is_sellable: boolean;
  is_purchasable: boolean;
  last_received_at: string | null;
  last_sold_at: string | null;
  last_counted_at: string | null;
}

interface InventoryValuation {
  total_value: number;
  total_items: number;
  total_quantity: number;
  by_category: Record<string, number>;
  items: Array<{
    id: number;
    sku: string;
    name: string;
    quantity: number;
    cost_price: number;
    value: number;
  }>;
}

interface StockCount {
  id: number;
  reference: string;
  count_date: string;
  status: string;
  notes?: string;
  started_at?: string;
  completed_at?: string;
  created_by?: string;
  approved_by?: string;
  total_variance_value: number;
  items_with_variance: number;
  total_items: number;
  lines?: StockCountLine[];
}

interface StockCountLine {
  id: number;
  inventory_item_id: number;
  sku: string;
  name: string;
  system_quantity: number;
  counted_quantity: number | null;
  variance: number;
  variance_value: number;
  notes?: string;
}

interface InventoryTransaction {
  id: number;
  transaction_type: string;
  type_label: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  quantity_before: number;
  quantity_after: number;
  direction: string;
  notes?: string;
  user?: string;
  transaction_date: string;
}

export default function InventoryTab() {
  const [activeView, setActiveView] = useState<"items" | "valuation" | "counts">("items");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [stockCounts, setStockCounts] = useState<StockCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialogs
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showWriteOffDialog, setShowWriteOffDialog] = useState(false);
  const [showTransactionsDialog, setShowTransactionsDialog] = useState(false);
  const [showNewCountDialog, setShowNewCountDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);

  // Form fields
  const [receiveQuantity, setReceiveQuantity] = useState("");
  const [receiveUnitCost, setReceiveUnitCost] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [writeOffQuantity, setWriteOffQuantity] = useState("");
  const [writeOffReason, setWriteOffReason] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = "/api/v1/gl/inventory?";
      if (statusFilter !== "all") url += `status=${statusFilter}&`;
      if (categoryFilter !== "all") url += `category=${encodeURIComponent(categoryFilter)}&`;
      if (stockFilter === "low") url += "low_stock=true&";
      if (stockFilter === "out") url += "out_of_stock=true&";

      const response = await api.get<{ success: boolean; data: InventoryItem[] }>(url);
      if (response.success) {
        setItems(response.data);
      }
    } catch (err) {
      setError("Failed to load inventory items");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, stockFilter]);

  const fetchValuation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: InventoryValuation }>(
        "/api/v1/gl/inventory/valuation"
      );
      if (response.success) {
        setValuation(response.data);
      }
    } catch (err) {
      setError("Failed to load valuation");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStockCounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: StockCount[] }>(
        "/api/v1/gl/inventory/stock_counts"
      );
      if (response.success) {
        setStockCounts(response.data);
      }
    } catch (err) {
      setError("Failed to load stock counts");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = async (itemId: number) => {
    try {
      const response = await api.get<{ success: boolean; data: InventoryTransaction[] }>(
        `/api/v1/gl/inventory/${itemId}/transactions`
      );
      if (response.success) {
        setTransactions(response.data);
      }
    } catch (err) {
      console.error("Failed to load transactions", err);
    }
  };

  useEffect(() => {
    if (activeView === "items") {
      fetchItems();
    } else if (activeView === "valuation") {
      fetchValuation();
    } else if (activeView === "counts") {
      fetchStockCounts();
    }
  }, [activeView, fetchItems, fetchValuation, fetchStockCounts]);

  const handleReceive = async () => {
    if (!selectedItem) return;
    try {
      const response = await api.post<{ success: boolean; message?: string; error?: string }>(
        `/api/v1/gl/inventory/${selectedItem.id}/receive`,
        {
          quantity: parseFloat(receiveQuantity),
          unit_cost: receiveUnitCost ? parseFloat(receiveUnitCost) : undefined,
          notes: receiveNotes,
        }
      );
      if (response?.success) {
        setShowReceiveDialog(false);
        setReceiveQuantity("");
        setReceiveUnitCost("");
        setReceiveNotes("");
        fetchItems();
      }
    } catch (err) {
      console.error("Failed to receive stock", err);
    }
  };

  const handleAdjust = async () => {
    if (!selectedItem) return;
    try {
      const response = await api.post<{ success: boolean; message?: string; error?: string }>(
        `/api/v1/gl/inventory/${selectedItem.id}/adjust`,
        {
          quantity: parseFloat(adjustQuantity),
          reason: adjustReason,
        }
      );
      if (response?.success) {
        setShowAdjustDialog(false);
        setAdjustQuantity("");
        setAdjustReason("");
        fetchItems();
      }
    } catch (err) {
      console.error("Failed to adjust stock", err);
    }
  };

  const handleWriteOff = async () => {
    if (!selectedItem) return;
    try {
      const response = await api.post<{ success: boolean; message?: string; error?: string }>(
        `/api/v1/gl/inventory/${selectedItem.id}/write_off`,
        {
          quantity: parseFloat(writeOffQuantity),
          reason: writeOffReason,
        }
      );
      if (response?.success) {
        setShowWriteOffDialog(false);
        setWriteOffQuantity("");
        setWriteOffReason("");
        fetchItems();
      }
    } catch (err) {
      console.error("Failed to write off stock", err);
    }
  };

  const handleCreateStockCount = async () => {
    try {
      const response = await api.post<{ success: boolean; data?: StockCount; error?: string }>(
        "/api/v1/gl/inventory/stock_counts",
        {
          count_date: new Date().toISOString().split("T")[0],
          populate_all: "true",
        }
      );
      if (response?.success) {
        setShowNewCountDialog(false);
        fetchStockCounts();
      }
    } catch (err) {
      console.error("Failed to create stock count", err);
    }
  };

  const getStockStatusBadge = (status: string) => {
    switch (status) {
      case "in_stock":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            In Stock
          </Badge>
        );
      case "low_stock":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Low Stock
          </Badge>
        );
      case "out_of_stock":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Out of Stock
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCountStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="outline" className="text-gray-600">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
            <RefreshCw className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Pending Approval
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString();
  };

  // Get unique categories for filter
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))];

  // Filter items by search
  const filteredItems = items.filter(
    (item) =>
      searchQuery === "" ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
        <TabsList>
          <TabsTrigger value="items" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Inventory Items
          </TabsTrigger>
          <TabsTrigger value="valuation" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Valuation
          </TabsTrigger>
          <TabsTrigger value="counts" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Stock Counts
          </TabsTrigger>
        </TabsList>

        {/* Items View */}
        <TabsContent value="items" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                    <p className="text-2xl font-bold">{items.length}</p>
                  </div>
                  <Boxes className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Low Stock</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {items.filter((i) => i.stock_status === "low_stock").length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Out of Stock</p>
                    <p className="text-2xl font-bold text-red-600">
                      {items.filter((i) => i.stock_status === "out_of_stock").length}
                    </p>
                  </div>
                  <PackageX className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(items.reduce((sum, i) => sum + (i.inventory_value || 0), 0))}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by SKU or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Stock Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                {categories.length > 0 && (
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat!}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button variant="outline" onClick={fetchItems}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <PackageOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No inventory items found</p>
                  <p className="text-sm mt-1">Create items to start tracking inventory</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Qty On Hand</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono font-medium">{item.sku}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.unit_of_measure && (
                              <p className="text-xs text-muted-foreground">
                                Unit: {item.unit_of_measure}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.category || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity_on_hand}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity_available}
                          {item.needs_reorder && (
                            <AlertTriangle className="h-4 w-4 text-amber-500 inline ml-1" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.cost_price)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.inventory_value)}
                        </TableCell>
                        <TableCell>{getStockStatusBadge(item.stock_status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedItem(item);
                                setShowReceiveDialog(true);
                              }}
                              title="Receive Stock"
                            >
                              <ArrowDownToLine className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedItem(item);
                                setAdjustQuantity(item.quantity_on_hand.toString());
                                setShowAdjustDialog(true);
                              }}
                              title="Adjust Stock"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedItem(item);
                                setShowWriteOffDialog(true);
                              }}
                              title="Write Off"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedItem(item);
                                fetchTransactions(item.id);
                                setShowTransactionsDialog(true);
                              }}
                              title="View History"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Valuation View */}
        <TabsContent value="valuation" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : valuation ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Inventory Value</p>
                        <p className="text-3xl font-bold text-green-600">
                          {formatCurrency(valuation.total_value)}
                        </p>
                      </div>
                      <DollarSign className="h-10 w-10 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Items</p>
                        <p className="text-3xl font-bold">{valuation.total_items}</p>
                      </div>
                      <Boxes className="h-10 w-10 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Quantity</p>
                        <p className="text-3xl font-bold">{valuation.total_quantity}</p>
                      </div>
                      <Package className="h-10 w-10 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* By Category */}
              {Object.keys(valuation.by_category).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Value by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(valuation.by_category).map(([category, value]) => (
                        <div key={category} className="flex items-center justify-between">
                          <span className="font-medium">{category || "Uncategorized"}</span>
                          <div className="flex items-center gap-4">
                            <div className="w-48 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary rounded-full h-2"
                                style={{
                                  width: `${(value / valuation.total_value) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="w-28 text-right font-mono">
                              {formatCurrency(value)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Items by Value */}
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Items by Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Cost Price</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {valuation.items
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 20)
                        .map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.sku}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.cost_price)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.value)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No valuation data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Stock Counts View */}
        <TabsContent value="counts" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Stock Counts</h3>
              <p className="text-sm text-muted-foreground">
                Perform physical inventory counts to verify stock levels
              </p>
            </div>
            <Button onClick={() => setShowNewCountDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Count
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : stockCounts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No stock counts</p>
                  <p className="text-sm mt-1">Create a stock count to verify inventory levels</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Count Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Variances</TableHead>
                      <TableHead className="text-right">Variance Value</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Approved By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockCounts.map((count) => (
                      <TableRow key={count.id}>
                        <TableCell className="font-mono font-medium">{count.reference}</TableCell>
                        <TableCell>{formatDate(count.count_date)}</TableCell>
                        <TableCell>{getCountStatusBadge(count.status)}</TableCell>
                        <TableCell className="text-right">{count.total_items}</TableCell>
                        <TableCell className="text-right">
                          {count.items_with_variance > 0 ? (
                            <Badge variant="outline" className="text-amber-600">
                              {count.items_with_variance}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {count.total_variance_value !== 0 ? (
                            <span
                              className={
                                count.total_variance_value < 0 ? "text-red-600" : "text-green-600"
                              }
                            >
                              {formatCurrency(count.total_variance_value)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{count.created_by || "-"}</TableCell>
                        <TableCell>{count.approved_by || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Receive Stock Dialog */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5" />
              Receive Stock
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.name} ({selectedItem?.sku})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Quantity to Receive</Label>
              <Input
                type="number"
                value={receiveQuantity}
                onChange={(e) => setReceiveQuantity(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>
            <div>
              <Label>Unit Cost (optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={receiveUnitCost}
                onChange={(e) => setReceiveUnitCost(e.target.value)}
                placeholder={selectedItem?.cost_price?.toString() || "Enter unit cost"}
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                placeholder="e.g., PO number, supplier"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={!receiveQuantity}>
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Receive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Adjust Stock
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.name} ({selectedItem?.sku}) - Current: {selectedItem?.quantity_on_hand}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>New Quantity</Label>
              <Input
                type="number"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(e.target.value)}
                placeholder="Enter new quantity"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., Stocktake adjustment, damage"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={!adjustQuantity}>
              <Pencil className="h-4 w-4 mr-2" />
              Adjust
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Write Off Dialog */}
      <Dialog open={showWriteOffDialog} onOpenChange={setShowWriteOffDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Write Off Stock
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.name} ({selectedItem?.sku}) - Available: {selectedItem?.quantity_on_hand}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">
                This will permanently remove stock and record a COGS expense.
              </p>
            </div>
            <div>
              <Label>Quantity to Write Off</Label>
              <Input
                type="number"
                value={writeOffQuantity}
                onChange={(e) => setWriteOffQuantity(e.target.value)}
                placeholder="Enter quantity"
                max={selectedItem?.quantity_on_hand}
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                value={writeOffReason}
                onChange={(e) => setWriteOffReason(e.target.value)}
                placeholder="e.g., Damaged, expired, obsolete"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWriteOffDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleWriteOff}
              disabled={!writeOffQuantity || !writeOffReason}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Write Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={showTransactionsDialog} onOpenChange={setShowTransactionsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaction History
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.name} ({selectedItem?.sku})
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>{formatDate(txn.transaction_date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          txn.direction === "in"
                            ? "text-green-600 border-green-600"
                            : "text-red-600 border-red-600"
                        }
                      >
                        {txn.direction === "in" ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {txn.type_label}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        txn.quantity > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {txn.quantity > 0 ? "+" : ""}
                      {txn.quantity}
                    </TableCell>
                    <TableCell className="text-right">{txn.quantity_before}</TableCell>
                    <TableCell className="text-right font-medium">{txn.quantity_after}</TableCell>
                    <TableCell className="text-muted-foreground">{txn.notes || "-"}</TableCell>
                    <TableCell>{txn.user || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Stock Count Dialog */}
      <Dialog open={showNewCountDialog} onOpenChange={setShowNewCountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              New Stock Count
            </DialogTitle>
            <DialogDescription>
              Create a new physical inventory count
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              A new stock count will be created for today&apos;s date and populated with all active
              inventory items. You can then record counted quantities and submit for approval.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCountDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateStockCount}>
              <Plus className="h-4 w-4 mr-2" />
              Create Count
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
