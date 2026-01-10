'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Overdue gradient colors - 10 shades from light (1 day) to dark (10+ days)
// Each entry: [lightModeBg, darkModeBg, borderClass]
const OVERDUE_GRADIENT: [string, string, string][] = [
  ['bg-red-50/40', 'dark:bg-red-950/15', 'border-l-red-200'],      // 1 day
  ['bg-red-50/55', 'dark:bg-red-950/20', 'border-l-red-250'],      // 2 days
  ['bg-red-100/45', 'dark:bg-red-950/25', 'border-l-red-300'],     // 3 days
  ['bg-red-100/60', 'dark:bg-red-950/30', 'border-l-red-350'],     // 4 days
  ['bg-red-100/75', 'dark:bg-red-900/30', 'border-l-red-400'],     // 5 days
  ['bg-red-200/50', 'dark:bg-red-900/35', 'border-l-red-450'],     // 6 days
  ['bg-red-200/65', 'dark:bg-red-900/40', 'border-l-red-500'],     // 7 days
  ['bg-red-200/80', 'dark:bg-red-900/45', 'border-l-red-550'],     // 8 days
  ['bg-red-300/55', 'dark:bg-red-900/50', 'border-l-red-600'],     // 9 days
  ['bg-red-300/70', 'dark:bg-red-800/50', 'border-l-red-700'],     // 10+ days
];

/**
 * Get the overdue color classes based on days overdue.
 * Returns gradient from light (1 day) to dark (10+ days).
 * @param daysOverdue - Number of days the task is overdue
 * @returns Object with bg (combined light+dark), border, and intensity (0-1) for custom styling
 */
export function getOverdueColorClasses(daysOverdue: number): { bg: string; border: string; intensity: number } {
  if (daysOverdue <= 0) {
    return { bg: '', border: '', intensity: 0 };
  }

  // Clamp to 1-10 range (array is 0-indexed)
  const index = Math.min(Math.max(daysOverdue, 1), 10) - 1;
  const [lightBg, darkBg, border] = OVERDUE_GRADIENT[index];

  return {
    bg: `${lightBg} ${darkBg}`,
    border: `border-l-4 ${border}`,
    intensity: Math.min(daysOverdue / 10, 1),
  };
}

// Color presets for task highlighting
const COLOR_PRESETS = [
  { id: 'none', name: 'None', bg: '', border: '', text: '' },
  { id: 'violet', name: 'Violet', bg: 'bg-violet-50/50 dark:bg-violet-950/20', border: 'border-l-violet-400', text: 'text-violet-600 dark:text-violet-400' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-50/50 dark:bg-blue-950/20', border: 'border-l-blue-400', text: 'text-blue-600 dark:text-blue-400' },
  { id: 'green', name: 'Green', bg: 'bg-green-50/50 dark:bg-green-950/20', border: 'border-l-green-400', text: 'text-green-600 dark:text-green-400' },
  { id: 'amber', name: 'Amber', bg: 'bg-amber-50/50 dark:bg-amber-950/20', border: 'border-l-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  { id: 'orange', name: 'Orange', bg: 'bg-orange-50/50 dark:bg-orange-950/20', border: 'border-l-orange-400', text: 'text-orange-600 dark:text-orange-400' },
  { id: 'pink', name: 'Pink', bg: 'bg-pink-50/50 dark:bg-pink-950/20', border: 'border-l-pink-400', text: 'text-pink-600 dark:text-pink-400' },
  { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-50/50 dark:bg-cyan-950/20', border: 'border-l-cyan-400', text: 'text-cyan-600 dark:text-cyan-400' },
  { id: 'rose', name: 'Rose', bg: 'bg-rose-50/50 dark:bg-rose-950/20', border: 'border-l-rose-400', text: 'text-rose-600 dark:text-rose-400' },
];

// Task types that can be colored
export type TaskColorType = 'following' | 'private' | 'withJob' | 'withPO';

export interface TaskColorSettings {
  following: string;
  private: string;
  withJob: string;
  withPO: string;
}

const DEFAULT_SETTINGS: TaskColorSettings = {
  following: 'violet',
  private: 'amber',
  withJob: 'none',
  withPO: 'none',
};

const STORAGE_KEY = 'teeem-task-color-settings';

// Get settings from localStorage
export function getTaskColorSettings(): TaskColorSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

// Save settings to localStorage
function saveTaskColorSettings(settings: TaskColorSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// Get the color classes for a specific task type
export function getTaskColorClasses(type: TaskColorType): { bg: string; border: string; text: string } {
  const settings = getTaskColorSettings();
  const colorId = settings[type];
  const preset = COLOR_PRESETS.find(p => p.id === colorId) || COLOR_PRESETS[0];
  return { bg: preset.bg, border: preset.border, text: preset.text };
}

// Get combined row classes for a task based on its properties
export function getTaskRowColorClass(task: {
  is_following?: boolean;
  is_private?: boolean;
  construction_id?: number;
  purchase_order_id?: number | null;
  is_overdue?: boolean;
  days_overdue?: number;
  status?: string;
}): string {
  // Overdue takes priority (gradient based on days overdue)
  if (task.is_overdue && task.status !== 'completed' && task.days_overdue) {
    const overdueColors = getOverdueColorClasses(task.days_overdue);
    return `${overdueColors.bg} ${overdueColors.border}`;
  }

  const settings = getTaskColorSettings();

  // Check each type in priority order
  if (task.is_following && settings.following !== 'none') {
    const preset = COLOR_PRESETS.find(p => p.id === settings.following);
    if (preset) return `${preset.bg} border-l-2 ${preset.border}`;
  }

  if (task.is_private && settings.private !== 'none') {
    const preset = COLOR_PRESETS.find(p => p.id === settings.private);
    if (preset) return `${preset.bg} border-l-2 ${preset.border}`;
  }

  if (task.purchase_order_id && settings.withPO !== 'none') {
    const preset = COLOR_PRESETS.find(p => p.id === settings.withPO);
    if (preset) return `${preset.bg} border-l-2 ${preset.border}`;
  }

  if (task.construction_id && task.construction_id > 0 && settings.withJob !== 'none') {
    const preset = COLOR_PRESETS.find(p => p.id === settings.withJob);
    if (preset) return `${preset.bg} border-l-2 ${preset.border}`;
  }

  return '';
}

interface ColorPickerRowProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorPickerRow({ label, description, value, onChange }: ColorPickerRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-1">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onChange(preset.id)}
            className={cn(
              'w-6 h-6 rounded border-2 transition-all',
              preset.id === 'none'
                ? 'bg-white dark:bg-gray-800 border-dashed border-gray-300 dark:border-gray-600'
                : `${preset.bg} border-transparent`,
              value === preset.id && 'ring-2 ring-primary ring-offset-1'
            )}
            title={preset.name}
          >
            {preset.id === 'none' && <span className="text-[8px] text-muted-foreground">∅</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TaskColorSettingsDialogProps {
  onSettingsChange?: () => void;
}

export function TaskColorSettingsDialog({ onSettingsChange }: TaskColorSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<TaskColorSettings>(DEFAULT_SETTINGS);

  // Load settings when dialog opens
  useEffect(() => {
    if (open) {
      setSettings(getTaskColorSettings());
    }
  }, [open]);

  const handleChange = (type: TaskColorType, value: string) => {
    const newSettings = { ...settings, [type]: value };
    setSettings(newSettings);
    saveTaskColorSettings(newSettings);
    onSettingsChange?.();
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    saveTaskColorSettings(DEFAULT_SETTINGS);
    onSettingsChange?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Task color settings">
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Task Color Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 divide-y">
          <ColorPickerRow
            label="Following"
            description="Tasks you are following"
            value={settings.following}
            onChange={(v) => handleChange('following', v)}
          />
          <ColorPickerRow
            label="Private"
            description="Private tasks"
            value={settings.private}
            onChange={(v) => handleChange('private', v)}
          />
          <ColorPickerRow
            label="With Job"
            description="Tasks linked to a job"
            value={settings.withJob}
            onChange={(v) => handleChange('withJob', v)}
          />
          <ColorPickerRow
            label="With PO"
            description="Tasks linked to a purchase order"
            value={settings.withPO}
            onChange={(v) => handleChange('withPO', v)}
          />
        </div>

        <div className="flex justify-between pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs gap-1">
            <RotateCcw className="h-3 w-3" />
            Reset to defaults
          </Button>
          <p className="text-[10px] text-muted-foreground self-center">
            Overdue tasks always show red
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
