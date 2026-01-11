 
"use client";

import { useMemo, ElementType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ============================================
// Types & Interfaces
// ============================================

type ColorVariant = "blue" | "green" | "amber" | "red" | "indigo" | "gray";

interface ProgressBarProps {
  value: number;
  max: number;
  color?: ColorVariant;
  showLabel?: boolean;
  height?: string;
}

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ElementType;
  trend?: number;
  color?: ColorVariant;
}

interface BarDataItem {
  [key: string]: string | number | undefined;
  color?: ColorVariant;
}

interface HorizontalBarChartProps {
  data: BarDataItem[];
  valueKey?: string;
  labelKey?: string;
  maxValue?: number;
}

interface TrendDataItem {
  [key: string]: string | number;
}

interface TrendChartProps {
  data: TrendDataItem[];
  height?: number;
  valueKey?: string;
  labelKey?: string;
}

interface ChartPoint {
  x: string;
  y: number;
  value: number;
  label: string;
}

interface ChartData {
  points: ChartPoint[];
  pathD: string;
  areaD: string;
  max: number;
  min: number;
}

interface DonutSegment {
  value: number;
  label: string;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}

interface DayData {
  label: string;
}

interface ResourceData {
  name: string;
  dailyUtilization: number[];
}

interface UtilizationHeatmapProps {
  resources: ResourceData[];
  days: DayData[];
}

interface CostRow {
  label: string;
  hours?: number;
  cost?: number;
}

interface CostBreakdownTableProps {
  data: CostRow[];
  title?: string;
}

// ============================================
// Color Maps
// ============================================

const bgColorClasses: Record<ColorVariant, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  indigo: "bg-indigo-500",
  gray: "bg-muted-foreground",
};

const statColorClasses: Record<ColorVariant, string> = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
  green: "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  red: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400",
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400",
  gray: "bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground",
};

// ============================================
// Progress Bar Component
// ============================================

export function ProgressBar({
  value,
  max,
  color = "blue",
  showLabel = true,
  height = "h-2",
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="w-full">
      <div className={`w-full rounded-full bg-muted ${height}`}>
        <div
          className={`${bgColorClasses[color]} ${height} rounded-full transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-muted-foreground">{percent.toFixed(0)}%</div>
      )}
    </div>
  );
}

// ============================================
// Circular Progress Ring
// ============================================

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 8,
  color = "#3b82f6",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold">{value.toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ============================================
// Stat Card Component
// ============================================

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "blue",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground/70">{subtitle}</p>}
          </div>
          {Icon && (
            <div className={`rounded-lg p-2 ${statColorClasses[color]}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        {trend !== undefined && (
          <div
            className={`mt-2 text-sm ${
              trend >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% from last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Horizontal Bar Chart
// ============================================

export function HorizontalBarChart({
  data,
  valueKey = "value",
  labelKey = "label",
  maxValue,
}: HorizontalBarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => Number(d[valueKey]) || 0));

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{item[labelKey]}</span>
            <span className="font-medium">{item[valueKey]}</span>
          </div>
          <ProgressBar
            value={Number(item[valueKey]) || 0}
            max={max}
            color={(item.color as ColorVariant) || "blue"}
            showLabel={false}
            height="h-3"
          />
        </div>
      ))}
    </div>
  );
}

// ============================================
// Weekly Trend Line Chart (SVG)
// ============================================

export function TrendChart({
  data,
  height = 200,
  valueKey = "value",
  labelKey = "label",
}: TrendChartProps) {
  const chartData = useMemo<ChartData | null>(() => {
    if (!data || data.length === 0) return null;

    const values = data.map((d) => Number(d[valueKey]) || 0);
    const max = Math.max(...values) || 1;
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const width = 100;
    const padding = 5;

    const points: ChartPoint[] = data.map((d, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
      const y = height - padding - ((Number(d[valueKey]) - min) / range) * (height - padding * 2);
      return {
        x: `${x}%`,
        y,
        value: Number(d[valueKey]),
        label: String(d[labelKey]),
      };
    });

    // Create path
    const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");

    // Create area path
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return { points, pathD, areaD, max, min };
  }, [data, height, valueKey, labelKey]);

  if (!chartData) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">No data</div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <svg width="100%" height={height} className="overflow-visible">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <line
            key={pct}
            x1="0%"
            x2="100%"
            y1={height - 5 - (pct / 100) * (height - 10)}
            y2={height - 5 - (pct / 100) * (height - 10)}
            stroke="currentColor"
            strokeDasharray="4"
            className="text-border"
          />
        ))}

        {/* Area fill */}
        <path d={chartData.areaD} fill="url(#trend-gradient)" opacity="0.2" />

        {/* Line */}
        <path
          d={chartData.pathD}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {chartData.points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="currentColor"
            stroke="#3b82f6"
            strokeWidth="2"
            className="text-background"
          />
        ))}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="trend-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* X-axis labels */}
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        {data.map((d, i) => (
          <span key={i}>{d[labelKey]}</span>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Donut Chart
// ============================================

export function DonutChart({ data, size = 150, strokeWidth = 20 }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  let currentOffset = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 transform">
          {data.map((segment, i) => {
            const segmentLength = (segment.value / total) * circumference;
            const offset = currentOffset;
             
            currentOffset += segmentLength;

            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-offset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-sm text-muted-foreground">{d.label}</span>
            <span className="text-sm font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Utilization Heatmap
// ============================================

export function UtilizationHeatmap({ resources, days }: UtilizationHeatmapProps) {
  const getColor = (utilization: number): string => {
    if (utilization === 0)
      return "bg-muted";
    if (utilization < 50)
      return "bg-green-200 dark:bg-green-900/50";
    if (utilization < 80)
      return "bg-green-400 dark:bg-green-700/70";
    if (utilization < 100)
      return "bg-amber-400 dark:bg-amber-600/70";
    return "bg-red-400 dark:bg-red-600/70";
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">Resource</TableHead>
            {days.map((day, i) => (
              <TableHead key={i} className="w-8 px-1 text-center text-xs">
                {day.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource, ri) => (
            <TableRow key={ri}>
              <TableCell className="text-sm">{resource.name}</TableCell>
              {resource.dailyUtilization.map((util, di) => (
                <TableCell key={di} className="px-1 py-1">
                  <div
                    className={`h-6 w-6 cursor-pointer rounded ${getColor(util)}`}
                    title={`${util}%`}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
        <span className="text-muted-foreground">Utilization:</span>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-muted" />
          <span>0%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-green-200 dark:bg-green-900/50" />
          <span>&lt;50%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-green-400 dark:bg-green-700/70" />
          <span>50-80%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-amber-400 dark:bg-amber-600/70" />
          <span>80-100%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-red-400 dark:bg-red-600/70" />
          <span>&gt;100%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Cost Breakdown Table
// ============================================

export function CostBreakdownTable({ data, title }: CostBreakdownTableProps) {
  const totalHours = data.reduce((sum, r) => sum + (r.hours || 0), 0);
  const totalCost = data.reduce((sum, r) => sum + (r.cost || 0), 0);

  return (
    <Card>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : ""}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{row.label}</TableCell>
                <TableCell className="text-right text-sm">
                  {row.hours?.toFixed(1) || "-"}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  ${row.cost?.toFixed(2) || "0.00"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="text-right font-medium">{totalHours.toFixed(1)}</TableCell>
              <TableCell className="text-right font-bold">${totalCost.toFixed(2)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

// Default export for backward compatibility
export default {
  ProgressBar,
  ProgressRing,
  StatCard,
  HorizontalBarChart,
  TrendChart,
  DonutChart,
  UtilizationHeatmap,
  CostBreakdownTable,
};
