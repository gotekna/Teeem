import { cn } from "@/lib/utils";
import { format, differenceInDays, addDays, isToday } from "date-fns";

export interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
  color?: string; // optional Tailwind color class e.g. "bg-blue-500"
}

interface GanttChartProps {
  tasks: GanttTask[];
  startDate?: Date;
  endDate?: Date;
}

export function GanttChart({ tasks, startDate, endDate }: GanttChartProps) {
  if (!tasks || tasks.length === 0) return null;

  // Determine overall range
  const minStart = startDate ?? tasks.reduce((min, t) => (t.start < min ? t.start : min), tasks[0].start);
  const maxEnd = endDate ?? tasks.reduce((max, t) => (t.end > max ? t.end : max), tasks[0].end);

  const totalDays = differenceInDays(maxEnd, minStart) + 1;
  const dates = Array.from({ length: totalDays }).map((_, i) => addDays(minStart, i));

  // Today line position (if today falls within range)
  const todayPos = isToday(new Date()) && isToday(new Date())
    ? differenceInDays(new Date(), minStart)
    : null;

  return (
    <div className="overflow-x-auto bg-white/5 backdrop-blur-md shadow-lg border border-border">
      {/* Header */}
      <div
        className="sticky top-0 bg-white/10 backdrop-blur-sm border-b border-border grid"
        style={{ gridTemplateColumns: `150px repeat(${totalDays}, 40px)` }}
      >
        <div className="p-2 font-medium text-muted-foreground">Task</div>
        {dates.map((d) => (
          <div
            key={d.toISOString()}
            className="text-xs text-center p-2 border-l border-border text-muted-foreground"
          >
            {format(d, "dd/MM")}
          </div>
        ))}
      </div>
      {/* Rows */}
      {tasks.map((task) => {
        const offset = differenceInDays(task.start, minStart);
        const duration = differenceInDays(task.end, task.start) + 1;
        const barColor = task.color ?? "bg-primary";
        return (
          <div
            key={task.id}
            className={`grid grid-cols-[150px_repeat(${totalDays},40px)] border-b border-border items-center relative`}
          >
            <div className="p-2 truncate text-sm font-medium">{task.name}</div>
            {/* Empty cells before bar */}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={i} className="border-l border-border" />
            ))}
            {/* Bar with tooltip */}
            <div
              className={cn(
                "relative group h-6 shadow-inner",
                barColor,
                "bg-gradient-to-r from-primary to-primary/70"
              )}
              style={{ gridColumn: `span ${duration}` }}
            >
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block whitespace-nowrap bg-popover text-popover-foreground text-xs px-2 py-1 shadow-md">
                {task.name}: {format(task.start, "dd MMM")} – {format(task.end, "dd MMM")}
              </div>
            </div>
            {/* Empty cells after bar */}
            {Array.from({ length: totalDays - offset - duration }).map((_, i) => (
              <div key={i} className="border-l border-border" />
            ))}
          </div>
        );
      })}
      {/* Today indicator line */}
      {todayPos !== null && todayPos >= 0 && todayPos <= totalDays && (
        <div className="absolute inset-y-0 left-0" style={{ left: `${150 + todayPos * 40}px` }}>
          <div className="h-full w-0.5 bg-red-500 animate-pulse" />
        </div>
      )}
    </div>
  );
}
