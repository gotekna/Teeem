"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  Pin,
  PinOff,
  Star,
  StarOff,
  Archive,
  ArchiveRestore,
  Crown,
  MoreHorizontal,
  Check,
  Trash2,
  AlertOctagon,
  Mail,
  MailOpen,
} from "lucide-react";
import { ReminderButton } from "./ReminderPicker";

// Types
export interface EmailUserState {
  id?: number;
  email_id: number;
  user_id?: number;
  is_pinned: boolean;
  is_starred: boolean;
  star_color: string | null;
  star_color_hex: string | null;
  is_read: boolean;
  is_archived: boolean;
  priority: string | null;
  remind_at: string | null;
  reminder_sent: boolean;
  notes: string | null;
  from_vip: boolean;
}

export interface StarColor {
  key: string;
  hex: string;
  label: string;
}

// API Functions
async function fetchEmailState(emailId: number): Promise<EmailUserState> {
  const response = await api.get<{ data: EmailUserState }>(`/api/v1/email_user_states/for_email/${emailId}`);
  return (response as { data: EmailUserState }).data;
}

async function togglePin(emailId: number): Promise<EmailUserState> {
  const response = await api.post<{ data: EmailUserState }>(`/api/v1/email_user_states/for_email/${emailId}/toggle_pin`);
  return (response as { data: EmailUserState }).data;
}

async function toggleStar(emailId: number, color?: string): Promise<EmailUserState> {
  const response = await api.post<{ data: EmailUserState }>(`/api/v1/email_user_states/for_email/${emailId}/toggle_star`, { color });
  return (response as { data: EmailUserState }).data;
}

async function toggleArchive(emailId: number): Promise<EmailUserState> {
  const response = await api.post<{ data: EmailUserState }>(`/api/v1/email_user_states/for_email/${emailId}/toggle_archive`);
  return (response as { data: EmailUserState }).data;
}

async function fetchStarColors(): Promise<StarColor[]> {
  const response = await api.get<{ data: { colors: StarColor[] } }>("/api/v1/email_user_states/star_colors");
  return (response as { data: { colors: StarColor[] } }).data.colors || [];
}

async function checkVipStatus(emailAddress: string): Promise<{ is_vip: boolean }> {
  const response = await api.get<{ data: { is_vip: boolean } }>(`/api/v1/vip_senders/check?email_address=${encodeURIComponent(emailAddress)}`);
  return (response as { data: { is_vip: boolean } }).data;
}

async function toggleVip(emailAddress: string, name?: string): Promise<{ is_vip: boolean }> {
  const response = await api.post<{ data: { is_vip: boolean } }>("/api/v1/vip_senders/toggle", { email_address: emailAddress, name });
  return (response as { data: { is_vip: boolean } }).data;
}

async function deleteEmail(emailId: number): Promise<void> {
  await api.delete(`/api/v1/synced_emails/${emailId}/delete_from_outlook`);
}

async function markAsSpam(emailId: number, deleteFromOutlook: boolean = false): Promise<void> {
  await api.post(`/api/v1/synced_emails/${emailId}/mark_as_spam`, { delete_from_outlook: deleteFromOutlook });
}

async function toggleRead(emailId: number): Promise<EmailUserState> {
  const response = await api.post<{ data: EmailUserState }>(`/api/v1/email_user_states/for_email/${emailId}/toggle_read`);
  return (response as { data: EmailUserState }).data;
}

// Pin Button Component
interface PinButtonProps {
  emailId: number;
  isPinned?: boolean;
  onToggle?: (isPinned: boolean) => void;
  size?: "sm" | "md";
}

export function PinButton({ emailId, isPinned: initialPinned, onToggle, size = "md" }: PinButtonProps) {
  const [isPinned, setIsPinned] = useState(initialPinned ?? false);
  const [loading, setLoading] = useState(false);

  // Sync with prop changes
  useEffect(() => {
    setIsPinned(initialPinned ?? false);
  }, [initialPinned]);

  const handleToggle = async () => {
    // Optimistic update - immediately toggle UI
    const previousState = isPinned;
    const newState = !isPinned;
    setIsPinned(newState);
    onToggle?.(newState);
    setLoading(true);

    try {
      const result = await togglePin(emailId);
      // Sync with server state (in case it differs)
      setIsPinned(result.is_pinned);
      onToggle?.(result.is_pinned);
    } catch (error) {
      // Revert on error
      console.error("Failed to toggle pin:", error);
      setIsPinned(previousState);
      onToggle?.(previousState);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(buttonSize, isPinned && "text-blue-500 dark:text-blue-400")}
            onClick={handleToggle}
            disabled={loading}
          >
            {loading ? (
              <Spinner className={iconSize} />
            ) : isPinned ? (
              <Pin className={cn(iconSize, "fill-current")} />
            ) : (
              <Pin className={iconSize} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isPinned ? "Unpin" : "Pin to top"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Star Button Component
interface StarButtonProps {
  emailId: number;
  isStarred?: boolean;
  starColor?: string | null;
  onToggle?: (isStarred: boolean, color: string | null) => void;
  size?: "sm" | "md";
  showColorPicker?: boolean;
}

export function StarButton({
  emailId,
  isStarred: initialStarred,
  starColor: initialColor,
  onToggle,
  size = "md",
  showColorPicker = true,
}: StarButtonProps) {
  const [isStarred, setIsStarred] = useState(initialStarred ?? false);
  const [starColor, setStarColor] = useState<string | null>(initialColor ?? null);
  const [colors, setColors] = useState<StarColor[]>([]);
  const [loading, setLoading] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  useEffect(() => {
    if (showColorPicker) {
      fetchStarColors().then(setColors).catch(console.error);
    }
  }, [showColorPicker]);

  // Sync with prop changes
  useEffect(() => {
    setIsStarred(initialStarred ?? false);
    setStarColor(initialColor ?? null);
  }, [initialStarred, initialColor]);

  const handleToggle = async (color?: string) => {
    // Optimistic update
    const previousStarred = isStarred;
    const previousColor = starColor;
    const newStarred = color ? true : !isStarred;
    const newColor = color || (newStarred ? (starColor || "yellow") : null);

    setIsStarred(newStarred);
    setStarColor(newColor);
    onToggle?.(newStarred, newColor);
    setColorPickerOpen(false);
    setLoading(true);

    try {
      const result = await toggleStar(emailId, color);
      // Sync with server state
      setIsStarred(result.is_starred);
      setStarColor(result.star_color);
      onToggle?.(result.is_starred, result.star_color);
    } catch (error) {
      // Revert on error
      console.error("Failed to toggle star:", error);
      setIsStarred(previousStarred);
      setStarColor(previousColor);
      onToggle?.(previousStarred, previousColor);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  const currentColor = colors.find((c) => c.key === starColor);
  const starStyle = isStarred && currentColor ? { color: currentColor.hex } : {};

  if (!showColorPicker) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={buttonSize}
              style={starStyle}
              onClick={() => handleToggle()}
              disabled={loading}
            >
              {loading ? (
                <Spinner className={iconSize} />
              ) : isStarred ? (
                <Star className={cn(iconSize, "fill-current")} />
              ) : (
                <Star className={iconSize} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isStarred ? "Unstar" : "Star"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={buttonSize}
          style={starStyle}
          disabled={loading}
        >
          {loading ? (
            <Spinner className={iconSize} />
          ) : isStarred ? (
            <Star className={cn(iconSize, "fill-current")} />
          ) : (
            <Star className={iconSize} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex gap-1">
          {colors.map((color) => (
            <button
              key={color.key}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                starColor === color.key ? "border-foreground" : "border-transparent"
              )}
              style={{ backgroundColor: color.hex }}
              onClick={() => handleToggle(color.key)}
              title={color.label}
            />
          ))}
          {isStarred && (
            <>
              <div className="w-px bg-border mx-1" />
              <button
                className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted"
                onClick={() => handleToggle()}
                title="Remove star"
              >
                <StarOff className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Archive Button Component
interface ArchiveButtonProps {
  emailId: number;
  isArchived?: boolean;
  onToggle?: (isArchived: boolean) => void;
  size?: "sm" | "md";
}

export function ArchiveButton({ emailId, isArchived: initialArchived, onToggle, size = "md" }: ArchiveButtonProps) {
  const [isArchived, setIsArchived] = useState(initialArchived ?? false);
  const [loading, setLoading] = useState(false);

  // Sync with prop changes
  useEffect(() => {
    setIsArchived(initialArchived ?? false);
  }, [initialArchived]);

  const handleToggle = async () => {
    // Optimistic update
    const previousState = isArchived;
    const newState = !isArchived;
    setIsArchived(newState);
    onToggle?.(newState);
    setLoading(true);

    try {
      const result = await toggleArchive(emailId);
      // Sync with server state
      setIsArchived(result.is_archived);
      onToggle?.(result.is_archived);
    } catch (error) {
      // Revert on error
      console.error("Failed to toggle archive:", error);
      setIsArchived(previousState);
      onToggle?.(previousState);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(buttonSize, isArchived && "text-muted-foreground")}
            onClick={handleToggle}
            disabled={loading}
          >
            {loading ? (
              <Spinner className={iconSize} />
            ) : isArchived ? (
              <ArchiveRestore className={iconSize} />
            ) : (
              <Archive className={iconSize} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isArchived ? "Unarchive" : "Archive"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// VIP Button Component
interface VipButtonProps {
  emailAddress: string;
  senderName?: string;
  isVip?: boolean;
  onToggle?: (isVip: boolean) => void;
  size?: "sm" | "md";
}

export function VipButton({ emailAddress, senderName, isVip: initialVip, onToggle, size = "md" }: VipButtonProps) {
  const [isVip, setIsVip] = useState(initialVip ?? false);
  const [loading, setLoading] = useState(false);

  // Sync with prop changes
  useEffect(() => {
    setIsVip(initialVip ?? false);
  }, [initialVip]);

  const handleToggle = async () => {
    // Optimistic update
    const previousState = isVip;
    const newState = !isVip;
    setIsVip(newState);
    onToggle?.(newState);
    setLoading(true);

    try {
      const result = await toggleVip(emailAddress, senderName);
      // Sync with server state
      setIsVip(result.is_vip);
      onToggle?.(result.is_vip);
    } catch (error) {
      // Revert on error
      console.error("Failed to toggle VIP:", error);
      setIsVip(previousState);
      onToggle?.(previousState);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(buttonSize, isVip && "text-amber-500")}
            onClick={handleToggle}
            disabled={loading}
          >
            {loading ? (
              <Spinner className={iconSize} />
            ) : (
              <Crown className={cn(iconSize, isVip && "fill-current")} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isVip ? "Remove from VIP" : "Mark as VIP"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// VIP Badge Component
export function VipBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs",
        className
      )}
    >
      <Crown className="h-3 w-3 fill-current" />
      VIP
    </Badge>
  );
}

// Delete Button Component
interface DeleteButtonProps {
  emailId: number;
  onDelete?: () => void;
  size?: "sm" | "md";
}

export function DeleteButton({ emailId, onDelete, size = "md" }: DeleteButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteEmail(emailId);
      onDelete?.();
    } catch (error) {
      console.error("Failed to delete email:", error);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(buttonSize, "hover:text-red-500 dark:text-red-400 hover:bg-red-500/10")}
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <Spinner className={iconSize} />
            ) : (
              <Trash2 className={iconSize} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Spam Button Component
interface SpamButtonProps {
  emailId: number;
  onSpam?: () => void;
  size?: "sm" | "md";
}

export function SpamButton({ emailId, onSpam, size = "md" }: SpamButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSpam = async () => {
    setLoading(true);
    try {
      await markAsSpam(emailId, true); // Also delete from Outlook
      onSpam?.();
    } catch (error) {
      console.error("Failed to mark as spam:", error);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(buttonSize, "hover:text-orange-500 dark:text-orange-400 hover:bg-orange-500/10")}
            onClick={handleSpam}
            disabled={loading}
          >
            {loading ? (
              <Spinner className={iconSize} />
            ) : (
              <AlertOctagon className={iconSize} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Mark as Spam</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Mark Read/Unread Button Component
interface MarkReadButtonProps {
  emailId: number;
  isRead?: boolean;
  onToggle?: (isRead: boolean) => void;
  size?: "sm" | "md";
}

export function MarkReadButton({ emailId, isRead: initialRead, onToggle, size = "md" }: MarkReadButtonProps) {
  const [isRead, setIsRead] = useState(initialRead ?? false);
  const [loading, setLoading] = useState(false);

  // Sync with prop changes
  useEffect(() => {
    setIsRead(initialRead ?? false);
  }, [initialRead]);

  const handleToggle = async () => {
    // Optimistic update
    const previousState = isRead;
    const newState = !isRead;
    setIsRead(newState);
    onToggle?.(newState);
    setLoading(true);

    try {
      const result = await toggleRead(emailId);
      // Sync with server state
      setIsRead(result.is_read);
      onToggle?.(result.is_read);
    } catch (error) {
      // Revert on error
      console.error("Failed to toggle read status:", error);
      setIsRead(previousState);
      onToggle?.(previousState);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={buttonSize}
            onClick={handleToggle}
            disabled={loading}
          >
            {loading ? (
              <Spinner className={iconSize} />
            ) : isRead ? (
              <Mail className={iconSize} />
            ) : (
              <MailOpen className={iconSize} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isRead ? "Mark as Unread" : "Mark as Read"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Email Actions Bar Component (combines all actions)
interface EmailActionsBarProps {
  emailId: number;
  fromEmail?: string;
  fromName?: string;
  state?: Partial<EmailUserState>;
  onStateChange?: (state: EmailUserState) => void;
  showVip?: boolean;
  showReminder?: boolean;
  size?: "sm" | "md";
}

export function EmailActionsBar({
  emailId,
  fromEmail,
  fromName,
  state,
  onStateChange,
  showVip = true,
  showReminder = true,
  size = "md",
}: EmailActionsBarProps) {
  const [currentState, setCurrentState] = useState<Partial<EmailUserState>>(state || {});

  useEffect(() => {
    if (state) {
      setCurrentState(state);
    }
  }, [state]);

  const handleUpdate = (updates: Partial<EmailUserState>) => {
    const newState = { ...currentState, ...updates };
    setCurrentState(newState);
    onStateChange?.(newState as EmailUserState);
  };

  return (
    <div className="flex items-center gap-0.5">
      <PinButton
        emailId={emailId}
        isPinned={currentState.is_pinned}
        onToggle={(isPinned) => handleUpdate({ is_pinned: isPinned })}
        size={size}
      />
      <StarButton
        emailId={emailId}
        isStarred={currentState.is_starred}
        starColor={currentState.star_color}
        onToggle={(isStarred, starColor) => handleUpdate({ is_starred: isStarred, star_color: starColor })}
        size={size}
      />
      <ArchiveButton
        emailId={emailId}
        isArchived={currentState.is_archived}
        onToggle={(isArchived) => handleUpdate({ is_archived: isArchived })}
        size={size}
      />
      {showVip && fromEmail && (
        <VipButton
          emailAddress={fromEmail}
          senderName={fromName}
          isVip={currentState.from_vip}
          onToggle={(isVip) => handleUpdate({ from_vip: isVip })}
          size={size}
        />
      )}
      {showReminder && (
        <ReminderButton
          emailId={emailId}
          remindAt={currentState.remind_at}
          onReminderChange={(remindAt) => handleUpdate({ remind_at: remindAt })}
          size={size}
        />
      )}
    </div>
  );
}

// Hook for email state
export function useEmailState(emailId?: number) {
  const [state, setState] = useState<EmailUserState | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!emailId) return;

    setLoading(true);
    try {
      const data = await fetchEmailState(emailId);
      setState(data);
    } catch (error) {
      console.error("Failed to load email state:", error);
    } finally {
      setLoading(false);
    }
  }, [emailId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    state,
    loading,
    refresh: load,
    togglePin: async () => {
      if (!emailId) return;
      const result = await togglePin(emailId);
      setState(result);
      return result;
    },
    toggleStar: async (color?: string) => {
      if (!emailId) return;
      const result = await toggleStar(emailId, color);
      setState(result);
      return result;
    },
    toggleArchive: async () => {
      if (!emailId) return;
      const result = await toggleArchive(emailId);
      setState(result);
      return result;
    },
  };
}

export default EmailActionsBar;
