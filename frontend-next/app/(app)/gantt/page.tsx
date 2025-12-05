"use client";

import * as React from "react";
import {
  GanttChart,
  defaultStatuses,
  type GanttFeature,
  type GanttGroup,
  type GanttMarkerType,
  type CascadeResolution,
  type HoldState,
} from "@/components/ui/gantt";
import { addDays, startOfWeek } from "date-fns";
import { Card } from "@/components/ui/card";

export default function GanttPage() {
  // Construction project - start from beginning of week
  const today = new Date();
  const projectStart = startOfWeek(today);

  // Demo hold state - toggle this to see the banner
  const [holdState] = React.useState<HoldState>({
    isOnHold: false,
  });

  // Ungrouped tasks at the top
  const [features, setFeatures] = React.useState<GanttFeature[]>([
    {
      id: "site-setup",
      name: "Site Setup",
      startAt: projectStart,
      endAt: addDays(projectStart, 2),
      status: defaultStatuses[2], // completed
      progress: 100,
    },
    {
      id: "soil-test",
      name: "Soil Test & Survey",
      startAt: addDays(projectStart, 1),
      endAt: addDays(projectStart, 3),
      status: defaultStatuses[2], // completed
      progress: 100,
    },
  ]);

  const [groups, setGroups] = React.useState<GanttGroup[]>([
    {
      id: "slab-foundation",
      name: "Slab & Foundation",
      features: [
        {
          id: "excavation",
          name: "Excavation",
          startAt: addDays(projectStart, 4),
          endAt: addDays(projectStart, 6),
          status: defaultStatuses[2], // completed
          progress: 100,
          dependencies: ["soil-test"],
        },
        {
          id: "pour-slab",
          name: "Pour Concrete Slab",
          startAt: addDays(projectStart, 7),
          endAt: addDays(projectStart, 8),
          status: defaultStatuses[2], // completed
          progress: 100,
          dependencies: ["excavation"],
          lock: "supplierConfirmed",
        },
        {
          id: "curing",
          name: "Curing Period",
          startAt: addDays(projectStart, 9),
          endAt: addDays(projectStart, 15),
          status: defaultStatuses[2], // completed
          progress: 100,
          dependencies: ["pour-slab"],
        },
      ],
    },
    {
      id: "frame-stage",
      name: "Frame Stage",
      features: [
        {
          id: "frame-external",
          name: "Frame External Walls",
          startAt: addDays(projectStart, 16),
          endAt: addDays(projectStart, 20),
          status: defaultStatuses[1], // in-progress
          progress: 75,
          dependencies: ["curing"],
        },
        {
          id: "frame-internal",
          name: "Frame Internal Walls",
          startAt: addDays(projectStart, 21),
          endAt: addDays(projectStart, 24),
          status: defaultStatuses[0], // not-started
          dependencies: ["frame-external"],
        },
        {
          id: "roof-trusses",
          name: "Roof Trusses Install",
          startAt: addDays(projectStart, 25),
          endAt: addDays(projectStart, 27),
          status: defaultStatuses[0], // not-started
          dependencies: ["frame-internal"],
          lock: "supplierConfirmed",
        },
        {
          id: "roof-sheeting",
          name: "Roof Sheeting",
          startAt: addDays(projectStart, 28),
          endAt: addDays(projectStart, 30),
          status: defaultStatuses[0], // not-started
          dependencies: ["roof-trusses"],
        },
      ],
    },
    {
      id: "lockup-stage",
      name: "Lock Up Stage",
      features: [
        {
          id: "windows",
          name: "Install Windows",
          startAt: addDays(projectStart, 31),
          endAt: addDays(projectStart, 33),
          status: defaultStatuses[0],
          dependencies: ["roof-sheeting"],
          lock: "supplierConfirmed",
        },
        {
          id: "external-doors",
          name: "Install External Doors",
          startAt: addDays(projectStart, 34),
          endAt: addDays(projectStart, 35),
          status: defaultStatuses[0],
          dependencies: ["windows"],
        },
      ],
    },
  ]);

  const markers: GanttMarkerType[] = [
    {
      id: "frame-inspection",
      date: addDays(projectStart, 30),
      label: "Frame Inspection",
      color: "bg-purple-500",
    },
    {
      id: "practical-completion",
      date: addDays(projectStart, 72),
      label: "Practical Completion",
      color: "bg-green-500",
    },
  ];

  const getAllFeatures = React.useCallback(() => {
    const all: GanttFeature[] = [...features];
    groups.forEach((g) => all.push(...g.features));
    return all;
  }, [features, groups]);

  const findDependentTasks = React.useCallback(
    (taskId: string, visited = new Set<string>()): string[] => {
      if (visited.has(taskId)) return [];
      visited.add(taskId);

      const allFeatures = getAllFeatures();
      const dependents: string[] = [];

      allFeatures.forEach((f) => {
        if (f.dependencies?.includes(taskId)) {
          dependents.push(f.id);
          dependents.push(...findDependentTasks(f.id, visited));
        }
      });

      return dependents;
    },
    [getAllFeatures]
  );

  const handleFeatureUpdate = (updatedFeature: GanttFeature) => {
    const allFeatures = getAllFeatures();
    const originalFeature = allFeatures.find((f) => f.id === updatedFeature.id);

    if (!originalFeature) return;

    const timeShift = updatedFeature.startAt.getTime() - originalFeature.startAt.getTime();
    const dependentIds = timeShift !== 0 ? findDependentTasks(updatedFeature.id) : [];

    const updateFeature = (f: GanttFeature): GanttFeature => {
      if (f.id === updatedFeature.id) {
        return updatedFeature;
      }
      if (dependentIds.includes(f.id) && timeShift !== 0) {
        return {
          ...f,
          startAt: new Date(f.startAt.getTime() + timeShift),
          endAt: new Date(f.endAt.getTime() + timeShift),
        };
      }
      return f;
    };

    setFeatures((prev) => prev.map(updateFeature));
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        features: group.features.map(updateFeature),
      }))
    );
  };

  const handleCreateDependency = (fromId: string, toId: string) => {
    setFeatures((prev) =>
      prev.map((f) => {
        if (f.id === toId) {
          const deps = f.dependencies || [];
          if (!deps.includes(fromId)) {
            return { ...f, dependencies: [...deps, fromId] };
          }
        }
        return f;
      })
    );
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        features: group.features.map((f) => {
          if (f.id === toId) {
            const deps = f.dependencies || [];
            if (!deps.includes(fromId)) {
              return { ...f, dependencies: [...deps, fromId] };
            }
          }
          return f;
        }),
      }))
    );
  };

  const handleCascadeUpdate = (
    sourceFeature: GanttFeature,
    resolutions: CascadeResolution[]
  ) => {
    const allFeatures = getAllFeatures();
    const originalFeature = allFeatures.find((f) => f.id === sourceFeature.id);
    if (!originalFeature) return;

    const timeShift = sourceFeature.startAt.getTime() - originalFeature.startAt.getTime();

    const tasksToMove = new Set<string>();
    const tasksToUnlock = new Set<string>();

    resolutions.forEach((res) => {
      if (res?.action === "move") {
        tasksToMove.add(res.featureId);
      } else if (res?.action === "unlock-move") {
        tasksToMove.add(res.featureId);
        tasksToUnlock.add(res.featureId);
      }
    });

    const updateFeature = (f: GanttFeature): GanttFeature => {
      if (f.id === sourceFeature.id) {
        return sourceFeature;
      }

      let updated = { ...f };

      const resolution = resolutions.find((r) => r.featureId === f.id);
      if (resolution?.action === "unlink") {
        updated.dependencies = (updated.dependencies || []).filter(
          (depId) => depId !== sourceFeature.id
        );
      }

      if (tasksToMove.has(f.id) && timeShift !== 0) {
        updated = {
          ...updated,
          startAt: new Date(f.startAt.getTime() + timeShift),
          endAt: new Date(f.endAt.getTime() + timeShift),
        };
      }

      if (tasksToUnlock.has(f.id)) {
        updated.lock = undefined;
      }

      return updated;
    };

    setFeatures((prev) => prev.map(updateFeature));
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        features: group.features.map(updateFeature),
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Schedule Master</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Construction timeline with dependencies, supplier confirmations, and milestone inspections.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="h-[600px]">
          <GanttChart
            features={features}
            groups={groups}
            markers={markers}
            defaultRange="daily"
            holdState={holdState}
            onFeatureUpdate={handleFeatureUpdate}
            onCreateDependency={handleCreateDependency}
            onCascadeUpdate={handleCascadeUpdate}
            getDependentTasks={findDependentTasks}
            className="h-full"
          />
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 p-4 border border-border bg-card">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Status:
        </span>
        {defaultStatuses.map((status) => (
          <div key={status.id} className="flex items-center gap-2">
            <div className={`w-3 h-3 ${status.color.split(" ")[0]}`} />
            <span className="text-[11px]">{status.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
