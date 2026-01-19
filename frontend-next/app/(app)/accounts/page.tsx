"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BanknotesIcon,
  CreditCardIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";

// Types
interface Stats {
  totalPayables: number;
  paidAmount: number;
  unpaidAmount: number;
  overdueAmount: number;
}

interface Payment {
  id: number;
  amount: number;
  supplier_name?: string;
  payment_date: string;
}

interface PurchaseOrder {
  total: string;
  status: string;
  required_date?: string;
}

export default function AccountsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalPayables: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    overdueAmount: 0,
  });
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);

  useEffect(() => {
    loadAccountsData();
  }, []);

  const loadAccountsData = async () => {
    try {
      setLoading(true);
      const poResponse = await api.get<PurchaseOrder[]>("/api/v1/purchase_orders");

      if (poResponse && Array.isArray(poResponse)) {
        const totalPayables = poResponse.reduce(
          (sum, po) => sum + (parseFloat(po.total) || 0),
          0
        );
        const paidAmount = poResponse
          .filter((po) => po.status === "paid")
          .reduce((sum, po) => sum + (parseFloat(po.total) || 0), 0);
        const unpaidAmount = totalPayables - paidAmount;

        const today = new Date();
        const overdueAmount = poResponse
          .filter((po) => {
            if (po.status === "paid" || po.status === "cancelled") return false;
            if (!po.required_date) return false;
            const requiredDate = new Date(po.required_date);
            return requiredDate < today;
          })
          .reduce((sum, po) => sum + (parseFloat(po.total) || 0), 0);

        setStats({
          totalPayables,
          paidAmount,
          unpaidAmount,
          overdueAmount,
        });
      }

      setRecentPayments([]);
    } catch (err) {
      console.error("Failed to load accounts data:", err);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      name: "Total Payables",
      value: formatCurrency(stats.totalPayables),
      icon: BanknotesIcon,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-500/10",
      description: "Total amount in purchase orders",
    },
    {
      name: "Paid",
      value: formatCurrency(stats.paidAmount),
      icon: CheckCircleIcon,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-500/10",
      description: "Successfully paid purchase orders",
    },
    {
      name: "Unpaid",
      value: formatCurrency(stats.unpaidAmount),
      icon: ClockIcon,
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-50 dark:bg-yellow-500/10",
      description: "Outstanding payments due",
    },
    {
      name: "Overdue",
      value: formatCurrency(stats.overdueAmount),
      icon: ArrowTrendingDownIcon,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-500/10",
      description: "Past due date payments",
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Accounts</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Overview of your accounts payable, payment status, and financial summary.
          </p>
        </div>
        <Link href="/xero/sync">
          <Button>Xero Integration</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="relative overflow-hidden pb-12 pt-5">
              <dt>
                <div className={`absolute rounded-md p-3 ${stat.bgColor}`}>
                  <stat.icon aria-hidden="true" className={`h-6 w-6 ${stat.color}`} />
                </div>
                <p className="ml-16 truncate text-sm font-medium text-muted-foreground">
                  {stat.name}
                </p>
              </dt>
              <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
                <p className="text-2xl font-semibold">{stat.value}</p>
              </dd>
              <div className="absolute inset-x-0 bottom-0 bg-muted/50 px-4 py-4 sm:px-6">
                <div className="text-sm">
                  <p className="text-muted-foreground">{stat.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-medium">Quick Links</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/purchase-orders">
            <Card className="transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 p-6">
                <CreditCardIcon className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="font-medium">Purchase Orders</p>
                  <p className="text-sm text-muted-foreground">View all purchase orders</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/contacts">
            <Card className="transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 p-6">
                <BanknotesIcon className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="font-medium">Suppliers</p>
                  <p className="text-sm text-muted-foreground">Manage supplier accounts</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/xero/sync">
            <Card className="transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 p-6">
                <ArrowTrendingUpIcon className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="font-medium">Xero Sync</p>
                  <p className="text-sm text-muted-foreground">Sync with Xero accounting</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Recent Payments */}
      <div>
        <h2 className="mb-4 text-lg font-medium">Recent Payments</h2>
        <Card>
          {recentPayments.length === 0 ? (
            <CardContent className="py-12 text-center">
              <BanknotesIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No recent payments</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Payment history will appear here as you record payments on purchase orders.
              </p>
              <div className="mt-6">
                <Link href="/purchase-orders">
                  <Button>View Purchase Orders</Button>
                </Link>
              </div>
            </CardContent>
          ) : (
            <ul className="divide-y">
              {recentPayments.map((payment) => (
                <li key={payment.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-primary">
                      {formatCurrency(payment.amount)}
                    </p>
                    <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800 dark:bg-green-500/10 dark:text-green-400">
                      Paid
                    </span>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {payment.supplier_name || "Unknown Supplier"}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatDate(payment.payment_date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
