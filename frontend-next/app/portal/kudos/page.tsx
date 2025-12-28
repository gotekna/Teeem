"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  TrophyIcon,
  ChartBarIcon,
  ClockIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  StarIcon,
} from "@heroicons/react/24/outline";

interface KudosStatistics {
  total_jobs_completed: number;
  on_time_arrivals: number;
  on_time_completions: number;
  fast_quote_responses: number;
}

interface KudosBreakdown {
  [eventType: string]: {
    points_per_event: number;
    event_count: number;
    total_points: number;
  };
}

interface KudosEvent {
  id: number;
  event_type: string;
  points: number;
  created_at: string;
  description?: string;
}

interface KudosData {
  kudos_score: number;
  tier: string;
  tier_progress: number;
  next_tier?: string;
  points_to_next_tier?: number;
  statistics: KudosStatistics;
  breakdown: KudosBreakdown;
  recent_events: KudosEvent[];
}

const TIER_INFO = {
  bronze: {
    name: "Bronze",
    color: "from-orange-400 to-orange-600",
    icon: ">I",
    min: 0,
    max: 200,
  },
  silver: {
    name: "Silver",
    color: "from-gray-300 to-gray-500",
    icon: ">H",
    min: 200,
    max: 400,
  },
  gold: {
    name: "Gold",
    color: "from-yellow-400 to-yellow-600",
    icon: ">G",
    min: 400,
    max: 600,
  },
  platinum: {
    name: "Platinum",
    color: "from-blue-400 to-blue-600",
    icon: "=",
    min: 600,
    max: 800,
  },
  diamond: {
    name: "Diamond",
    color: "from-purple-400 to-purple-600",
    icon: "=",
    min: 800,
    max: 1000,
  },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  job_completed: "Job Completed",
  on_time_arrival: "On-Time Arrival",
  on_time_completion: "On-Time Completion",
  fast_quote_response: "Fast Quote Response",
  payment_received: "Payment Received",
  customer_rating: "Customer Rating",
};

export default function PortalKudos() {
  const [kudosData, setKudosData] = useState<KudosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadKudosData();
  }, []);

  const loadKudosData = async () => {
    try {
      const token = localStorage.getItem("portal_token");
      if (!token) {
        window.location.href = "/portal/login";
        return;
      }

      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const response = await axios.get("/api/v1/portal/kudos");

      if (response?.data.success) {
        setKudosData(response.data.data);
      } else {
        setError(response.data.error || "Failed to load kudos data");
      }
    } catch (err: any) {
      console.error("Failed to load kudos data:", err);
      setError(err.response?.data?.error || "Failed to load kudos data");
    } finally {
      setLoading(false);
    }
  };

  const getTierInfo = (tier: string) => {
    return TIER_INFO[tier as keyof typeof TIER_INFO] || TIER_INFO.bronze;
  };

  const formatEventType = (eventType: string): string => {
    return EVENT_TYPE_LABELS[eventType] || eventType.replace(/_/g, " ");
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString("en-AU", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !kudosData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">{error || "Failed to load kudos data"}</p>
      </div>
    );
  }

  const tierInfo = getTierInfo(kudosData.tier);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kudos Score</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your performance and earn points for great work
        </p>
      </div>

      {/* Main Score Card */}
      <div
        className={`bg-gradient-to-br ${tierInfo.color} rounded-lg shadow-xl p-8 text-center`}
      >
        <div className="text-6xl mb-4">{tierInfo.icon}</div>
        <div className="text-2xl font-medium text-white mb-2">
          {tierInfo.name} Tier
        </div>
        <div className="flex items-baseline justify-center gap-2 mb-6">
          <span className="text-5xl font-bold text-white">
            {(kudosData.kudos_score ?? 0).toFixed(0)}
          </span>
          <span className="text-xl text-white/80">/ 1000</span>
        </div>

        {/* Progress to Next Tier */}
        {kudosData.next_tier && (
          <div className="max-w-md mx-auto">
            <div className="flex justify-between text-sm text-white/90 mb-2">
              <span>Current: {tierInfo.name}</span>
              <span>
                Next:{" "}
                {
                  TIER_INFO[kudosData.next_tier as keyof typeof TIER_INFO]
                    ?.name
                }
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="bg-white rounded-full h-3 transition-all duration-500"
                style={{ width: `${kudosData.tier_progress}%` }}
              />
            </div>
            <p className="text-sm text-white/80 mt-2">
              {kudosData.points_to_next_tier} points until{" "}
              {TIER_INFO[kudosData.next_tier as keyof typeof TIER_INFO]?.name}
            </p>
          </div>
        )}
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Jobs Completed
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {kudosData.statistics.total_jobs_completed}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                On-Time Arrivals
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {kudosData.statistics.on_time_arrivals}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <ClockIcon className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                On-Time Completions
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {kudosData.statistics.on_time_completions}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <TrophyIcon className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Fast Quote Responses
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {kudosData.statistics.fast_quote_responses}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <RocketLaunchIcon className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Points Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Points Breakdown
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            How you've earned your kudos points
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points/Event
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Count
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Points
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(kudosData.breakdown).map(
                ([eventType, data]) => (
                  <tr key={eventType}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatEventType(eventType)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {data.points_per_event}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {data.event_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                      {data.total_points}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Events</h3>
          <p className="mt-1 text-sm text-gray-500">
            Your latest kudos-earning activities
          </p>
        </div>
        <div className="px-6 py-4">
          {kudosData.recent_events.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No recent events yet. Complete jobs to start earning kudos!
            </p>
          ) : (
            <div className="flow-root">
              <ul className="-mb-8">
                {kudosData.recent_events.map((event, eventIdx) => (
                  <li key={event.id}>
                    <div className="relative pb-8">
                      {eventIdx !== kudosData.recent_events.length - 1 && (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center ring-8 ring-white">
                            <StarIcon className="h-5 w-5 text-indigo-600" />
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div>
                            <p className="text-sm text-gray-900">
                              {formatEventType(event.event_type)}
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                +{event.points} points
                              </span>
                            </p>
                            {event.description && (
                              <p className="mt-1 text-sm text-gray-500">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <div className="whitespace-nowrap text-right text-sm text-gray-500">
                            <time dateTime={event.created_at}>
                              {formatDate(event.created_at)}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Tier Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <ChartBarIcon className="h-6 w-6 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              About Kudos Tiers
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p className="mb-2">
                Earn points by completing jobs on time, responding quickly to
                quotes, and delivering great service. Your tier unlocks special
                benefits:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>Bronze (0-199):</strong> Standard service
                </li>
                <li>
                  <strong>Silver (200-399):</strong> Priority support
                </li>
                <li>
                  <strong>Gold (400-599):</strong> Featured listings
                </li>
                <li>
                  <strong>Platinum (600-799):</strong> Premium tools
                </li>
                <li>
                  <strong>Diamond (800-1000):</strong> VIP status &amp; rewards
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
