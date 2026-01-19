"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  BriefcaseIcon,
  ClockIcon,
  CheckCircleIcon,
  CalendarIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { Spinner } from "@/components/ui/spinner";

interface Construction {
  id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
}

interface Job {
  id: number;
  po_number: string;
  total?: number;
  is_arrived: boolean;
  is_completed: boolean;
  arrived_at?: string;
  completed_at?: string;
  days_on_site?: number;
  invoice_status: string;
  construction: Construction;
}

interface JobsData {
  upcoming: Job[];
  in_progress: Job[];
  completed: Job[];
}

type TabKey = keyof JobsData;

export default function PortalJobs() {
  const pathname = usePathname();
  const router = useRouter();

  // Path-based tab navigation
  const activeTabRaw = useMemo(() => {
    const parts = pathname.replace("/portal/jobs", "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname]);

  useEffect(() => {
    if (activeTabRaw === null) {
      router.replace("/portal/jobs/upcoming", { scroll: false });
    }
  }, [activeTabRaw, router]);

  const setActiveTab = useCallback((tab: string) => {
    router.push(`/portal/jobs/${tab}`, { scroll: false });
  }, [router]);

  const activeTab = (activeTabRaw || "upcoming") as TabKey;

  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobsData>({
    upcoming: [],
    in_progress: [],
    completed: [],
  });

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const token = localStorage.getItem("portal_token");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      const response = await axios.get("/api/v1/portal/jobs");

      if (response?.data.success) {
        setJobs(response.data.data);
      }
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    {
      key: "upcoming" as TabKey,
      name: "Upcoming",
      count: jobs.upcoming.length,
      icon: CalendarIcon,
      color: "blue",
    },
    {
      key: "in_progress" as TabKey,
      name: "In Progress",
      count: jobs.in_progress.length,
      icon: ClockIcon,
      color: "yellow",
    },
    {
      key: "completed" as TabKey,
      name: "Completed",
      count: jobs.completed.length,
      icon: CheckCircleIcon,
      color: "green",
    },
  ];

  const getStatusBadge = (job: Job) => {
    if (job.is_completed) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
          Completed
        </span>
      );
    }
    if (job.is_arrived) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300">
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
        Upcoming
      </span>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={48} />
      </div>
    );
  }

  const currentJobs = jobs[activeTab] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white">Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
          Track your active and completed jobs
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border dark:border-border">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  ${
                    isActive
                      ? "border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground hover:border-border dark:hover:border-border"
                  }
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  flex items-center gap-2
                `}
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
                <span
                  className={`
                  ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium
                  ${
                    isActive
                      ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
                      : "bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground"
                  }
                `}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Job List */}
      {currentJobs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg shadow">
          <BriefcaseIcon className="mx-auto h-12 w-12 text-muted-foreground dark:text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-foreground dark:text-white">
            No {activeTab.replace("_", " ")} jobs
          </h3>
          <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
            {activeTab === "upcoming"
              ? "You don't have any upcoming jobs scheduled."
              : `No jobs in ${activeTab.replace("_", " ")} status.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {currentJobs.map((job) => (
            <Link
              key={job.id}
              href={`/portal/jobs/${job.id}`}
              className="bg-card rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-foreground dark:text-white truncate">
                      {job.construction.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground truncate">
                      PO: {job.po_number}
                    </p>
                  </div>
                  {getStatusBadge(job)}
                </div>

                {/* Amount */}
                <div className="mt-4">
                  <div className="flex items-baseline">
                    <span className="text-2xl font-bold text-foreground dark:text-white">
                      ${job.total?.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Location */}
                <div className="mt-4 flex items-start text-sm text-muted-foreground dark:text-muted-foreground">
                  <MapPinIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
                  <div className="flex-1">
                    <p>{job.construction.address}</p>
                    <p>
                      {job.construction.city}, {job.construction.state}{" "}
                      {job.construction.postcode}
                    </p>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="mt-4 border-t border-border dark:border-border pt-4 space-y-2">
                  {job.arrived_at && (
                    <div className="flex items-center text-xs text-muted-foreground dark:text-muted-foreground">
                      <ClockIcon className="h-4 w-4 mr-1 text-muted-foreground dark:text-muted-foreground" />
                      Arrived: {formatDate(job.arrived_at)}
                    </div>
                  )}
                  {job.completed_at && (
                    <div className="flex items-center text-xs text-muted-foreground dark:text-muted-foreground">
                      <CheckCircleIcon className="h-4 w-4 mr-1 text-green-500 dark:text-green-400" />
                      Completed: {formatDate(job.completed_at)}
                    </div>
                  )}
                  {job.days_on_site !== null && job.days_on_site !== undefined && (
                    <div className="flex items-center text-xs text-muted-foreground dark:text-muted-foreground">
                      <CalendarIcon className="h-4 w-4 mr-1 text-muted-foreground dark:text-muted-foreground" />
                      Time on site: {job.days_on_site.toFixed(1)} days
                    </div>
                  )}
                </div>

                {/* Invoice Status */}
                {job.invoice_status !== "not_invoiced" && (
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        job.invoice_status === "paid"
                          ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300"
                          : job.invoice_status === "synced"
                          ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300"
                          : "bg-muted dark:bg-muted text-foreground dark:text-muted-foreground"
                      }`}
                    >
                      Invoice: {job.invoice_status}
                    </span>
                  </div>
                )}

                {/* Action needed for upcoming jobs */}
                {activeTab === "upcoming" && !job.is_arrived && (
                  <div className="mt-4 pt-4 border-t border-border dark:border-border">
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      → Mark arrival when on site
                    </span>
                  </div>
                )}

                {/* Action needed for in progress jobs */}
                {activeTab === "in_progress" && job.is_arrived && !job.is_completed && (
                  <div className="mt-4 pt-4 border-t border-border dark:border-border">
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      → Mark complete when finished
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
