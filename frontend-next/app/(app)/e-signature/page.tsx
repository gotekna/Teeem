"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileSignature,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  AlertCircle,
  Users,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface ESignatureRequest {
  id: number;
  request_number: string;
  title: string;
  status: string;
  progress: number;
  signed_count: number;
  total_signers: number;
  sent_at: string | null;
  expires_at: string | null;
  completed_at: string | null;
  created_at: string;
  created_by: string;
}

interface ESignatureResponse {
  success: boolean;
  e_signature_requests: ESignatureRequest[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: <FileText className="h-3 w-3" /> },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700", icon: <Send className="h-3 w-3" /> },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-700", icon: <Clock className="h-3 w-3" /> },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  declined: { label: "Declined", color: "bg-red-100 text-red-700", icon: <XCircle className="h-3 w-3" /> },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500", icon: <AlertCircle className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500", icon: <XCircle className="h-3 w-3" /> },
};

export default function ESignaturePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["e-signature-requests", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const response = await api.get<ESignatureResponse>(`/api/v1/e_signature_requests${params}`);
      return response;
    },
  });

  const requests = data?.e_signature_requests || [];

  // Filter by search query
  const filteredRequests = requests.filter((req) =>
    req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.request_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const stats = {
    total: requests.length,
    pending: requests.filter((r) => ["sent", "in_progress"].includes(r.status)).length,
    completed: requests.filter((r) => r.status === "completed").length,
    draft: requests.filter((r) => r.status === "draft").length,
  };

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Header */}
      <div className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSignature className="h-6 w-6" />
              E-Signatures
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage electronic signature requests for contracts and documents
            </p>
          </div>
          <Link href="/e-signature/prepare">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 border-b shrink-0">
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Requests</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">Awaiting Signatures</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
            <div className="text-sm text-muted-foreground">Drafts</div>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b shrink-0 flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>Failed to load e-signature requests</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <FileSignature className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No e-signature requests</p>
            <p className="text-sm mt-1">Create your first request to get started</p>
            <Link href="/e-signature/prepare" className="mt-4">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => {
                const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.draft;

                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {request.request_number}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusConfig.color} gap-1`} variant="secondary">
                        {statusConfig.icon}
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {request.signed_count} / {request.total_signers}
                        </span>
                        {request.total_signers > 0 && (
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${request.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {request.expires_at
                        ? formatDistanceToNow(new Date(request.expires_at), { addSuffix: true })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/e-signature/${request.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
