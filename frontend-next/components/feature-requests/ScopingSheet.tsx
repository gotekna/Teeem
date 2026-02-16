"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Sparkles,
  Send,
  X,
  Check,
  Pencil,
  SkipForward,
  User,
  Bot,
} from "lucide-react";
import { MODAL_RESET_DELAY_MS, UI_ANIMATION_MEDIUM_MS } from "@/lib/constants/timeout-constants";

interface ScopingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onOpenQuickSubmit: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ScopingMeta {
  phase: "checking" | "scoping" | "ready";
  existingFeature?: string | null;
  duplicates?: number[];
  submission?: {
    title: string;
    category: string;
    description: string;
  };
}

// Parse <!--META:{...}--> from AI response
function parseMeta(content: string): { meta: ScopingMeta | null; visibleText: string } {
  const match = content.match(/<!--META:(.*?)-->/);
  if (!match) return { meta: null, visibleText: content };

  try {
    const meta = JSON.parse(match[1]) as ScopingMeta;
    const visibleText = content.replace(/<!--META:.*?-->/, "").trim();
    return { meta, visibleText };
  } catch {
    return { meta: null, visibleText: content };
  }
}

export function ScopingSheet({ open, onOpenChange, onSuccess, onOpenQuickSubmit }: ScopingSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<ScopingMeta["submission"] | null>(null);
  const [editingSubmission, setEditingSubmission] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, submission]);

  // Focus input when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), MODAL_RESET_DELAY_MS);
    }
  }, [open]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInput("");
      setSending(false);
      setSubmitting(false);
      setSubmission(null);
      setEditingSubmission(false);
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setSending(true);

    try {
      // Build history (exclude current message)
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      const res = await api.post<{ success: boolean; data: { content: string; source: string } }>(
        "/api/v1/feature_requests/scope",
        { message: text, history }
      );

      if (res?.success && res.data?.content) {
        const { meta, visibleText } = parseMeta(res.data.content);

        setMessages([...newMessages, { role: "assistant", content: visibleText }]);

        if (meta?.phase === "ready" && meta.submission) {
          setSubmission(meta.submission);
        }
      } else {
        setMessages([...newMessages, { role: "assistant", content: "Sorry, I had trouble processing that. Please try again." }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Something went wrong. You can use the quick submit form instead." }]);
    } finally {
      setSending(false);
    }
  }, [input, messages, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSubmit = async () => {
    const sub = editingSubmission
      ? { title: editTitle, description: editDescription, category: submission?.category || "feature" }
      : submission;

    if (!sub?.title) return;

    setSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; error?: string }>("/api/v1/feature_requests", {
        feature_request: {
          title: sub.title.trim(),
          description: sub.description?.trim() || null,
          category: sub.category,
        },
      });

      if (res?.success) {
        onOpenChange(false);
        onSuccess();
      }
    } catch {
      // Error handled by remaining in the sheet
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = () => {
    if (submission) {
      setEditTitle(submission.title);
      setEditDescription(submission.description);
      setEditingSubmission(true);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title="AI Feature Assistant" className="flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 dark:bg-purple-500/10 rounded-md">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">AI Feature Assistant</h2>
              <p className="text-xs text-muted-foreground">Helps you scope your request</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.length === 0 && !sending && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-full mb-3">
                <Sparkles className="h-6 w-6 text-purple-500 dark:text-purple-400" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">What feature would you like?</h3>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                Describe your idea and I&apos;ll help check if it already exists, find similar requests, and build a detailed description.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="shrink-0 mt-0.5">
                  <div className="h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              )}
              <div
                className={`rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="shrink-0 mt-0.5">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-2 justify-start">
              <div className="shrink-0 mt-0.5">
                <div className="h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Spinner className="h-4 w-4" />
              </div>
            </div>
          )}

          {/* Submission review card */}
          {submission && !editingSubmission && (
            <div className="border border-green-200 dark:border-green-500/20 bg-green-50/50 dark:bg-green-500/5 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">Ready to Submit</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" onClick={startEditing}>
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Title</p>
                <p className="text-sm font-medium text-foreground">{submission.title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{submission.description}</p>
              </div>
              <Button size="sm" className="w-full gap-1.5" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                Submit Request
              </Button>
            </div>
          )}

          {/* Editing submission */}
          {submission && editingSubmission && (
            <div className="border border-border bg-muted/30 rounded-lg p-3 space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Before Submitting</span>
              <div>
                <label className="text-xs text-muted-foreground">Title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-sm h-8"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full text-sm border border-input bg-background rounded-md px-3 py-2 min-h-[120px] resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1.5" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  Submit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingSubmission(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={messages.length === 0 ? "Describe your feature idea..." : "Type a message..."}
              disabled={sending}
              className="text-sm"
            />
            <Button size="sm" onClick={sendMessage} disabled={!input.trim() || sending} className="shrink-0 px-3">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <button
            onClick={() => {
              onOpenChange(false);
              setTimeout(onOpenQuickSubmit, UI_ANIMATION_MEDIUM_MS);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <SkipForward className="h-3 w-3" />
            Skip to quick submit
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
