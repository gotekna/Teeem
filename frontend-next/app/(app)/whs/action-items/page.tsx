"use client";

import { useState, useEffect } from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { PlusIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

// Types
interface ActionItem {
  id: number;
  title: string;
  action_type: string;
  priority: string;
  status: string;
  due_date?: string;
  days_until_due?: number;
  created_at: string;
  assigned_to_user?: { name: string };
  actionable?: { source_description: string };
}

interface TransformedActionItem {
  id: number;
  title: string;
  action_type: string;
  priority: string;
  status: string;
  source_description: string;
  assigned_to_name: string;
  due_date: string;
  days_until_due: string | number;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-status-error text-status-error-foreground dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-status-warning text-status-warning-foreground dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-status-warning text-status-warning-foreground dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-status-error text-status-error-foreground dark:bg-red-900/30 dark:text-red-400",
};

export default function WhsActionItemsPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [data, setData] = useState<TransformedActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActionItems();
  }, []);

  const fetchActionItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ data: { success: boolean; data: ActionItem[]; error?: string } }>(
        "/api/v1/whs_action_items"
      );

      if (response?.data?.success) {
        const transformedData = response.data.data.map((item) => ({
          id: item.id,
          title: item.title,
          action_type: item.action_type,
          priority: item.priority,
          status: item.status,
          source_description: item.actionable?.source_description || "N/A",
          assigned_to_name: item.assigned_to_user?.name || "Unassigned",
          due_date: item.due_date || "No deadline",
          days_until_due: item.days_until_due !== null && item.days_until_due !== undefined ? item.days_until_due : "N/A",
          created_at: item.created_at,
        }));
        setData(transformedData);
      } else {
        setError(response?.data?.error || "Failed to load action items");
      }
    } catch (err) {
      console.error("Error fetching action items:", err);
      setError("Failed to load action items");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: TransformedActionItem) => {
    if (!(await confirm(`Delete action item "${item.title}"?`))) return;

    try {
      const response = await api.delete<{ data: { success: boolean; error?: string } }>(
        `/api/v1/whs_action_items/${item.id}`
      );
      if (response?.data?.success) {
        setData((prevData) => prevData.filter((i) => i.id !== item.id));
        toast({ title: "Action item deleted" });
      } else {
        toast({
          title: "Error",
          description: response?.data?.error || "Failed to delete action item",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete action item",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === "No deadline") return dateString;
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatActionType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Spinner size={32} className="mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading action items...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CheckCircleIcon className="h-7 w-7 text-green-500 dark:text-green-400" />
            WHS Action Items
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track corrective actions from inspections, incidents, and hazard assessments.
          </p>
        </div>
        <Button
          onClick={() =>
            toast({ title: "Coming soon", description: "Create action item will be available soon" })
          }
        >
          <PlusIcon className="mr-2 h-5 w-5" />
          Create Action Item
        </Button>
      </div>

      {data.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          No action items found
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Days Remaining</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[300px] truncate font-medium">
                    {item.title}
                  </TableCell>
                  <TableCell>{formatActionType(item.action_type)}</TableCell>
                  <TableCell>
                    <Badge className={PRIORITY_COLORS[item.priority] || ""}>
                      {item.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[item.status] || ""}>
                      {(item.status || 'pending').replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.assigned_to_name}</TableCell>
                  <TableCell>{formatDate(item.due_date)}</TableCell>
                  <TableCell>
                    {typeof item.days_until_due === "number" ? (
                      <span
                        className={
                          item.days_until_due < 0
                            ? "font-medium text-red-600 dark:text-red-400"
                            : item.days_until_due <= 3
                            ? "font-medium text-amber-600"
                            : ""
                        }
                      >
                        {item.days_until_due < 0
                          ? `${Math.abs(item.days_until_due)} days overdue`
                          : `${item.days_until_due} days`}
                      </span>
                    ) : (
                      item.days_until_due
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item)}
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
