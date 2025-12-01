"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useGantt } from "./context";
import type { GanttFeature } from "./types";

type DependencyConnectorState = {
  isDragging: boolean;
  sourceFeature: GanttFeature | null;
  sourcePoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number } | null;
};

type DependencyConnectorContextValue = {
  state: DependencyConnectorState;
  startDrag: (feature: GanttFeature, point: { x: number; y: number }) => void;
  updateDrag: (point: { x: number; y: number }) => void;
  endDrag: (targetFeature?: GanttFeature) => void;
  cancelDrag: () => void;
};

const DependencyConnectorContext = React.createContext<DependencyConnectorContextValue | null>(null);

export function useDependencyConnector() {
  const context = React.useContext(DependencyConnectorContext);
  if (!context) {
    throw new Error("useDependencyConnector must be used within a DependencyConnectorProvider");
  }
  return context;
}

type DependencyConnectorProviderProps = {
  children: React.ReactNode;
  onCreateDependency?: (fromId: string, toId: string) => void;
};

export function DependencyConnectorProvider({
  children,
  onCreateDependency,
}: DependencyConnectorProviderProps) {
  const [state, setState] = React.useState<DependencyConnectorState>({
    isDragging: false,
    sourceFeature: null,
    sourcePoint: null,
    currentPoint: null,
  });

  const startDrag = React.useCallback((feature: GanttFeature, point: { x: number; y: number }) => {
    setState({
      isDragging: true,
      sourceFeature: feature,
      sourcePoint: point,
      currentPoint: point,
    });
  }, []);

  const updateDrag = React.useCallback((point: { x: number; y: number }) => {
    setState((prev) => ({
      ...prev,
      currentPoint: point,
    }));
  }, []);

  const endDrag = React.useCallback((targetFeature?: GanttFeature) => {
    if (state.sourceFeature && targetFeature && state.sourceFeature.id !== targetFeature.id) {
      // Check if dependency already exists
      const existingDeps = targetFeature.dependencies || [];
      if (!existingDeps.includes(state.sourceFeature.id)) {
        onCreateDependency?.(state.sourceFeature.id, targetFeature.id);
      }
    }
    setState({
      isDragging: false,
      sourceFeature: null,
      sourcePoint: null,
      currentPoint: null,
    });
  }, [state.sourceFeature, onCreateDependency]);

  const cancelDrag = React.useCallback(() => {
    setState({
      isDragging: false,
      sourceFeature: null,
      sourcePoint: null,
      currentPoint: null,
    });
  }, []);

  // Handle global mouse events
  React.useEffect(() => {
    if (!state.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateDrag({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      // If we're not over a target, cancel
      cancelDrag();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelDrag();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [state.isDragging, updateDrag, cancelDrag]);

  return (
    <DependencyConnectorContext.Provider value={{ state, startDrag, updateDrag, endDrag, cancelDrag }}>
      {children}
      {/* Render the drag line */}
      {state.isDragging && state.sourcePoint && state.currentPoint && (
        <DependencyDragLine
          from={state.sourcePoint}
          to={state.currentPoint}
        />
      )}
    </DependencyConnectorContext.Provider>
  );
}

type DependencyDragLineProps = {
  from: { x: number; y: number };
  to: { x: number; y: number };
};

function DependencyDragLine({ from, to }: DependencyDragLineProps) {
  return (
    <svg
      className="fixed inset-0 pointer-events-none z-[100]"
      style={{ width: "100vw", height: "100vh" }}
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray="4 2"
        className="text-primary"
      />
      {/* End circle */}
      <circle
        cx={to.x}
        cy={to.y}
        r={4}
        fill="currentColor"
        className="text-primary"
      />
    </svg>
  );
}

type DependencyConnectorHandleProps = {
  feature: GanttFeature;
  position: "start" | "end";
  className?: string;
};

export function DependencyConnectorHandle({
  feature,
  position,
  className,
}: DependencyConnectorHandleProps) {
  const { startDrag } = useDependencyConnector();
  const handleRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = handleRef.current?.getBoundingClientRect();
    if (rect) {
      startDrag(feature, {
        x: position === "end" ? rect.right : rect.left,
        y: rect.top + rect.height / 2,
      });
    }
  };

  return (
    <div
      ref={handleRef}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full",
        "bg-background border-2 border-primary cursor-crosshair",
        "opacity-0 group-hover:opacity-100 transition-opacity",
        "hover:scale-125 hover:bg-primary",
        position === "start" ? "-left-1.5" : "-right-1.5",
        className
      )}
      onMouseDown={handleMouseDown}
    />
  );
}

type DependencyDropTargetProps = {
  feature: GanttFeature;
  children: React.ReactNode;
  className?: string;
};

export function DependencyDropTarget({
  feature,
  children,
  className,
}: DependencyDropTargetProps) {
  const { state, endDrag } = useDependencyConnector();
  const [isOver, setIsOver] = React.useState(false);

  const canDrop = state.isDragging && state.sourceFeature?.id !== feature.id;

  const handleMouseEnter = () => {
    if (canDrop) {
      setIsOver(true);
    }
  };

  const handleMouseLeave = () => {
    setIsOver(false);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (canDrop) {
      e.preventDefault();
      e.stopPropagation();
      endDrag(feature);
      setIsOver(false);
    }
  };

  return (
    <div
      className={cn(
        "relative",
        canDrop && "ring-2 ring-primary/30",
        isOver && canDrop && "ring-2 ring-primary bg-primary/10",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
    >
      {children}
    </div>
  );
}
