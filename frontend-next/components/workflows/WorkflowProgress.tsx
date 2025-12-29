'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  Circle,
  Play,
  Square,
  Diamond,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface WorkflowNode {
  id: number;
  node_key: string;
  node_name: string;
  node_type: string;
  status: 'completed' | 'active' | 'waiting' | 'pending';
}

interface WorkflowToken {
  id: number;
  node_id: number;
  node_key: string;
  node_name: string;
  node_type: string;
  status: string;
}

interface WorkflowInstance {
  id: number;
  status: string;
  process_name: string;
  tokens: WorkflowToken[];
  current_nodes: string[];
}

interface WorkflowProgressProps {
  instanceId: number;
  compact?: boolean;
}

export function WorkflowProgress({ instanceId, compact = false }: WorkflowProgressProps) {
  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInstance();
  }, [instanceId]);

  const loadInstance = async () => {
    try {
      const response = await api.get<{ instance: WorkflowInstance; success: boolean }>(
        `/api/v1/bpmn_process_instances/${instanceId}`
      );
      if (response.success && response.instance) {
        setInstance(response.instance);

        // Build node list from tokens and determine status
        const activeNodeKeys = new Set(
          response.instance.tokens
            .filter(t => t.status === 'active' || t.status === 'waiting')
            .map(t => t.node_key)
        );
        const completedNodeKeys = new Set(
          response.instance.tokens
            .filter(t => t.status === 'completed')
            .map(t => t.node_key)
        );

        // Get unique nodes from tokens, preserving order
        const seenKeys = new Set<string>();
        const nodeList: WorkflowNode[] = [];

        response.instance.tokens.forEach(token => {
          if (!seenKeys.has(token.node_key)) {
            seenKeys.add(token.node_key);
            let status: WorkflowNode['status'] = 'pending';
            if (completedNodeKeys.has(token.node_key)) {
              status = 'completed';
            } else if (activeNodeKeys.has(token.node_key)) {
              status = token.status === 'waiting' ? 'waiting' : 'active';
            }
            nodeList.push({
              id: token.node_id,
              node_key: token.node_key,
              node_name: token.node_name,
              node_type: token.node_type,
              status,
            });
          }
        });

        setNodes(nodeList);
      }
    } catch (err) {
      console.error('Failed to load workflow instance:', err);
    } finally {
      setLoading(false);
    }
  };

  const getNodeIcon = (node: WorkflowNode) => {
    const iconClass = compact ? 'h-4 w-4' : 'h-5 w-5';

    // Status-based icon
    if (node.status === 'completed') {
      return <CheckCircle className={cn(iconClass, 'text-green-500')} />;
    }
    if (node.status === 'active') {
      return <Spinner size={16} className="text-blue-500" />;
    }
    if (node.status === 'waiting') {
      return <Clock className={cn(iconClass, 'text-orange-500')} />;
    }

    // Type-based icon for pending
    switch (node.node_type) {
      case 'start_event':
        return <Play className={cn(iconClass, 'text-gray-400')} />;
      case 'end_event':
        return <Square className={cn(iconClass, 'text-gray-400')} />;
      case 'exclusive_gateway':
      case 'parallel_gateway':
        return <Diamond className={cn(iconClass, 'text-gray-400')} />;
      default:
        return <Circle className={cn(iconClass, 'text-gray-400')} />;
    }
  };

  const getNodeLabel = (node: WorkflowNode) => {
    if (node.node_type === 'start_event') return 'Start';
    if (node.node_type === 'end_event') return 'End';
    return node.node_name;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size={20} className="text-muted-foreground" />
      </div>
    );
  }

  if (!instance || nodes.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <AlertCircle className="h-4 w-4" />
        No workflow data available
      </div>
    );
  }

  if (compact) {
    // Compact horizontal view
    return (
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {nodes.map((node, index) => (
          <div key={node.node_key} className="flex items-center">
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-full text-xs whitespace-nowrap',
                node.status === 'completed' && 'bg-green-100 text-green-700',
                node.status === 'active' && 'bg-blue-100 text-blue-700',
                node.status === 'waiting' && 'bg-orange-100 text-orange-700',
                node.status === 'pending' && 'bg-gray-100 text-gray-500'
              )}
            >
              {getNodeIcon(node)}
              <span className="max-w-[100px] truncate">{getNodeLabel(node)}</span>
            </div>
            {index < nodes.length - 1 && (
              <div className={cn(
                'w-4 h-0.5 mx-0.5',
                node.status === 'completed' ? 'bg-green-300' : 'bg-gray-200'
              )} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Full vertical view
  return (
    <div className="space-y-0">
      {nodes.map((node, index) => (
        <div key={node.node_key} className="flex items-start gap-3">
          {/* Timeline */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full border-2',
                node.status === 'completed' && 'border-green-500 bg-green-50',
                node.status === 'active' && 'border-blue-500 bg-blue-50',
                node.status === 'waiting' && 'border-orange-500 bg-orange-50',
                node.status === 'pending' && 'border-gray-300 bg-gray-50'
              )}
            >
              {getNodeIcon(node)}
            </div>
            {index < nodes.length - 1 && (
              <div
                className={cn(
                  'w-0.5 h-8',
                  node.status === 'completed' ? 'bg-green-300' : 'bg-gray-200'
                )}
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-4">
            <p
              className={cn(
                'font-medium text-sm',
                node.status === 'completed' && 'text-green-700',
                node.status === 'active' && 'text-blue-700',
                node.status === 'waiting' && 'text-orange-700',
                node.status === 'pending' && 'text-gray-500'
              )}
            >
              {getNodeLabel(node)}
            </p>
            <p className="text-xs text-muted-foreground">
              {node.status === 'completed' && 'Completed'}
              {node.status === 'active' && 'In progress'}
              {node.status === 'waiting' && 'Waiting for action'}
              {node.status === 'pending' && 'Pending'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
