'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { Workflow, Play, CheckCircle } from "lucide-react";
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from "@/components/ui/spinner";

interface BpmnProcess {
  id: number;
  name: string;
  description?: string;
  is_published: boolean;
}

interface BpmnTrigger {
  id: number;
  name: string;
  trigger_type: string;
  is_active: boolean;
}

interface StartWorkflowButtonProps {
  jobId: number;
  jobName: string;
}

export function StartWorkflowButton({ jobId, jobName }: StartWorkflowButtonProps) {
  const [open, setOpen] = useState(false);
  const [processes, setProcesses] = useState<BpmnProcess[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<number | null>(null);
  const [triggers, setTriggers] = useState<BpmnTrigger[]>([]);
  const [selectedTrigger, setSelectedTrigger] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  // Load published workflows
  useEffect(() => {
    if (open) {
      loadProcesses();
    }
  }, [open]);

  // Load triggers when process is selected
  useEffect(() => {
    if (selectedProcess) {
      loadTriggers(selectedProcess);
    } else {
      setTriggers([]);
      setSelectedTrigger(null);
    }
  }, [selectedProcess]);

  const loadProcesses = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ processes: BpmnProcess[] }>('/api/v1/bpmn_processes');
      // Only show published processes
      const published = (response.processes || []).filter(p => p.is_published);
      setProcesses(published);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTriggers = async (processId: number) => {
    try {
      const response = await api.get<{ triggers: BpmnTrigger[] }>(
        `/api/v1/bpmn_processes/${processId}/bpmn_triggers`
      );
      // Only show active manual triggers
      const manualTriggers = (response.triggers || []).filter(
        t => t.trigger_type === 'manual' && t.is_active
      );
      setTriggers(manualTriggers);
      // Auto-select if only one trigger
      if (manualTriggers.length === 1) {
        setSelectedTrigger(manualTriggers[0].id);
      }
    } catch (err) {
      console.error('Failed to load triggers:', err);
    }
  };

  const handleStart = async () => {
    if (!selectedProcess || !selectedTrigger) return;

    setStarting(true);
    try {
      const response = await api.post<{ success: boolean; process_instance?: { id: number } }>(
        `/api/v1/bpmn_processes/${selectedProcess}/bpmn_triggers/${selectedTrigger}/fire`,
        {
          subject_type: 'Job',
          subject_id: jobId,
          variables: {},
        }
      );

      if (response?.success) {
        setSuccess(true);
        toast({
          title: 'Workflow started',
          description: `Workflow started for ${jobName}. Check Tasks for pending actions.`,
        });
        setTimeout(() => {
          setOpen(false);
          setSuccess(false);
          setSelectedProcess(null);
          setSelectedTrigger(null);
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to start workflow:', err);
      toast({
        title: 'Failed to start workflow',
        description: 'Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Workflow className="h-4 w-4 mr-2" />
          Start Workflow
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Workflow</DialogTitle>
          <DialogDescription>
            Start a workflow for {jobName}. The workflow will create tasks that appear in your Tasks page.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-medium">Workflow Started!</p>
            <p className="text-sm text-muted-foreground">Check Tasks for pending actions.</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Workflow</label>
              {loading ? (
                <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
                  <Spinner size={16} />
                  <span className="text-muted-foreground">Loading workflows...</span>
                </div>
              ) : processes.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                  No published workflows available. Create and publish a workflow first.
                </div>
              ) : (
                <Select
                  value={selectedProcess?.toString() || ''}
                  onValueChange={(v) => setSelectedProcess(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a workflow..." />
                  </SelectTrigger>
                  <SelectContent>
                    {processes.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedProcess && triggers.length === 0 && (
              <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                This workflow has no manual triggers. Add a manual trigger in the workflow designer.
              </div>
            )}

            {triggers.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Trigger</label>
                <Select
                  value={selectedTrigger?.toString() || ''}
                  onValueChange={(v) => setSelectedTrigger(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a trigger..." />
                  </SelectTrigger>
                  <SelectContent>
                    {triggers.map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {!success && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStart}
              disabled={!selectedProcess || !selectedTrigger || starting}
            >
              {starting ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Workflow
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
