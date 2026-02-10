"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BriefcaseIcon,
  DocumentTextIcon,
  TrophyIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { portalApi } from "@/lib/portal-api";

interface Construction {
  id: number;
  name: string;
  address?: string;
}

interface Job {
  id: number;
  po_number: string;
  is_arrived: boolean;
  construction: Construction;
}

interface Quote {
  id: number;
  title: string;
  days_waiting: number;
  construction: Construction;
}

interface KudosData {
  kudos_score: number;
  tier: string;
}

interface Stats {
  activeJobs: number;
  completedJobs: number;
}

export default function PortalDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<Quote[]>([]);
  const [kudosScore, setKudosScore] = useState<KudosData | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load dashboard data in parallel
      const [jobsRes, quotesRes, kudosRes] = await Promise.all([
        portalApi.get("/api/v1/portal/jobs"),
        portalApi.get("/api/v1/portal/quote_requests"),
        portalApi.get("/api/v1/portal/kudos"),
      ]);

      if (jobsRes.data.success) {
        setRecentJobs(jobsRes.data.data.in_progress.slice(0, 5));
        setStats({
          activeJobs: jobsRes.data.data.in_progress.length,
          completedJobs: jobsRes.data.data.completed.length,
        });
      }

      if (quotesRes.data.success) {
        setPendingQuotes(quotesRes.data.data.pending.slice(0, 5));
      }

      if (kudosRes.data.success) {
        setKudosScore(kudosRes.data.data);
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  const statCards = [
    {
      name: "Jobs",
      value: stats?.activeJobs || 0,
      icon: BriefcaseIcon,
      link: "/portal/jobs",
      color: "bg-blue-500",
    },
    {
      name: "Pending Quotes",
      value: pendingQuotes.length,
      icon: DocumentTextIcon,
      link: "/portal/quotes",
      color: "bg-yellow-500",
    },
    {
      name: "Kudos Score",
      value: kudosScore?.kudos_score?.toFixed(0) || 0,
      icon: TrophyIcon,
      link: "/portal/kudos",
      color: "bg-purple-500",
    },
    {
      name: "Completed Jobs",
      value: stats?.completedJobs || 0,
      icon: CheckCircleIcon,
      link: "/portal/jobs",
      color: "bg-green-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
          Welcome back! Here's what's happening with your jobs and quotes.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            href={stat.link}
            className="bg-card overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 ${stat.color} rounded-md p-3`}>
                  <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted-foreground dark:text-muted-foreground truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-2xl font-semibold text-foreground dark:text-white">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pending Quotes */}
      {pendingQuotes.length > 0 && (
        <div className="bg-card shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-border dark:border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground dark:text-white">
                Pending Quote Requests
              </h2>
              <Link
                href="/portal/quotes"
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
              >
                View all
              </Link>
            </div>
          </div>
          <ul role="list" className="divide-y divide-border dark:divide-border">
            {pendingQuotes.map((quote) => (
              <li key={quote.id} className="px-4 py-4 sm:px-6 hover:bg-muted dark:hover:bg-muted">
                <Link href={`/portal/quotes/${quote.id}`} className="block">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground dark:text-white truncate">
                        {quote.title}
                      </p>
                      <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                        {quote.construction.name}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                        Waiting {quote.days_waiting} days
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300">
                        Respond Now
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Jobs */}
      {recentJobs.length > 0 && (
        <div className="bg-card shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-border dark:border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground dark:text-white">Jobs</h2>
              <Link
                href="/portal/jobs"
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
              >
                View all
              </Link>
            </div>
          </div>
          <ul role="list" className="divide-y divide-border dark:divide-border">
            {recentJobs.map((job) => (
              <li key={job.id} className="px-4 py-4 sm:px-6 hover:bg-muted dark:hover:bg-muted">
                <Link href={`/portal/jobs/${job.id}`} className="block">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground dark:text-white truncate">
                        {job.construction.name}
                      </p>
                      <p className="text-sm text-muted-foreground dark:text-muted-foreground">PO: {job.po_number}</p>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                        {job.construction.address}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          job.is_arrived
                            ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300"
                            : "bg-muted dark:bg-muted text-foreground dark:text-muted-foreground"
                        }`}
                      >
                        {job.is_arrived ? "In Progress" : "Scheduled"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Kudos Summary */}
      {kudosScore && (
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrophyIcon className="h-12 w-12 text-white" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-purple-100 truncate">
                    Your Kudos Score
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-3xl font-semibold text-white">
                      {(kudosScore.kudos_score ?? 0).toFixed(0)}
                    </div>
                    <div className="ml-2 flex items-baseline text-sm font-semibold text-purple-100">
                      {kudosScore.tier}
                    </div>
                  </dd>
                </dl>
              </div>
              <div className="ml-5 flex-shrink-0">
                <Link
                  href="/portal/kudos"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-muted"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
