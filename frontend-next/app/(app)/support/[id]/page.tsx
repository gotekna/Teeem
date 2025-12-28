"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Clock,
  CheckCircle,
  MessageSquare,
  Send,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";

interface Comment {
  id: number;
  body: string;
  created_at: string;
  author_name: string | null;
}

interface Ticket {
  id: number;
  task_number: number;
  name: string;
  description: string | null;
  status: string;
  ticket_priority: string;
  ticket_category: string;
  created_at: string;
  updated_at: string;
  sla_status: string;
  comments: Comment[];
}

export default function SupportTicketDetail() {
  const params = useParams();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const loadTicket = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: Ticket }>(
        `/api/v1/support_tickets/${params.id}`
      );
      if (res?.success) {
        setTicket(res.data);
      }
    } catch (err) {
      console.error("Failed to load ticket:", err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/api/v1/support_tickets/${params.id}/comments`, {
        body: newComment,
      });
      setNewComment("");
      loadTicket();
      toast({ title: "Comment added" });
    } catch (err) {
      console.error("Failed to add comment:", err);
      toast({ title: "Error", description: "Failed to add comment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Resolved</Badge>;
      case "started":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">In Progress</Badge>;
      default:
        return <Badge variant="outline">Open</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ticket not found</p>
        <BackButton fallbackHref="/support" label="Back to Support" />
      </div>
    );
  }

  return (
    <TablePage>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="mb-2">
            <BackButton fallbackHref="/support" label="Back to Support" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-muted-foreground">#{ticket.task_number}</span>
              <h1 className="text-2xl font-bold">{ticket.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              {getPriorityBadge(ticket.ticket_priority)}
              {getStatusBadge(ticket.status)}
            </div>
          </div>
        </div>

        {/* Ticket Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="px-2 py-0.5 bg-muted rounded">{ticket.ticket_category}</span>
              <span>Created {formatDate(ticket.created_at)}</span>
            </div>
            {ticket.description && (
              <p className="whitespace-pre-wrap">{ticket.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ticket.comments && ticket.comments.length > 0 ? (
              <div className="space-y-4 mb-6">
                {ticket.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {comment.author_name?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{comment.author_name || "Support"}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No comments yet</p>
            )}

            {ticket.status !== "completed" && (
              <div className="flex gap-2 pt-4 border-t">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddComment()}
                />
                <Button onClick={handleAddComment} disabled={submitting || !newComment.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}

            {ticket.status === "completed" && (
              <div className="text-center py-4 bg-green-500/10 rounded-lg mt-4">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-green-600">This ticket has been resolved</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TablePage>
  );
}
