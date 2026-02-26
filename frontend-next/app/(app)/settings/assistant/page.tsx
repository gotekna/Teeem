"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  MessageSquare,
  Phone,
  Hash,
  MessageCircle,
  Clock,
  AlertTriangle,
  Zap,
  Loader2,
  Sunrise,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface AssistantPreferences {
  notification_channels?: string[];
  quiet_hours?: { start: string; end: string };
  autopilot_enabled?: boolean;
  autopilot_actions?: string[];
  priority_threshold?: string;
  daily_digest_enabled?: boolean;
  daily_digest_time?: string;
}

const NOTIFICATION_CHANNELS = [
  { key: "web", label: "Web", icon: Globe, description: "Browser notifications in TEEEM", alwaysOn: true },
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, description: "Receive alerts via WhatsApp" },
  { key: "sms", label: "SMS", icon: Phone, description: "Receive alerts via text message" },
  { key: "slack", label: "Slack", icon: Hash, description: "Receive alerts in Slack DMs" },
  { key: "signal", label: "Signal", icon: MessageCircle, description: "Receive alerts via Signal" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "all", label: "All notifications" },
  { value: "medium", label: "Medium and above" },
  { value: "high", label: "High and above" },
  { value: "critical", label: "Critical only" },
] as const;

const AUTOPILOT_ACTIONS = [
  { key: "create_task", label: "Create tasks" },
  { key: "update_task", label: "Update task status" },
  { key: "draft_email", label: "Draft emails" },
  { key: "send_sms", label: "Send SMS alerts" },
  { key: "send_slack", label: "Send Slack messages" },
] as const;

const QUIET_HOURS_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, "0");
  const label = i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`;
  return { value: `${hour}:00`, label };
});

export default function AssistantPreferencesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [prefs, setPrefs] = React.useState<AssistantPreferences>({
    notification_channels: ["web"],
    quiet_hours: { start: "21:00", end: "07:00" },
    autopilot_enabled: false,
    autopilot_actions: [],
    priority_threshold: "all",
    daily_digest_enabled: true,
    daily_digest_time: "06:30",
  });

  // Load preferences
  React.useEffect(() => {
    const loadPrefs = async () => {
      try {
        const response = await api.get<{ success: boolean; data: AssistantPreferences }>("/api/v1/assistant/preferences");
        if (response?.success && response.data) {
          setPrefs({
            notification_channels: response.data.notification_channels || ["web"],
            quiet_hours: response.data.quiet_hours || { start: "21:00", end: "07:00" },
            autopilot_enabled: response.data.autopilot_enabled || false,
            autopilot_actions: response.data.autopilot_actions || [],
            priority_threshold: response.data.priority_threshold || "all",
            daily_digest_enabled: response.data.daily_digest_enabled ?? true,
            daily_digest_time: response.data.daily_digest_time || "06:30",
          });
        }
      } catch (error) {
        console.error("[AssistantPreferences] Failed to load:", error);
      } finally {
        setLoading(false);
      }
    };
    loadPrefs();
  }, []);

  const savePrefs = async (updates: Partial<AssistantPreferences>) => {
    setSaving(true);
    const merged = { ...prefs, ...updates };
    setPrefs(merged);
    try {
      const response = await api.put<{ success: boolean; error?: string }>("/api/v1/assistant/preferences", merged);
      if (response?.success) {
        toast({ title: "Saved", description: "Assistant preferences updated." });
      } else {
        toast({ title: "Error", description: response?.error || "Failed to save", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save preferences", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (channelKey: string) => {
    const current = prefs.notification_channels || ["web"];
    const updated = current.includes(channelKey)
      ? current.filter((c) => c !== channelKey)
      : [...current, channelKey];
    // Web is always on
    if (!updated.includes("web")) updated.unshift("web");
    savePrefs({ notification_channels: updated });
  };

  const toggleAutopilotAction = (actionKey: string) => {
    const current = prefs.autopilot_actions || [];
    const updated = current.includes(actionKey)
      ? current.filter((a) => a !== actionKey)
      : [...current, actionKey];
    savePrefs({ autopilot_actions: updated });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Notification Channels */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Notification Channels</h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose how the AI Assistant delivers notifications and alerts to you.
            </p>
            {NOTIFICATION_CHANNELS.map((channel) => {
              const Icon = channel.icon;
              const isEnabled = prefs.notification_channels?.includes(channel.key) || false;
              const isAlwaysOn = "alwaysOn" in channel && channel.alwaysOn;

              return (
                <div key={channel.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Label>{channel.label}</Label>
                        {isAlwaysOn && (
                          <Badge variant="outline" className="text-xs">Always on</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{channel.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => toggleChannel(channel.key)}
                    disabled={isAlwaysOn || saving}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Daily Digest */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sunrise className="h-5 w-5" />
          Daily Digest
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Morning Briefing</Label>
                <p className="text-sm text-muted-foreground">
                  Receive a daily summary of tasks due, overdue items, email follow-ups, and pending approvals.
                </p>
              </div>
              <Switch
                checked={prefs.daily_digest_enabled ?? true}
                onCheckedChange={(checked) => savePrefs({ daily_digest_enabled: checked })}
                disabled={saving}
              />
            </div>

            {(prefs.daily_digest_enabled ?? true) && (
              <div className="border-t pt-4">
                <div className="space-y-1">
                  <Label>Delivery Time (Brisbane)</Label>
                  <Select
                    value={prefs.daily_digest_time || "06:30"}
                    onValueChange={(value) => savePrefs({ daily_digest_time: value })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["05:00", "05:30", "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00"].map(
                        (time) => (
                          <SelectItem key={time} value={time}>
                            {time} AEST
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Delivered to your enabled notification channels above.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quiet Hours */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Quiet Hours
        </h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Suppress non-critical notifications during these hours. Critical alerts will still come through.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1">
                <Label>Start</Label>
                <Select
                  value={prefs.quiet_hours?.start || "21:00"}
                  onValueChange={(value) =>
                    savePrefs({ quiet_hours: { start: value, end: prefs.quiet_hours?.end || "07:00" } })
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUIET_HOURS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground mt-6">to</span>
              <div className="space-y-1">
                <Label>End</Label>
                <Select
                  value={prefs.quiet_hours?.end || "07:00"}
                  onValueChange={(value) =>
                    savePrefs({ quiet_hours: { start: prefs.quiet_hours?.start || "21:00", end: value } })
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUIET_HOURS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Priority Threshold */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Priority Threshold
        </h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Only receive notifications at or above this priority level.
            </p>
            <Select
              value={prefs.priority_threshold || "all"}
              onValueChange={(value) => savePrefs({ priority_threshold: value })}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </section>

      {/* Autopilot */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Autopilot
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Autopilot</Label>
                <p className="text-sm text-muted-foreground">
                  Let the assistant automatically execute selected action types without requiring your approval.
                </p>
              </div>
              <Switch
                checked={prefs.autopilot_enabled || false}
                onCheckedChange={(checked) => savePrefs({ autopilot_enabled: checked })}
                disabled={saving}
              />
            </div>

            {prefs.autopilot_enabled && (
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select which actions the assistant can perform automatically:
                </p>
                {AUTOPILOT_ACTIONS.map((action) => {
                  const isEnabled = prefs.autopilot_actions?.includes(action.key) || false;
                  return (
                    <div key={action.key} className="flex items-center justify-between">
                      <Label className="font-normal">{action.label}</Label>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleAutopilotAction(action.key)}
                        disabled={saving}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Slack Connection */}
      {user && !user.slack_user_id && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Slack Connection
          </h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                Link your Slack account to receive assistant notifications and use the <code className="text-xs bg-muted px-1 py-0.5 rounded">/teeem</code> slash command.
              </p>
              <Button variant="outline" disabled>
                <Hash className="h-4 w-4 mr-2" />
                Connect Slack (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
