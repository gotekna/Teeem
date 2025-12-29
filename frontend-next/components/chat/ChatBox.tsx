"use client";

import * as React from "react";
import { Send, X, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: number;
  content: string;
  created_at: string;
  formatted_timestamp?: string;
  saved_to_job?: boolean;
  construction_id?: number;
  user?: {
    id: number;
    name?: string;
    email: string;
  };
}

interface Construction {
  id: number;
  title: string;
}

interface ChatBoxProps {
  channel?: string;
  projectId?: number | null;
  userId?: number | null;
  title?: string;
  onClose?: () => void;
  showSaveToJob?: boolean;
}

export function ChatBox({
  channel = "general",
  projectId = null,
  userId = null,
  title = "Chat",
  onClose,
  showSaveToJob = false,
}: ChatBoxProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [savingMessageId, setSavingMessageId] = React.useState<number | null>(null);
  const [constructions, setConstructions] = React.useState<Construction[]>([]);
  const [showJobSelector, setShowJobSelector] = React.useState<number | null>(null);
  const [showConversationJobSelector, setShowConversationJobSelector] = React.useState(false);
  const [savingConversation, setSavingConversation] = React.useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    try {
      const params: Record<string, string | number> = {};
      if (projectId) {
        params.project_id = projectId;
      } else if (userId) {
        params.user_id = userId;
      } else {
        params.channel = channel;
      }
      const response = await api.get<ChatMessage[]>("/api/v1/chat_messages", { params });
      setMessages(Array.isArray(response) ? response : []);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      setMessages([]);
      setLoading(false);
    }
  };

  const loadConstructions = async () => {
    try {
      const response = await api.get<{ constructions: Construction[] }>("/api/v1/jobs", {
        params: { status: "Active", per_page: 100 },
      });
      setConstructions(response?.constructions || []);
    } catch (error) {
      console.error("Failed to load constructions:", error);
      setConstructions([]);
    }
  };

  React.useEffect(() => {
    fetchMessages();

    // Poll for new messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000);

    // Load constructions for job selector if showSaveToJob is enabled
    if (showSaveToJob) {
      loadConstructions();
    }

    return () => {
      clearInterval(interval);
    };
     
  }, [channel, projectId, userId, showSaveToJob]);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const payload = {
        chat_message: {
          content: newMessage,
          ...(projectId && { project_id: projectId }),
          ...(userId && { recipient_user_id: userId }),
          ...(channel && !userId && !projectId && { channel: channel }),
        },
      };

      const response = await api.post<ChatMessage>("/api/v1/chat_messages", payload);
      if (response) {
        setMessages([...messages, response]);
      }
      setNewMessage("");
      scrollToBottom();

      // Mark messages as read
      try {
        await api.post("/api/v1/chat_messages/mark_as_read", {});
      } catch (markReadError) {
        console.error("Failed to mark messages as read:", markReadError);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleSaveToJob = async (messageId: number, constructionId: number) => {
    setSavingMessageId(messageId);
    try {
      await api.post(`/api/v1/chat_messages/${messageId}/save_to_job`, {
        construction_id: constructionId,
      });

      setMessages(
        messages.map((msg) =>
          msg.id === messageId
            ? { ...msg, saved_to_job: true, construction_id: constructionId }
            : msg
        )
      );

      setShowJobSelector(null);
    } catch (error) {
      console.error("Failed to save message to job:", error);
    } finally {
      setSavingMessageId(null);
    }
  };

  const handleSaveConversationToJob = async (constructionId: number) => {
    setSavingConversation(true);
    try {
      const messageIds = messages.map((msg) => msg.id);
      await api.post("/api/v1/chat_messages/save_conversation_to_job", {
        construction_id: constructionId,
        message_ids: messageIds,
      });

      setMessages(
        messages.map((msg) => ({
          ...msg,
          saved_to_job: true,
          construction_id: constructionId,
        }))
      );

      setShowConversationJobSelector(false);
    } catch (error) {
      console.error("Failed to save conversation to job:", error);
    } finally {
      setSavingConversation(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {projectId ? "Project Chat" : userId ? "Direct Message" : "Channel"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showSaveToJob && messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConversationJobSelector(!showConversationJobSelector)}
              className="text-xs"
            >
              <Bookmark className="h-4 w-4 mr-1" />
              Save Conversation
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Conversation Job Selector Dropdown */}
      {showConversationJobSelector && (
        <div className="mx-4 mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Save all {messages.length} messages in this conversation to:
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {constructions.map((construction) => (
              <button
                key={construction.id}
                onClick={() => handleSaveConversationToJob(construction.id)}
                disabled={savingConversation}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-gray-900 dark:text-white disabled:opacity-50"
              >
                {construction.title}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowConversationJobSelector(false)}
            className="mt-2 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size={24} className="text-gray-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-2">No messages yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const userName = message?.user?.name || message?.user?.email || "Unknown User";
              const timestamp =
                message?.formatted_timestamp ||
                new Date(message?.created_at).toLocaleString();
              const isSaved = message?.saved_to_job;

              return (
                <div key={message.id} className="flex flex-col space-y-1 group">
                  <div className="flex items-baseline space-x-2">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">
                      {userName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{timestamp}</span>
                    {isSaved && (
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Bookmark className="h-3 w-3 fill-current" />
                        Saved to job
                      </span>
                    )}
                    {showSaveToJob && !isSaved && (
                      <button
                        onClick={() => setShowJobSelector(message.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 transition-opacity"
                        title="Save to job"
                      >
                        <Bookmark className="h-3 w-3" />
                        Save to job
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {message.content}
                  </div>

                  {/* Job selector dropdown */}
                  {showJobSelector === message.id && (
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select a job to save this message to:
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {constructions.map((construction) => (
                          <button
                            key={construction.id}
                            onClick={() => handleSaveToJob(message.id, construction.id)}
                            disabled={savingMessageId === message.id}
                            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-gray-900 dark:text-white disabled:opacity-50"
                          >
                            {construction.title}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setShowJobSelector(null)}
                        className="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${projectId ? "team" : userId ? "user" : `#${channel}`}...`}
            rows={1}
            className="flex-1 resize-none min-h-[40px]"
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !newMessage.trim()}>
            {sending ? (
              <Spinner />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
