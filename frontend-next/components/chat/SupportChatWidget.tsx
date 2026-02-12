"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sparkles, Send, Minus } from "lucide-react";
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

// ─── Types ───

interface SupportMessage {
  id: number;
  content: string;
  is_ai: boolean;
  created_at: string;
  formatted_timestamp?: string;
}

interface SupportResponse {
  success: boolean;
  data: {
    user_message: SupportMessage;
    ai_message: SupportMessage;
  };
}

interface SupportHistoryResponse {
  success: boolean;
  data: SupportMessage[];
}

// ─── Markdown Link Renderer ───

/** Parse markdown links [text](url) and **bold** into React elements */
export function renderMessageContent(content: string, onNavigate?: (path: string) => void) {
  // Match markdown links and bold text
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(content)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      elements.push(content.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // Markdown link: [text](url)
      const text = match[1];
      const url = match[2];
      const isInternal = url.startsWith("/");
      const linkClass = "text-violet-600 dark:text-violet-400 underline underline-offset-2 hover:text-violet-700 dark:hover:text-violet-300 font-medium cursor-pointer";
      elements.push(
        isInternal ? (
          <button
            key={`link-${key++}`}
            className={linkClass}
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.(url);
            }}
          >
            {text}
          </button>
        ) : (
          <a
            key={`link-${key++}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {text}
          </a>
        )
      );
    } else if (match[3]) {
      // Bold: **text**
      elements.push(<strong key={`bold-${key++}`}>{match[3]}</strong>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    elements.push(content.slice(lastIndex));
  }

  return elements.length > 0 ? elements : [content];
}

// ─── Sub-components ───

function AiAvatar({ size = "sm" }: { size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-9 w-9" : "h-7 w-7";
  const iconCls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className={cn(cls, "rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0")}>
      <Sparkles className={cn(iconCls, "text-white")} />
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function WelcomeMessage() {
  return (
    <div className="flex gap-2">
      <AiAvatar />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
          Teeem AI
          <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3 font-normal">AI</Badge>
        </div>
        <div className="rounded-lg px-3 py-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50">
          <p className="text-sm">Hi! I&apos;m your Teeem AI assistant. I can help you with:</p>
          <ul className="text-sm mt-1.5 space-y-0.5 list-disc list-inside text-muted-foreground">
            <li>Finding features and navigating Teeem</li>
            <li>How to create jobs, contacts, and documents</li>
            <li>Schedule Master and Gantt charts</li>
            <li>Email, chat, and integrations</li>
          </ul>
          <p className="text-sm mt-1.5">Just type your question below!</p>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg, isOwn, onNavigate }: { msg: SupportMessage; isOwn: boolean; onNavigate?: (path: string) => void }) {
  const rendered = useMemo(
    () => (!isOwn ? renderMessageContent(msg.content, onNavigate) : null),
    [msg.content, isOwn, onNavigate]
  );

  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div className={cn("flex gap-2 max-w-[85%]", isOwn && "flex-row-reverse")}>
        {!isOwn && <AiAvatar />}
        <div className="min-w-0">
          {!isOwn && (
            <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
              Teeem AI
              <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3 font-normal">AI</Badge>
            </div>
          )}
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
              isOwn
                ? "bg-primary text-primary-foreground"
                : "bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50"
            )}
          >
            {isOwn ? msg.content : rendered}
          </div>
          {msg.formatted_timestamp && (
            <div className={cn("text-[10px] mt-0.5", isOwn ? "text-right" : "", "text-muted-foreground")}>
              {msg.formatted_timestamp}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page Context ───

/** Map pathname to a friendly page name for the AI context hint */
function getPageName(pathname: string): string | null {
  const routes: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/jobs": "Jobs",
    "/contacts": "Contacts",
    "/documents": "Documents",
    "/email": "Email",
    "/chat": "Chat",
    "/cases": "Cases",
    "/estimates": "Estimates",
    "/purchase-orders": "Purchase Orders",
    "/schedule-master": "Schedule Master",
    "/tasks": "Task Hub",
    "/settings": "Settings",
    "/settings/users": "User Management",
    "/settings/company/info": "Company Info",
    "/settings/company/job-setup": "Job Setup",
    "/settings/company/warehouse-config": "Warehouse Config",
    "/settings/connections": "Connections",
    "/settings/connections/integrations": "Integrations",
    "/pricebook": "Pricebook",
    "/notebooks": "Notebooks",
  };

  // Exact match first
  if (routes[pathname]) return routes[pathname];

  // Match dynamic routes (e.g. /jobs/123 → "Job Details")
  if (/^\/jobs\/\d+/.test(pathname)) return "Job Details";
  if (/^\/contacts\/\d+/.test(pathname)) return "Contact Details";
  if (/^\/cases\/\d+/.test(pathname)) return "Case Details";
  if (/^\/estimates\/\d+/.test(pathname)) return "Estimate Details";
  if (/^\/purchase-orders\/\d+/.test(pathname)) return "Purchase Order Details";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/email")) return "Email";

  return null;
}

// ─── Main Component ───

interface SupportChatWidgetProps {
  /** Render as inline header button (true) or floating button (false) */
  inline?: boolean;
}

/**
 * SupportChatWidget - Standard AI support chat component
 *
 * Renders a popover-based chat interface for Teeem AI support.
 * Can be used inline (in header bar) or as a floating button.
 *
 * Usage:
 *   <SupportChatWidget inline={true} />  // In header
 *   <SupportChatWidget />                // Floating
 */
export function SupportChatWidget({ inline = false }: SupportChatWidgetProps) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevPathnameRef = useRef(pathname);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiThinking]);

  // Focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // When the user navigates while chat is open, show a context hint
  useEffect(() => {
    if (!isOpen || pathname === prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      return;
    }
    prevPathnameRef.current = pathname;

    // Derive a friendly page name from the pathname
    const pageName = getPageName(pathname);
    if (pageName) {
      const navMsg: SupportMessage = {
        id: Date.now() + 1,
        content: `I can see you're now on the **${pageName}** page. How can I help you here?`,
        is_ai: true,
        created_at: new Date().toISOString(),
        formatted_timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, navMsg]);
    }
  }, [pathname, isOpen]);

  // Load history when opened for the first time
  const loadHistory = useCallback(async () => {
    if (loaded) return;
    try {
      const response = await api.get<SupportHistoryResponse>("/api/v1/chat_messages/support_history");
      if (response?.data) {
        setMessages(response.data);
      }
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [loaded]);

  useEffect(() => {
    if (isOpen && !loaded) {
      loadHistory();
    }
  }, [isOpen, loaded, loadHistory]);

  // Navigate to an internal route — keep popover OPEN so AI can guide
  const handleNavigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || aiThinking || !user) return;

    // Optimistic user message
    const tempId = Date.now();
    const tempMsg: SupportMessage = {
      id: tempId,
      content,
      is_ai: false,
      created_at: new Date().toISOString(),
      formatted_timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage("");
    setAiThinking(true);

    try {
      const response = await api.post<SupportResponse>("/api/v1/chat_messages/support", { content, current_page: pathname });
      if (response?.data) {
        const { user_message, ai_message } = response.data;
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          user_message,
          ai_message,
        ]);
      }
    } catch {
      // Revert on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(content);
    } finally {
      setAiThinking(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            inline
              ? "p-1.5 text-muted-foreground hover:text-muted-foreground dark:hover:text-white rounded-md transition-colors relative"
              : "fixed bottom-6 right-20 z-40 p-3 bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-background"
          )}
          aria-label="AI Support Chat"
          title="Chat with Teeem AI"
        >
          <Sparkles className={cn(inline ? "h-4 w-4" : "h-5 w-5")} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-[380px] h-[480px] p-0 flex flex-col overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b bg-gradient-to-r from-violet-500/10 to-purple-500/10 shrink-0">
          <AiAvatar size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              Teeem Support
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 font-normal">AI</Badge>
            </div>
            <div className="text-xs text-muted-foreground">AI-powered support &bull; always online</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setIsOpen(false)}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="space-y-3">
            {messages.length === 0 && !aiThinking && <WelcomeMessage />}
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} isOwn={!msg.is_ai} onNavigate={handleNavigate} />
            ))}
            {aiThinking && (
              <div className="flex gap-2">
                <AiAvatar />
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Teeem AI</div>
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
            <Input
              ref={inputRef}
              placeholder="Ask Teeem AI a question..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 h-8 text-sm"
              disabled={aiThinking}
            />
            <Button
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleSend}
              disabled={!newMessage.trim() || aiThinking}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
