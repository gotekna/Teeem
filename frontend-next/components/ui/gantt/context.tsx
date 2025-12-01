"use client";

import * as React from "react";
import { atom, useAtom, createStore, Provider } from "jotai";
import {
  startOfDay,
  endOfDay,
  addDays,
  addMonths,
  addQuarters,
  differenceInDays,
  differenceInMonths,
  differenceInQuarters,
  startOfMonth,
  startOfQuarter,
} from "date-fns";
import type { GanttRange, GanttFeature, GanttMarker, GanttGroup } from "./types";

// Atoms for global state
const rangeAtom = atom<GanttRange>("monthly");
const zoomAtom = atom<number>(1);
const scrollLeftAtom = atom<number>(0);
const scrollTopAtom = atom<number>(0);

// Context for Gantt configuration
type GanttContextValue = {
  range: GanttRange;
  setRange: (range: GanttRange) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  scrollLeft: number;
  setScrollLeft: (left: number) => void;
  scrollTop: number;
  setScrollTop: (top: number) => void;
  timelineStart: Date;
  timelineEnd: Date;
  features: GanttFeature[];
  groups: GanttGroup[];
  markers: GanttMarker[];
  getDatePosition: (date: Date) => number;
  getDateFromPosition: (position: number) => Date;
  columnWidth: number;
  sidebarWidth: number;
  rowHeight: number;
};

const GanttContext = React.createContext<GanttContextValue | null>(null);

export function useGantt() {
  const context = React.useContext(GanttContext);
  if (!context) {
    throw new Error("useGantt must be used within a GanttProvider");
  }
  return context;
}

type GanttProviderProps = {
  children: React.ReactNode;
  features?: GanttFeature[];
  groups?: GanttGroup[];
  markers?: GanttMarker[];
  defaultRange?: GanttRange;
  timelineStart?: Date;
  timelineEnd?: Date;
  sidebarWidth?: number;
  rowHeight?: number;
};

export function GanttProvider({
  children,
  features = [],
  groups = [],
  markers = [],
  defaultRange = "monthly",
  timelineStart: providedStart,
  timelineEnd: providedEnd,
  sidebarWidth = 240,
  rowHeight = 40,
}: GanttProviderProps) {
  const store = React.useMemo(() => createStore(), []);
  const [range, setRange] = useAtom(rangeAtom, { store });
  const [zoom, setZoom] = useAtom(zoomAtom, { store });
  const [scrollLeft, setScrollLeft] = useAtom(scrollLeftAtom, { store });
  const [scrollTop, setScrollTop] = useAtom(scrollTopAtom, { store });

  // Set default range on mount
  React.useEffect(() => {
    setRange(defaultRange);
  }, [defaultRange, setRange]);

  // Calculate timeline bounds from features if not provided
  const { timelineStart, timelineEnd } = React.useMemo(() => {
    const allFeatures = [...features, ...groups.flatMap((g) => g.features)];

    if (allFeatures.length === 0) {
      const now = new Date();
      return {
        timelineStart: providedStart ?? startOfMonth(addMonths(now, -1)),
        timelineEnd: providedEnd ?? endOfDay(addMonths(now, 2)),
      };
    }

    const minDate = allFeatures.reduce(
      (min, f) => (f.startAt < min ? f.startAt : min),
      allFeatures[0].startAt
    );
    const maxDate = allFeatures.reduce(
      (max, f) => (f.endAt > max ? f.endAt : max),
      allFeatures[0].endAt
    );

    // Add padding based on range
    const padding = range === "daily" ? 7 : range === "monthly" ? 30 : 90;

    return {
      timelineStart: providedStart ?? startOfDay(addDays(minDate, -padding)),
      timelineEnd: providedEnd ?? endOfDay(addDays(maxDate, padding)),
    };
  }, [features, groups, providedStart, providedEnd, range]);

  // Column width based on range and zoom
  const columnWidth = React.useMemo(() => {
    const baseWidth = range === "daily" ? 40 : range === "monthly" ? 120 : 200;
    return baseWidth * zoom;
  }, [range, zoom]);

  // Calculate position from date
  const getDatePosition = React.useCallback(
    (date: Date) => {
      const daysDiff = differenceInDays(date, timelineStart);

      if (range === "daily") {
        return daysDiff * columnWidth;
      } else if (range === "monthly") {
        const monthsDiff = differenceInMonths(date, startOfMonth(timelineStart));
        const daysIntoMonth = differenceInDays(date, startOfMonth(date));
        const daysInMonth = differenceInDays(
          addMonths(startOfMonth(date), 1),
          startOfMonth(date)
        );
        return (monthsDiff + daysIntoMonth / daysInMonth) * columnWidth;
      } else {
        const quartersDiff = differenceInQuarters(date, startOfQuarter(timelineStart));
        const daysIntoQuarter = differenceInDays(date, startOfQuarter(date));
        const daysInQuarter = differenceInDays(
          addQuarters(startOfQuarter(date), 1),
          startOfQuarter(date)
        );
        return (quartersDiff + daysIntoQuarter / daysInQuarter) * columnWidth;
      }
    },
    [timelineStart, range, columnWidth]
  );

  // Calculate date from position
  const getDateFromPosition = React.useCallback(
    (position: number) => {
      if (range === "daily") {
        const days = Math.floor(position / columnWidth);
        return addDays(timelineStart, days);
      } else if (range === "monthly") {
        const months = Math.floor(position / columnWidth);
        const remainder = (position % columnWidth) / columnWidth;
        const baseDate = addMonths(timelineStart, months);
        const daysInMonth = differenceInDays(
          addMonths(startOfMonth(baseDate), 1),
          startOfMonth(baseDate)
        );
        return addDays(baseDate, Math.floor(remainder * daysInMonth));
      } else {
        const quarters = Math.floor(position / columnWidth);
        const remainder = (position % columnWidth) / columnWidth;
        const baseDate = addQuarters(timelineStart, quarters);
        const daysInQuarter = differenceInDays(
          addQuarters(startOfQuarter(baseDate), 1),
          startOfQuarter(baseDate)
        );
        return addDays(baseDate, Math.floor(remainder * daysInQuarter));
      }
    },
    [timelineStart, range, columnWidth]
  );

  const value = React.useMemo<GanttContextValue>(
    () => ({
      range,
      setRange,
      zoom,
      setZoom,
      scrollLeft,
      setScrollLeft,
      scrollTop,
      setScrollTop,
      timelineStart,
      timelineEnd,
      features,
      groups,
      markers,
      getDatePosition,
      getDateFromPosition,
      columnWidth,
      sidebarWidth,
      rowHeight,
    }),
    [
      range,
      setRange,
      zoom,
      setZoom,
      scrollLeft,
      setScrollLeft,
      scrollTop,
      setScrollTop,
      timelineStart,
      timelineEnd,
      features,
      groups,
      markers,
      getDatePosition,
      getDateFromPosition,
      columnWidth,
      sidebarWidth,
      rowHeight,
    ]
  );

  return (
    <Provider store={store}>
      <GanttContext.Provider value={value}>{children}</GanttContext.Provider>
    </Provider>
  );
}
