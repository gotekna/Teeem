"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Brain,
  Phone,
  Mic,
  Hash,
  MessageCircle,
  CheckCircle2,
  XCircle,
  TestTube,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface ServiceStatus {
  connected: boolean;
  model?: string;
  phone?: string;
  bot_name?: string;
}

interface AssistantStatus {
  claude: ServiceStatus;
  twilio: ServiceStatus;
  deepgram: ServiceStatus;
  slack: ServiceStatus;
  signal: ServiceStatus;
  assistant_enabled: boolean;
}

const SERVICES = [
  {
    key: "claude" as const,
    name: "Claude AI",
    description: "AI language model powering the assistant's intelligence, tool use, and natural language understanding.",
    icon: Brain,
    color: "purple",
    configurable: false,
    readOnlyNote: "Configured at platform level",
  },
  {
    key: "twilio" as const,
    name: "SMS / WhatsApp",
    description: "Send and receive SMS and WhatsApp messages through Twilio. Configure in the Twilio section below.",
    icon: Phone,
    color: "green",
    configurable: false,
    readOnlyNote: "Configure in Connections > Integrations",
  },
  {
    key: "deepgram" as const,
    name: "Deepgram",
    description: "Voice-to-text transcription for WhatsApp voice notes and phone calls using Deepgram Nova-3.",
    icon: Mic,
    color: "blue",
    configurable: true,
    fields: [
      { key: "deepgram_api_key", label: "API Key", type: "password", placeholder: "Enter your Deepgram API key" },
    ],
  },
  {
    key: "slack" as const,
    name: "Slack",
    description: "Bot integration for Slack workspaces. Receive alerts, run slash commands, and chat with the assistant.",
    icon: Hash,
    color: "amber",
    configurable: true,
    fields: [
      { key: "slack_bot_token", label: "Bot Token", type: "password", placeholder: "xoxb-..." },
      { key: "slack_signing_secret", label: "Signing Secret", type: "password", placeholder: "Enter signing secret" },
    ],
  },
  {
    key: "signal" as const,
    name: "Signal",
    description: "End-to-end encrypted messaging via Signal. Requires Signal CLI REST API infrastructure.",
    icon: MessageCircle,
    color: "slate",
    configurable: false,
    readOnlyNote: "Configured at platform level",
  },
] as const;

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  purple: { bg: "bg-purple-100 dark:bg-purple-900", text: "text-purple-600 dark:text-purple-400" },
  green: { bg: "bg-green-100 dark:bg-green-900", text: "text-green-600 dark:text-green-400" },
  blue: { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-600 dark:text-blue-400" },
  amber: { bg: "bg-amber-100 dark:bg-amber-900", text: "text-amber-600 dark:text-amber-400" },
  slate: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" },
};

export function AIAssistantSetupTab() {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<AssistantStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [expandedCard, setExpandedCard] = React.useState<string | null>(null);
  const [formValues, setFormValues] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState<string | null>(null);
  const [assistantEnabled, setAssistantEnabled] = React.useState(false);
  const [savingEnabled, setSavingEnabled] = React.useState(false);

  // Fetch status on mount
  React.useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await api.get<{ success: boolean; data: AssistantStatus }>("/api/v1/assistant/status");
      if (response?.success && response.data) {
        setStatus(response.data);
        setAssistantEnabled(response.data.assistant_enabled);
      }
    } catch (error) {
      console.error("[AIAssistantSetup] Failed to fetch status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (serviceKey: string) => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      const service = SERVICES.find((s) => s.key === serviceKey);
      if (service && "fields" in service && service.fields) {
        for (const field of service.fields) {
          if (formValues[field.key]) {
            payload[field.key] = formValues[field.key];
          }
        }
      }

      const response = await api.put<{ success: boolean; error?: string }>("/api/v1/assistant/setup", payload);
      if (response?.success) {
        toast({ title: "Saved", description: `${service?.name} credentials updated successfully.` });
        // Clear form and re-fetch status
        setFormValues({});
        await fetchStatus();
      } else {
        toast({ title: "Error", description: response?.error || "Failed to save", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save credentials", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (serviceKey: string) => {
    setTesting(serviceKey);
    try {
      // Re-fetch status to check connection
      const response = await api.get<{ success: boolean; data: AssistantStatus }>("/api/v1/assistant/status");
      if (response?.success && response.data) {
        setStatus(response.data);
        const serviceStatus = response.data[serviceKey as keyof AssistantStatus] as ServiceStatus;
        if (serviceStatus?.connected) {
          toast({ title: "Connected", description: `${serviceKey} connection verified successfully.` });
        } else {
          toast({ title: "Not Connected", description: `${serviceKey} connection failed. Check your credentials.`, variant: "destructive" });
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to test connection", variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const handleToggleAssistant = async (checked: boolean) => {
    setSavingEnabled(true);
    setAssistantEnabled(checked);
    try {
      const response = await api.put<{ success: boolean; error?: string }>("/api/v1/assistant/setup", {
        assistant_enabled: checked,
      });
      if (response?.success) {
        toast({
          title: checked ? "AI Assistant enabled" : "AI Assistant disabled",
          description: checked
            ? "The AI Assistant is now active for your organization."
            : "The AI Assistant has been disabled.",
        });
      } else {
        setAssistantEnabled(!checked);
        toast({ title: "Error", description: response?.error || "Failed to update", variant: "destructive" });
      }
    } catch (error) {
      setAssistantEnabled(!checked);
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" });
    } finally {
      setSavingEnabled(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedCard(expandedCard === key ? null : key);
  };

  return (
    <div className="space-y-6">
      {/* Master Enable Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">AI Assistant</Label>
              <p className="text-sm text-muted-foreground">
                Enable the AI-powered construction assistant for your organization
              </p>
            </div>
            <Switch
              checked={assistantEnabled}
              onCheckedChange={handleToggleAssistant}
              disabled={loading || savingEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Service Status Description */}
      <p className="text-sm text-muted-foreground">
        Configure the services that power the AI Assistant. Some services are managed at the platform level, while others can be configured per-organization.
      </p>

      {/* Service Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          const colors = COLOR_MAP[service.color];
          const serviceStatus = status?.[service.key] as ServiceStatus | undefined;
          const isExpanded = expandedCard === service.key;
          const isConfigurable = service.configurable;

          return (
            <Card
              key={service.key}
              className={`transition-colors ${isConfigurable ? "cursor-pointer hover:bg-accent/50" : ""}`}
            >
              <CardHeader
                className={isConfigurable ? "cursor-pointer" : ""}
                onClick={isConfigurable ? () => toggleExpand(service.key) : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${colors.bg} rounded-lg`}>
                      <Icon className={`h-6 w-6 ${colors.text}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {isConfigurable ? "Configurable" : "Platform managed"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!loading && (
                      serviceStatus?.connected ? (
                        <Badge className="bg-status-success text-status-success-foreground hover:bg-green-100">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Connected
                        </Badge>
                      )
                    )}
                    {isConfigurable && (
                      isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{service.description}</p>

                {/* Extra info for connected services */}
                {!loading && serviceStatus?.connected && (
                  <div className="mt-2">
                    {serviceStatus.model && (
                      <p className="text-xs font-mono text-purple-700 dark:text-purple-400">
                        Model: {serviceStatus.model}
                      </p>
                    )}
                    {serviceStatus.phone && (
                      <p className="text-xs font-mono text-green-700 dark:text-green-400">
                        Phone: {serviceStatus.phone}
                      </p>
                    )}
                    {serviceStatus.bot_name && (
                      <p className="text-xs font-mono text-amber-700 dark:text-amber-400">
                        Bot: {serviceStatus.bot_name}
                      </p>
                    )}
                  </div>
                )}

                {/* Read-only note */}
                {!isConfigurable && "readOnlyNote" in service && (
                  <p className="text-xs text-muted-foreground mt-2 italic">{service.readOnlyNote}</p>
                )}

                {/* Expandable config form */}
                {isConfigurable && isExpanded && "fields" in service && service.fields && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    {service.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={formValues[field.key] || ""}
                          onChange={(e) =>
                            setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(service.key)}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestConnection(service.key)}
                        disabled={testing === service.key}
                      >
                        {testing === service.key ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4 mr-1" />
                        )}
                        Test Connection
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="space-y-1">
            <p className="font-medium text-foreground">Deepgram (Voice Transcription)</p>
            <p>
              Sign up at{" "}
              <a href="https://console.deepgram.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 hover:underline">
                console.deepgram.com
                <ExternalLink className="h-3 w-3" />
              </a>
              {" "}and create an API key. Cost is approximately $0.004/minute.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">Slack (Bot Integration)</p>
            <p>
              Create a Slack App at{" "}
              <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 hover:underline">
                api.slack.com/apps
                <ExternalLink className="h-3 w-3" />
              </a>
              . Enable Bot Token scopes: <code className="text-xs bg-muted px-1 py-0.5 rounded">chat:write</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">commands</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">app_mentions:read</code>.
              Then copy the Bot Token and Signing Secret.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
