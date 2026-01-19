"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
  RefreshCw,
  HardHat,
  FileCheck,
  GitBranch,
  Wrench,
  CheckCircle,
  Clock,
  Building2,
  Briefcase,
  DollarSign,
  Send,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";

interface LienWaiver {
  id: number;
  job_id: number;
  job: { id: number; name: string };
  contact_id: number;
  contact: { id: number; name: string };
  waiver_type: string;
  through_amount: number;
  through_date: string;
  waiver_date: string;
  status: string;
  received_from: string | null;
  document_id: number | null;
  approved_at: string | null;
  created_at: string;
}

interface ChangeOrder {
  id: number;
  job_id: number;
  job: { id: number; name: string };
  contact_id: number | null;
  title: string;
  description: string | null;
  reason: string | null;
  contract_amount_change: number;
  cost_change: number;
  schedule_days_change: number;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

interface Equipment {
  id: number;
  equipment_number: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  ownership_type: string;
  hourly_rate: number;
  daily_rate: number;
  current_value: number;
  created_at: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ConstructionTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("lien-waivers");
  const [lienWaivers, setLienWaivers] = useState<LienWaiver[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);

      const [waiversRes, ordersRes, equipmentRes] = await Promise.all([
        api.get<{ success: boolean; data: LienWaiver[] }>(`/api/v1/gl/construction/lien_waivers?${params}`),
        api.get<{ success: boolean; data: ChangeOrder[] }>(`/api/v1/gl/construction/change_orders?${params}`),
        api.get<{ success: boolean; data: Equipment[] }>("/api/v1/gl/construction/equipment"),
      ]);

      if (waiversRes?.success) setLienWaivers(waiversRes.data || []);
      if (ordersRes?.success) setChangeOrders(ordersRes.data || []);
      if (equipmentRes?.success) setEquipment(equipmentRes.data || []);
    } catch (error) {
      console.error("Failed to fetch construction data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleReceiveWaiver = async (waiver: LienWaiver) => {
    try {
      await api.post(`/api/v1/gl/construction/lien_waivers/${waiver.id}/receive`);
      fetchData();
    } catch (error) {
      console.error("Failed to mark waiver received:", error);
    }
  };

  const handleApproveWaiver = async (waiver: LienWaiver) => {
    try {
      await api.post(`/api/v1/gl/construction/lien_waivers/${waiver.id}/approve`);
      fetchData();
    } catch (error) {
      console.error("Failed to approve waiver:", error);
    }
  };

  const handleSubmitOrder = async (order: ChangeOrder) => {
    try {
      await api.post(`/api/v1/gl/construction/change_orders/${order.id}/submit`);
      fetchData();
    } catch (error) {
      console.error("Failed to submit change order:", error);
    }
  };

  const handleApproveOrder = async (order: ChangeOrder) => {
    try {
      await api.post(`/api/v1/gl/construction/change_orders/${order.id}/approve`);
      fetchData();
    } catch (error) {
      console.error("Failed to approve change order:", error);
    }
  };

  const getWaiverStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Requested</Badge>;
      case "received":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><FileCheck className="h-3 w-3 mr-1" />Received</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      case "submitted":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Send className="h-3 w-3 mr-1" />Submitted</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const pendingWaivers = lienWaivers.filter((w) => w.status === "requested");
  const totalChangeOrderValue = changeOrders.filter((o) => o.status === "approved").reduce((sum, o) => sum + o.contract_amount_change, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Pending Waivers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingWaivers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">awaiting receipt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Change Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{changeOrders.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {changeOrders.filter((o) => o.status === "submitted").length} pending approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Approved Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalChangeOrderValue >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(totalChangeOrderValue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">contract adjustments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Equipment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipment.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {equipment.filter((e) => e.status === "active").length} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="lien-waivers" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Lien Waivers
            </TabsTrigger>
            <TabsTrigger value="change-orders" className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Change Orders
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Equipment
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Lien Waivers */}
        <TabsContent value="lien-waivers">
          <Card>
            <CardHeader>
              <CardTitle>Lien Waivers</CardTitle>
            </CardHeader>
            <CardContent>
              {lienWaivers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No lien waivers found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Subcontractor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Through Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lienWaivers.map((waiver) => (
                      <TableRow key={waiver.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            {waiver.job?.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {waiver.contact?.name}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{waiver.waiver_type}</TableCell>
                        <TableCell>{formatDate(waiver.through_date)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(waiver.through_amount)}
                        </TableCell>
                        <TableCell className="text-center">{getWaiverStatusBadge(waiver.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {waiver.status === "requested" && (
                              <Button size="sm" variant="outline" onClick={() => handleReceiveWaiver(waiver)}>
                                <FileCheck className="h-4 w-4 mr-1" />
                                Received
                              </Button>
                            )}
                            {waiver.status === "received" && (
                              <Button size="sm" onClick={() => handleApproveWaiver(waiver)}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            )}
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

        {/* Change Orders */}
        <TabsContent value="change-orders">
          <Card>
            <CardHeader>
              <CardTitle>Change Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {changeOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No change orders found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Contract Change</TableHead>
                      <TableHead className="text-right">Schedule</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changeOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            {order.job?.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{order.reason || "-"}</TableCell>
                        <TableCell className="text-right">
                          <span className={order.contract_amount_change >= 0 ? "text-green-600" : "text-red-600"}>
                            {order.contract_amount_change >= 0 ? "+" : ""}{formatCurrency(order.contract_amount_change)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {order.schedule_days_change !== 0 && (
                            <span className={order.schedule_days_change > 0 ? "text-orange-600" : "text-green-600"}>
                              {order.schedule_days_change > 0 ? "+" : ""}{order.schedule_days_change} days
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{getOrderStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {order.status === "draft" && (
                              <Button size="sm" variant="outline" onClick={() => handleSubmitOrder(order)}>
                                <Send className="h-4 w-4 mr-1" />
                                Submit
                              </Button>
                            )}
                            {order.status === "submitted" && (
                              <Button size="sm" onClick={() => handleApproveOrder(order)}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            )}
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

        {/* Equipment */}
        <TabsContent value="equipment">
          <Card>
            <CardHeader>
              <CardTitle>Equipment</CardTitle>
            </CardHeader>
            <CardContent>
              {equipment.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No equipment found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Ownership</TableHead>
                      <TableHead className="text-right">Hourly Rate</TableHead>
                      <TableHead className="text-right">Daily Rate</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.equipment_number}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="capitalize">{item.category}</TableCell>
                        <TableCell className="capitalize">{item.ownership_type}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.hourly_rate)}/hr</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.daily_rate)}/day</TableCell>
                        <TableCell className="text-center">
                          <Badge className={item.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""} variant={item.status === "active" ? "default" : "secondary"}>
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
