"use client";

import { useEffect, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Upload,
  Download,
  DollarSign,
  Package,
  AlertTriangle,
  Image as ImageIcon,
  MoreHorizontal,
  Edit,
  Trash,
  History,
  QrCode,
  FileText,
  CheckCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { slugifyPricebookCode } from "@/lib/url-utils";

interface PriceBookItem {
  id: number;
  item_code: string;
  item_name: string;
  category: string;
  unit_of_measure: string;
  current_price: number;
  brand: string | null;
  notes: string | null;
  is_active: boolean;
  needs_pricing_review: boolean;
  price_last_updated_at: string | null;
  image_url: string | null;
  default_supplier_id: number | null;
  requires_photo: boolean;
  requires_spec: boolean;
  spec_url: string | null;
  gst_code: string | null;
}

interface CategoryCount {
  category: string;
  count: number;
}

export default function PriceBookPage() {
  const [items, setItems] = useState<PriceBookItem[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await api.get<{ items: PriceBookItem[] }>("/api/v1/pricebook");
        setItems(response.items || []);
        // Extract categories from items
        const catCounts = (response.items || []).reduce((acc: Record<string, number>, item) => {
          if (item.category) {
            acc[item.category] = (acc[item.category] || 0) + 1;
          }
          return acc;
        }, {});
        setCategories(
          Object.entries(catCounts)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
        );
      } catch (error) {
        console.error("Failed to load pricebook:", error);
        setItems([]);
        setCategories([]);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const stats = {
    total: items.length,
    active: items.filter((i) => i.is_active).length,
    needsReview: items.filter((i) => i.needs_pricing_review).length,
    withImages: items.filter((i) => i.image_url).length,
    categoriesCount: categories.length,
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "needs-review" && item.needs_pricing_review) ||
      (activeTab === "inactive" && !item.is_active);
    return matchesSearch && matchesCategory && matchesTab;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Price Book</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total.toLocaleString()} items across {stats.categoriesCount} categories
            <span className="ml-2 text-xs font-mono">Table #205</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Total Items</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2 text-green-600">
              {stats.active.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Categories</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.categoriesCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-indigo-600" />
              <span className="text-xs text-muted-foreground">With Images</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.withImages.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className={stats.needsReview > 0 ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Needs Review</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2 text-yellow-600">
              {stats.needsReview.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="all">All Items</TabsTrigger>
            <TabsTrigger value="needs-review">
              Needs Review
              {stats.needsReview > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats.needsReview}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.slice(0, 25).map((cat) => (
                  <SelectItem key={cat.category} value={cat.category}>
                    {cat.category} ({cat.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search code, name, brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[280px]"
              />
            </div>
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.slice(0, 100).map((item) => (
                  <TableRow key={item.id} className={!item.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {item.item_code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <div className="w-10 h-10 bg-secondary rounded flex items-center justify-center overflow-hidden">
                            <img
                              src={item.image_url}
                              alt={item.item_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-secondary rounded flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <Link
                            href={`/pricebook/${slugifyPricebookCode(item.item_code)}`}
                            target="_blank"
                            className="font-medium hover:underline hover:text-primary"
                          >
                            {item.item_name}
                          </Link>
                          {item.notes && (
                            <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400 text-xs">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.brand || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${Number(item.current_price || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.unit_of_measure}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {item.requires_photo && (
                          <Badge variant="outline" className="text-xs py-0">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            Photo
                          </Badge>
                        )}
                        {item.requires_spec && (
                          <Badge variant="outline" className="text-xs py-0">
                            <FileText className="h-3 w-3 mr-1" />
                            Spec
                          </Badge>
                        )}
                        {item.needs_pricing_review && (
                          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500 text-xs py-0">
                            Review
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <History className="h-4 w-4 mr-2" />
                            Price History
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <QrCode className="h-4 w-4 mr-2" />
                            Generate QR
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredItems.length > 100 && (
              <div className="p-4 text-center text-sm text-muted-foreground border-t">
                Showing 100 of {filteredItems.length.toLocaleString()} items. Use search to filter.
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

