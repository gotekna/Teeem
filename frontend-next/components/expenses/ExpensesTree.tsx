"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExpenseGroupNode } from "./ExpenseGroupNode";
import { type ExpenseGroup } from "@/lib/expenses-utils";
import { ChevronDown, ChevronUp, FolderOpen, Folder } from "lucide-react";

interface ExpensesTreeProps {
  data: ExpenseGroup[];
  className?: string;
}

/**
 * ExpensesTree - Main hierarchical tree container
 *
 * Features:
 * - Expand/collapse all button
 * - Manages expanded state for all nodes
 * - Renders ExpenseGroupNode recursively
 */
export function ExpensesTree({ data, className }: ExpensesTreeProps) {
  // Track which nodes are expanded
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Get all possible keys for expand all functionality
  const allKeys = useMemo(() => {
    const keys: string[] = [];
    const collectKeys = (groups: ExpenseGroup[]) => {
      for (const group of groups) {
        keys.push(group.key);
        if (group.children.length > 0) {
          collectKeys(group.children);
        }
      }
    };
    collectKeys(data);
    return keys;
  }, [data]);

  // Expand all level 1 groups by default on mount
  useEffect(() => {
    const level1Keys = data.map(g => g.key);
    setExpandedKeys(new Set(level1Keys));
  }, [data]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedKeys(new Set(allKeys));
  }, [allKeys]);

  const collapseAll = useCallback(() => {
    setExpandedKeys(new Set());
  }, []);

  const isAllExpanded = expandedKeys.size === allKeys.length;

  if (data.length === 0) {
    return (
      <Card className={cn("p-8 text-center", className)}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Folder className="h-12 w-12 text-muted-foreground dark:text-muted-foreground" />
          <p className="text-lg font-medium">No Purchase Orders</p>
          <p className="text-sm">This job has no purchase orders to display.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header with expand/collapse controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border dark:border-border bg-muted dark:bg-gray-800/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {data.length} {data.length === 1 ? "Stage" : "Stages"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={isAllExpanded ? collapseAll : expandAll}
            className="h-7 px-2 text-xs"
          >
            {isAllExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Collapse All
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Expand All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {data.map((group) => (
          <ExpenseGroupNode
            key={group.key}
            group={group}
            depth={0}
            expandedKeys={expandedKeys}
            onToggle={toggleExpand}
          />
        ))}
      </div>
    </Card>
  );
}
