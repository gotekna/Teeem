"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  Send,
  Minus,
  Mic,
  MicOff,
  Check,
  X,
  Bell,
  ChevronDown,
  Loader2,
  Mail,
  ListTodo,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { renderMessageContent } from "./SupportChatWidget";
import { UI_ANIMATION_SHORT_MS } from "@/lib/constants/timeout-constants";

// ─── Types ───

interface AssistantAction {
  id: number;
  action_type: string;
  status: string;
  description: string;
  action_data: Record<string, unknown>;
  result_data: Record<string, unknown>;
  created_at: string;
}

interface AssistantAlert {
  id: number;
  alert_type: string;
  priority: string;
  status: string;
  title: string;
  summary: string;
  context_data: Record<string, unknown>;
  created_at: string;
}

interface AssistantMessage {
  id: number;
  role: "user" | "assistant" | "tool_result";
  content: string;
  content_type: string;
  tool_calls?: Array<{ name: string; input: Record<string, unknown> }> | null;
  created_at: string;
}

interface ChatResponse {
  success: boolean;
  data: {
    conversation_id: number;
    content: string;
    actions: AssistantAction[];
    tool_calls_made: string[];
  };
}

interface HistoryResponse {
  success: boolean;
  data: {
    conversation: { id: number; title: string };
    messages: AssistantMessage[];
  };
}

// ─── Sub-components ───

function AssistantAvatar({ size = "sm" }: { size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-9 w-9" : "h-7 w-7";
  const iconCls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div
      className={cn(
        cls,
        "rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0"
      )}
    >
      <Bot className={cn(iconCls, "text-white")} />
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Thinking...</span>
    </div>
  );
}

function ToolCallBadge({ name }: { name: string }) {
  const icons: Record<string, typeof Mail> = {
    search_emails: Mail,
    get_my_tasks: ListTodo,
    get_overdue_tasks: AlertTriangle,
    draft_email: Mail,
    draft_sms: MessageSquare,
    create_task: ListTodo,
    update_task: ListTodo,
  };
  const Icon = icons[name] || Bot;

  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1 font-normal">
      <Icon className="h-2.5 w-2.5" />
      {name.replace(/_/g, " ")}
    </Badge>
  );
}

function ActionCard({
  action,
  onApprove,
  onReject,
}: {
  action: AssistantAction;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const isPending = action.status === "pending";

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 text-sm",
        isPending
          ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
          : action.status === "executed"
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
          : "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <Badge
          variant={isPending ? "outline" : "secondary"}
          className="text-[10px] px-1.5 py-0 h-4"
        >
          {action.action_type.replace(/_/g, " ")}
        </Badge>
        <span className="text-[10px] text-muted-foreground capitalize">
          {action.status}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-1.5">{action.description}</p>

      {/* Show action data preview */}
      {action.action_data && (
        <div className="text-xs bg-background/50 rounded p-1.5 mb-1.5 font-mono">
          {action.action_type === "draft_email" && (
            <>
              <div>To: {String(action.action_data.to || "")}</div>
              <div>Subject: {String(action.action_data.subject || "")}</div>
              <div className="truncate">
                {String(action.action_data.body || "").slice(0, 100)}...
              </div>
            </>
          )}
          {action.action_type === "create_task" && (
            <>
              <div>Task: {String(action.action_data.name || "")}</div>
              {action.action_data.end_date && (
                <div>Due: {String(action.action_data.end_date)}</div>
              )}
            </>
          )}
          {action.action_type === "draft_sms" && (
            <>
              <div>To: {String(action.action_data.to || "")}</div>
              <div>{String(action.action_data.body || "")}</div>
            </>
          )}
        </div>
      )}

      {isPending && (
        <div className="flex gap-1.5 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs px-2 gap-1"
            onClick={() => onReject(action.id)}
          >
            <X className="h-3 w-3" />
            Reject
          </Button>
          <Button
            size="sm"
            className="h-6 text-xs px-2 gap-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => onApprove(action.id)}
          >
            <Check className="h-3 w-3" />
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}

function AlertCard({
  alert,
  onDismiss,
}: {
  alert: AssistantAlert;
  onDismiss: (id: number) => void;
}) {
  const priorityColors: Record<string, string> = {
    critical: "border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/30",
    high: "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30",
    medium: "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30",
    low: "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30",
  };

  return (
    <div className={cn("rounded-lg border p-2.5 text-sm", priorityColors[alert.priority] || "")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Bell className="h-3 w-3 shrink-0" />
          <span className="text-xs font-medium truncate">{alert.title}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 shrink-0"
          onClick={() => onDismiss(alert.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      {alert.summary && (
        <p className="text-xs text-muted-foreground mt-1">{alert.summary}</p>
      )}
    </div>
  );
}

function WelcomeMessage() {
  return (
    <div className="flex gap-2">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
          TEEEM Assistant
          <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3 font-normal">
            AI
          </Badge>
        </div>
        <div className="rounded-lg px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
          <p className="text-sm">
            Hey! I&apos;m your smart assistant. I can help you with:
          </p>
          <ul className="text-sm mt-1.5 space-y-0.5 list-disc list-inside text-muted-foreground">
            <li>&quot;What&apos;s due this week?&quot; - check your tasks</li>
            <li>&quot;Email John about the delay&quot; - draft replies</li>
            <li>&quot;Is Harold on track?&quot; - schedule analysis</li>
            <li>&quot;Chase the plumber&quot; - create follow-up tasks</li>
          </ul>
          <p className="text-sm mt-1.5 text-muted-foreground">
            Type or tap the mic to get started.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Voice Input Hook ───

function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-AU";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      setTranscript(result[0].transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  const isSupported =
    typeof window !== "undefined" &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    clearTranscript,
    isSupported,
  };
}

// ─── Main Component ───

interface AssistantChatProps {
  inline?: boolean;
}

export function AssistantChat({ inline = false }: AssistantChatProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pendingActions, setPendingActions] = useState<AssistantAction[]>([]);
  const [alerts, setAlerts] = useState<AssistantAlert[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const voice = useVoiceInput();

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), UI_ANIMATION_SHORT_MS);
    }
  }, [isOpen]);

  // Load alerts when opened
  useEffect(() => {
    if (isOpen) {
      loadAlerts();
    }
  }, [isOpen]);

  // When voice transcript changes, update input
  useEffect(() => {
    if (voice.transcript) {
      setNewMessage(voice.transcript);
    }
  }, [voice.transcript]);

  const loadAlerts = async () => {
    try {
      const response = await api.get<{ success: boolean; data: AssistantAlert[] }>(
        "/api/v1/assistant/alerts"
      );
      if (response?.data) {
        setAlerts(response.data);
      }
    } catch {
      // Alerts loading is non-critical
    }
  };

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || isThinking || !user) return;

    // If voice was active, stop it
    if (voice.isListening) {
      voice.stopListening();
    }
    voice.clearTranscript();

    // Add optimistic user message
    const tempMsg: AssistantMessage = {
      id: Date.now(),
      role: "user",
      content,
      content_type: voice.transcript ? "voice_transcript" : "text",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage("");
    setIsThinking(true);
    setToolsUsed([]);

    try {
      const response = await api.post<ChatResponse>("/api/v1/assistant/chat", {
        message: content,
        conversation_id: conversationId,
      });

      if (response?.data) {
        const { conversation_id: convId, content: aiContent, actions, tool_calls_made } = response.data;

        setConversationId(convId);
        setToolsUsed(tool_calls_made);

        // Add the assistant's response
        const aiMsg: AssistantMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: aiContent,
          content_type: "text",
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);

        // Update pending actions
        if (actions.length > 0) {
          setPendingActions((prev) => [...prev, ...actions]);
        }
      }
    } catch {
      const errorMsg: AssistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: "Sorry, I couldn't process that. Please try again.",
        content_type: "text",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleApproveAction = async (actionId: number) => {
    try {
      await api.post(`/api/v1/assistant/actions/${actionId}/approve`);
      setPendingActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, status: "executed" } : a))
      );
    } catch {
      // Show error in chat
    }
  };

  const handleRejectAction = async (actionId: number) => {
    try {
      await api.post(`/api/v1/assistant/actions/${actionId}/reject`);
      setPendingActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, status: "rejected" } : a))
      );
    } catch {
      // Show error in chat
    }
  };

  const handleDismissAlert = async (alertId: number) => {
    try {
      await api.post(`/api/v1/assistant/alerts/${alertId}/dismiss`);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      // Non-critical
    }
  };

  const handleVoiceToggle = () => {
    if (voice.isListening) {
      voice.stopListening();
      // Auto-send after voice input stops (if there's content)
      if (voice.transcript.trim()) {
        setTimeout(() => handleSend(), 300);
      }
    } else {
      voice.startListening();
    }
  };

  const alertCount = alerts.filter((a) => a.status === "pending").length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            inline
              ? "p-1.5 text-muted-foreground hover:text-muted-foreground dark:hover:text-white rounded-md transition-colors relative"
              : "fixed bottom-6 right-6 z-40 p-3 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-background"
          )}
          aria-label="AI Assistant"
          title="TEEEM AI Assistant"
        >
          <Bot className={cn(inline ? "h-4 w-4" : "h-5 w-5")} />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {alertCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-[420px] h-[540px] p-0 flex flex-col overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b bg-gradient-to-r from-emerald-500/10 to-teal-500/10 shrink-0">
          <AssistantAvatar size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              TEEEM Assistant
              <Badge
                variant="secondary"
                className="text-[9px] px-1 py-0 h-3.5 font-normal"
              >
                AI
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Smart assistant &bull; powered by Claude
            </div>
          </div>
          <div className="flex items-center gap-1">
            {alertCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 relative"
                onClick={() => setShowAlerts(!showAlerts)}
              >
                <Bell className="h-3.5 w-3.5" />
                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {alertCount}
                </span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setIsOpen(false)}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Alerts panel (slides down when active) */}
        {showAlerts && alerts.length > 0 && (
          <div className="border-b px-3 py-2 space-y-2 max-h-[160px] overflow-y-auto bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Alerts</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs px-1"
                onClick={() => setShowAlerts(false)}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={handleDismissAlert}
              />
            ))}
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="space-y-3">
            {messages.length === 0 && !isThinking && <WelcomeMessage />}

            {messages.map((msg) => {
              if (msg.role === "tool_result") return null;

              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={cn("flex", isUser ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "flex gap-2 max-w-[85%]",
                      isUser && "flex-row-reverse"
                    )}
                  >
                    {!isUser && <AssistantAvatar />}
                    <div className="min-w-0">
                      {!isUser && (
                        <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                          TEEEM Assistant
                          <Badge
                            variant="secondary"
                            className="text-[8px] px-1 py-0 h-3 font-normal"
                          >
                            AI
                          </Badge>
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
                          isUser
                            ? "bg-primary text-primary-foreground"
                            : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50"
                        )}
                      >
                        {isUser
                          ? msg.content
                          : renderMessageContent(msg.content)}
                      </div>
                      {msg.content_type === "voice_transcript" && isUser && (
                        <div className="flex items-center gap-1 mt-0.5 justify-end">
                          <Mic className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            voice
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Tool calls used indicator */}
            {toolsUsed.length > 0 && !isThinking && (
              <div className="flex flex-wrap gap-1 px-9">
                {toolsUsed.map((tool, i) => (
                  <ToolCallBadge key={i} name={tool} />
                ))}
              </div>
            )}

            {/* Pending actions */}
            {pendingActions
              .filter((a) => a.status === "pending")
              .map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onApprove={handleApproveAction}
                  onReject={handleRejectAction}
                />
              ))}

            {isThinking && (
              <div className="flex gap-2">
                <AssistantAvatar />
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">
                    TEEEM Assistant
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-secondary">
                    <ThinkingDots />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="px-3 py-2 border-t shrink-0">
          <div className="flex items-center gap-1.5">
            {voice.isSupported && (
              <Button
                size="sm"
                variant={voice.isListening ? "destructive" : "outline"}
                className={cn("h-8 w-8 p-0 shrink-0", voice.isListening && "animate-pulse")}
                onClick={handleVoiceToggle}
                title={voice.isListening ? "Stop listening" : "Voice input"}
              >
                {voice.isListening ? (
                  <MicOff className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            <Input
              ref={inputRef}
              placeholder={
                voice.isListening
                  ? "Listening..."
                  : "Ask your assistant anything..."
              }
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 h-8 text-sm"
              disabled={isThinking}
            />
            <Button
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={handleSend}
              disabled={!newMessage.trim() || isThinking}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
