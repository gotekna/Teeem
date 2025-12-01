"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  MoreHorizontal,
  FileText,
  Send,
  CheckCircle,
  Clock,
  DollarSign,
  ShoppingCart,
  Building2,
  Loader2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  Eye,
  Download,
  Printer,
  Package,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_name: string;
  job_title: string;
  job_id: number;
  total_amount: number;
  status: string;
  created_at: string;
  sent_at?: string;
  approved_at?: string;
  approved_by?: string;
  description?: string;
}

interface POStats {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  sent: number;
  total_value: number;
}

interface CategoryItem {
  id: string;
  name: string;
  count: number;
  type: "status" | "supplier" | "job";
  children?: CategoryItem[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    case "pending":
      return <Badge variant="secondary">Pending Approval</Badge>;
    case "approved":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
    case "sent":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Sent</Badge>;
    case "received":
      return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Received</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// Category Tree Component
interface CategoryTreeNodeProps {
  item: CategoryItem;
  level: number;
  selectedId: string | null;
  onSelect: (item: CategoryItem) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}

function CategoryTreeNode({
  item,
  level,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
}: CategoryTreeNodeProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedIds.has(item.id);
  const isSelected = selectedId === item.id;

  const getIcon = () => {
    if (item.type === "status") {
      switch (item.id) {
        case "status-draft": return <FileText className="h-4 w-4 text-muted-foreground" />;
        case "status-pending": return <Clock className="h-4 w-4 text-orange-500" />;
        case "status-approved": return <CheckCircle className="h-4 w-4 text-green-500" />;
        case "status-sent": return <Send className="h-4 w-4 text-blue-500" />;
        case "status-received": return <Package className="h-4 w-4 text-purple-500" />;
        default: return <ShoppingCart className="h-4 w-4 text-muted-foreground" />;
      }
    }
    if (item.type === "supplier") {
      return <Building2 className="h-4 w-4 text-muted-foreground" />;
    }
    if (isExpanded || isSelected) {
      return <FolderOpen className="h-4 w-4 text-blue-500" />;
    }
    return <Folder className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div>
      <button
        onClick={() => {
          onSelect(item);
          if (hasChildren) {
            onToggleExpand(item.id);
          }
        }}
        className={cn(
          "w-full flex items-center gap-2 py-1.5 px-2 text-sm transition-colors rounded-sm",
          "hover:bg-secondary/50",
          isSelected && "bg-secondary text-foreground font-medium"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        ) : (
          <span className="w-3.5" />
        )}

        {getIcon()}

        <span className="flex-1 truncate text-left">{item.name}</span>

        <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0 h-5 min-w-[24px] justify-center">
          {item.count}
        </Badge>
      </button>

      {hasChildren && isExpanded && (
        <div>
          {item.children!.map((child) => (
            <CategoryTreeNode
              key={child.id}
              item={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// PO Card Component
interface POCategoryCardProps {
  name: string;
  count: number;
  totalValue: number;
  icon: React.ReactNode;
  onClick?: () => void;
  color?: string;
}

function POCategoryCard({ name, count, totalValue, icon, onClick, color = "bg-gray-500" }: POCategoryCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center p-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
    >
      <div className="relative w-full aspect-[4/3] mb-3">
        <div className={cn("absolute inset-0 rounded-lg opacity-80", color)} />
        <div className={cn("absolute -top-2 left-3 w-8 h-3 rounded-t-md opacity-90", color)} />
        <div className={cn("absolute inset-0 top-1 rounded-lg shadow-sm", color)}>
          <div className="absolute top-2 left-3 right-3 bottom-4 flex flex-col gap-1">
            <div className="h-full bg-white dark:bg-gray-200 rounded-sm shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                {icon}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-sm">
          <span className="text-xs font-bold text-primary-foreground">{count}</span>
        </div>
      </div>
      <div className="text-center w-full">
        <p className="font-medium text-sm truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(totalValue)}</p>
      </div>
    </button>
  );
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([]);
  const [stats, setStats] = React.useState<POStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<CategoryItem | null>(null);
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set(["by-status"]));

  React.useEffect(() => {
    const fetchPurchaseOrders = async () => {
      const mockPurchaseOrders: PurchaseOrder[] = [
        { id: 1, po_number: "PO-2024-001", supplier_name: "Boral Timber", job_title: "Harrison Residence - Custom Home", job_id: 1, total_amount: 42850, status: "sent", created_at: "2024-10-15", description: "Framing timber package" },
        { id: 2, po_number: "PO-2024-002", supplier_name: "QLD Steel Supplies", job_title: "Harrison Residence - Custom Home", job_id: 1, total_amount: 28400, status: "received", created_at: "2024-10-10", description: "Steel lintels and connections" },
        { id: 3, po_number: "PO-2024-003", supplier_name: "Truecore Windows & Doors", job_title: "Harrison Residence - Custom Home", job_id: 1, total_amount: 67200, status: "approved", created_at: "2024-11-01", description: "Aluminium windows and bifold doors" },
        { id: 4, po_number: "PO-2024-004", supplier_name: "Hanson Concrete", job_title: "Coastal Views Duplex", job_id: 2, total_amount: 18900, status: "sent", created_at: "2024-10-28", description: "Slab concrete - 32MPa" },
        { id: 5, po_number: "PO-2024-005", supplier_name: "Reo Steel Fixers", job_title: "Coastal Views Duplex", job_id: 2, total_amount: 24500, status: "sent", created_at: "2024-10-25", description: "Reinforcement mesh and labour" },
        { id: 6, po_number: "PO-2024-006", supplier_name: "Gold Coast Formwork", job_title: "Coastal Views Duplex", job_id: 2, total_amount: 15200, status: "received", created_at: "2024-10-20", description: "Slab edge formwork hire" },
        { id: 7, po_number: "PO-2024-007", supplier_name: "Reece Plumbing", job_title: "Thompson Family Home - Renovation", job_id: 3, total_amount: 12450, status: "sent", created_at: "2024-11-05", description: "Bathroom fixtures" },
        { id: 8, po_number: "PO-2024-008", supplier_name: "Beacon Lighting", job_title: "Thompson Family Home - Renovation", job_id: 3, total_amount: 8900, status: "approved", created_at: "2024-11-08", description: "LED downlights and pendants" },
        { id: 9, po_number: "PO-2024-009", supplier_name: "Bunnings Trade", job_title: "Thompson Family Home - Renovation", job_id: 3, total_amount: 4250, status: "received", created_at: "2024-10-30", description: "Hardware and sundries" },
        { id: 10, po_number: "PO-2024-010", supplier_name: "CSR Bradford Insulation", job_title: "Greenfield Estate - Lot 45", job_id: 4, total_amount: 6800, status: "sent", created_at: "2024-11-10", description: "Wall and ceiling batts R4.0" },
        { id: 11, po_number: "PO-2024-011", supplier_name: "Brickworks Building Products", job_title: "Greenfield Estate - Lot 45", job_id: 4, total_amount: 19500, status: "received", created_at: "2024-09-15", description: "Face bricks - 12,000 units" },
        { id: 12, po_number: "PO-2024-012", supplier_name: "Stratco Roofing", job_title: "Greenfield Estate - Lot 45", job_id: 4, total_amount: 31200, status: "received", created_at: "2024-10-01", description: "Colorbond roofing and gutters" },
        { id: 13, po_number: "PO-2024-013", supplier_name: "BlueScope Steel", job_title: "Industrial Shed - BrisWest", job_id: 6, total_amount: 156000, status: "sent", created_at: "2024-10-20", description: "Portal frame steel structure" },
        { id: 14, po_number: "PO-2024-014", supplier_name: "Lysaght Building Solutions", job_title: "Industrial Shed - BrisWest", job_id: 6, total_amount: 42800, status: "approved", created_at: "2024-11-12", description: "Wall and roof sheeting" },
        { id: 15, po_number: "PO-2024-015", supplier_name: "Industrial Concrete QLD", job_title: "Industrial Shed - BrisWest", job_id: 6, total_amount: 38500, status: "received", created_at: "2024-10-10", description: "Industrial slab - 150mm thick" },
        { id: 16, po_number: "PO-2024-016", supplier_name: "Monier Roofing", job_title: "Waverly Heights - New Build", job_id: 8, total_amount: 24600, status: "sent", created_at: "2024-11-01", description: "Concrete roof tiles" },
        { id: 17, po_number: "PO-2024-017", supplier_name: "Fletcher Insulation", job_title: "Waverly Heights - New Build", job_id: 8, total_amount: 5400, status: "pending", created_at: "2024-11-14", description: "Roof blanket insulation R5.0" },
        { id: 18, po_number: "PO-2024-018", supplier_name: "James Hardie", job_title: "Waverly Heights - New Build", job_id: 8, total_amount: 18200, status: "approved", created_at: "2024-10-25", description: "HardiePlank cladding" },
        { id: 19, po_number: "PO-2024-019", supplier_name: "Clipsal Electrical", job_title: "Commercial Fit-out - Queen St", job_id: 9, total_amount: 34200, status: "sent", created_at: "2024-10-28", description: "Commercial electrical package" },
        { id: 20, po_number: "PO-2024-020", supplier_name: "USG Boral Plasterboard", job_title: "Commercial Fit-out - Queen St", job_id: 9, total_amount: 12800, status: "received", created_at: "2024-10-15", description: "Fire-rated plasterboard" },
        { id: 21, po_number: "PO-2024-021", supplier_name: "Rinnai Hot Water", job_title: "Commercial Fit-out - Queen St", job_id: 9, total_amount: 8900, status: "pending", created_at: "2024-11-15", description: "Commercial hot water system" },
        { id: 22, po_number: "PO-2024-022", supplier_name: "Austral Bricks", job_title: "Harrison Residence - Custom Home", job_id: 1, total_amount: 22400, status: "draft", created_at: "2024-11-18", description: "Face brickwork - feature walls" },
        { id: 23, po_number: "PO-2024-023", supplier_name: "QLD Scaffolding Hire", job_title: "Coastal Views Duplex", job_id: 2, total_amount: 8500, status: "draft", created_at: "2024-11-19", description: "Scaffold hire - 8 weeks" },
        { id: 24, po_number: "PO-2024-024", supplier_name: "Actrol HVAC", job_title: "Commercial Fit-out - Queen St", job_id: 9, total_amount: 45600, status: "draft", created_at: "2024-11-20", description: "Split system AC units x 6" },
      ];

      try {
        const data = await api.get<{ purchase_orders: PurchaseOrder[]; stats: POStats }>("/api/v1/purchase_orders");
        setPurchaseOrders(data.purchase_orders || []);
        setStats(data.stats || null);
      } catch {
        setPurchaseOrders(mockPurchaseOrders);
        const draft = mockPurchaseOrders.filter(po => po.status === "draft").length;
        const pending = mockPurchaseOrders.filter(po => po.status === "pending").length;
        const approved = mockPurchaseOrders.filter(po => po.status === "approved").length;
        const sent = mockPurchaseOrders.filter(po => po.status === "sent" || po.status === "received").length;
        const total_value = mockPurchaseOrders.reduce((sum, po) => sum + po.total_amount, 0);
        setStats({ total: mockPurchaseOrders.length, draft, pending, approved, sent, total_value });
      } finally {
        setLoading(false);
      }
    };
    fetchPurchaseOrders();
  }, []);

  const categories = React.useMemo((): CategoryItem[] => {
    const statusCounts: Record<string, number> = {};
    const supplierCounts: Record<string, number> = {};
    const jobCounts: Record<string, { count: number; id: number }> = {};

    purchaseOrders.forEach(po => {
      statusCounts[po.status] = (statusCounts[po.status] || 0) + 1;
      supplierCounts[po.supplier_name] = (supplierCounts[po.supplier_name] || 0) + 1;
      if (!jobCounts[po.job_title]) jobCounts[po.job_title] = { count: 0, id: po.job_id };
      jobCounts[po.job_title].count++;
    });

    return [
      {
        id: "by-status", name: "By Status", count: purchaseOrders.length, type: "status" as const,
        children: [
          { id: "status-draft", name: "Draft", count: statusCounts["draft"] || 0, type: "status" as const },
          { id: "status-pending", name: "Pending Approval", count: statusCounts["pending"] || 0, type: "status" as const },
          { id: "status-approved", name: "Approved", count: statusCounts["approved"] || 0, type: "status" as const },
          { id: "status-sent", name: "Sent", count: statusCounts["sent"] || 0, type: "status" as const },
          { id: "status-received", name: "Received", count: statusCounts["received"] || 0, type: "status" as const },
        ],
      },
      {
        id: "by-supplier", name: "By Supplier", count: Object.keys(supplierCounts).length, type: "supplier" as const,
        children: Object.entries(supplierCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({
          id: `supplier-${name}`, name, count, type: "supplier" as const,
        })),
      },
      {
        id: "by-job", name: "By Job", count: Object.keys(jobCounts).length, type: "job" as const,
        children: Object.entries(jobCounts).sort((a, b) => b[1].count - a[1].count).map(([name, data]) => ({
          id: `job-${data.id}`, name, count: data.count, type: "job" as const,
        })),
      },
    ];
  }, [purchaseOrders]);

  const statusCards = React.useMemo(() => {
    const statusData: Record<string, { count: number; value: number; color: string; icon: React.ReactNode }> = {
      draft: { count: 0, value: 0, color: "bg-gray-500", icon: <FileText className="h-6 w-6 text-gray-500" /> },
      pending: { count: 0, value: 0, color: "bg-orange-500", icon: <Clock className="h-6 w-6 text-orange-500" /> },
      approved: { count: 0, value: 0, color: "bg-green-500", icon: <CheckCircle className="h-6 w-6 text-green-500" /> },
      sent: { count: 0, value: 0, color: "bg-blue-500", icon: <Send className="h-6 w-6 text-blue-500" /> },
      received: { count: 0, value: 0, color: "bg-purple-500", icon: <Package className="h-6 w-6 text-purple-500" /> },
    };
    purchaseOrders.forEach(po => {
      if (statusData[po.status]) {
        statusData[po.status].count++;
        statusData[po.status].value += po.total_amount;
      }
    });
    return statusData;
  }, [purchaseOrders]);

  const handleToggleExpand = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredPOs = React.useMemo(() => {
    let filtered = purchaseOrders;
    if (selectedCategory) {
      if (selectedCategory.id.startsWith("status-")) {
        const status = selectedCategory.id.replace("status-", "");
        filtered = filtered.filter(po => po.status === status);
      } else if (selectedCategory.id.startsWith("supplier-")) {
        filtered = filtered.filter(po => po.supplier_name === selectedCategory.name);
      } else if (selectedCategory.id.startsWith("job-")) {
        const jobId = parseInt(selectedCategory.id.replace("job-", ""));
        filtered = filtered.filter(po => po.job_id === jobId);
      }
    }
    if (searchQuery) {
      filtered = filtered.filter(po =>
        po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [purchaseOrders, selectedCategory, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Purchase Orders</h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link href="/purchase-orders/new"><Plus className="h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search POs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-0.5">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "w-full flex items-center gap-2 py-1.5 px-2 text-sm transition-colors rounded-sm hover:bg-secondary/50",
                  !selectedCategory && "bg-secondary text-foreground font-medium"
                )}
              >
                <span className="w-3.5" />
                <ShoppingCart className="h-4 w-4 text-blue-500" />
                <span className="flex-1 text-left">All Purchase Orders</span>
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 min-w-[24px] justify-center">{purchaseOrders.length}</Badge>
              </button>

              {categories.map((category) => (
                <CategoryTreeNode
                  key={category.id}
                  item={category}
                  level={0}
                  selectedId={selectedCategory?.id ?? null}
                  onSelect={setSelectedCategory}
                  expandedIds={expandedCategories}
                  onToggleExpand={handleToggleExpand}
                />
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-border">
            <div className="text-xs text-muted-foreground mb-1">Total Value</div>
            <div className="text-lg font-bold">{formatCurrency(stats?.total_value || 0)}</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between bg-background">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 gap-1 text-base font-semibold font-serif">
                  {selectedCategory?.name || "All Purchase Orders"}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setSelectedCategory(null)}>All Purchase Orders</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedCategory({ id: "status-draft", name: "Draft", count: 0, type: "status" })}>Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedCategory({ id: "status-pending", name: "Pending", count: 0, type: "status" })}>Pending Approval</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedCategory({ id: "status-approved", name: "Approved", count: 0, type: "status" })}>Approved</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedCategory({ id: "status-sent", name: "Sent", count: 0, type: "status" })}>Sent</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" asChild>
              <Link href="/purchase-orders/new"><Plus className="h-4 w-4 mr-2" />Create PO</Link>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {!selectedCategory && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-4">By Status</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {Object.entries(statusCards).map(([status, data]) => (
                    <POCategoryCard
                      key={status}
                      name={status.charAt(0).toUpperCase() + status.slice(1)}
                      count={data.count}
                      totalValue={data.value}
                      icon={data.icon}
                      color={data.color}
                      onClick={() => setSelectedCategory({ id: `status-${status}`, name: status.charAt(0).toUpperCase() + status.slice(1), count: data.count, type: "status" })}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                {selectedCategory ? `${filteredPOs.length} Purchase Orders` : "Recent Purchase Orders"}
              </h3>
              {filteredPOs.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>PO Number</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPOs.map((po) => (
                        <TableRow key={po.id} className="cursor-pointer" onClick={() => router.push(`/jobs/${po.job_id}?tab=purchase-orders`)}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <ShoppingCart className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <span className="font-medium text-sm">{po.po_number}</span>
                                {po.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{po.description}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${getAvatarColor(po.supplier_name)}`}>
                                {getInitials(po.supplier_name)}
                              </div>
                              <span className="text-sm">{po.supplier_name}</span>
                            </div>
                          </TableCell>
                          <TableCell><span className="text-sm text-muted-foreground">{po.job_title}</span></TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(po.total_amount)}</TableCell>
                          <TableCell>{getStatusBadge(po.status)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                                <DropdownMenuItem><Download className="h-4 w-4 mr-2" />Download PDF</DropdownMenuItem>
                                <DropdownMenuItem><Printer className="h-4 w-4 mr-2" />Print</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {po.status === "draft" && <DropdownMenuItem><Send className="h-4 w-4 mr-2" />Submit for Approval</DropdownMenuItem>}
                                {po.status === "pending" && <DropdownMenuItem><CheckCircle className="h-4 w-4 mr-2" />Approve</DropdownMenuItem>}
                                {po.status === "approved" && <DropdownMenuItem><Send className="h-4 w-4 mr-2" />Send to Supplier</DropdownMenuItem>}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-lg p-12 text-center">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? "No purchase orders match your search" : selectedCategory ? "No purchase orders in this category" : "No purchase orders yet"}
                  </p>
                  <Button asChild><Link href="/purchase-orders/new"><Plus className="h-4 w-4 mr-2" />Create First PO</Link></Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
