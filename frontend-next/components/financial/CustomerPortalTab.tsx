"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  Users,
  Key,
  FileText,
  CreditCard,
  Plus,
  Copy,
  Check,
  ExternalLink,
  XCircle,
  Send,
  Calendar,
  Clock,
  User,
  Mail,
  Trash2,
  Link2,
  Shield,
  Building,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/formatters";

interface Contact {
  id: number;
  name: string;
  email?: string;
}

interface PortalToken {
  id: number;
  token: string;
  token_type: string;
  status: string;
  expires_at: string;
  accessed_at: string | null;
  access_count: number;
  created_at: string;
  contact: Contact;
  invoice_id?: number;
}

interface CustomerStatement {
  id: number;
  statement_date: string;
  opening_balance: number;
  closing_balance: number;
  total_invoiced: number;
  total_payments: number;
  status: string;
  sent_at: string | null;
  created_at: string;
  contact: Contact;
}

interface DirectDebitMandate {
  id: number;
  status: string;
  frequency: string;
  account_name: string;
  bsb_last_4: string;
  account_last_4: string;
  authorized_at: string;
  cancelled_at: string | null;
  created_at: string;
  contact: Contact;
}

export default function CustomerPortalTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tokens, setTokens] = useState<PortalToken[]>([]);
  const [statements, setStatements] = useState<CustomerStatement[]>([]);
  const [directDebits, setDirectDebits] = useState<DirectDebitMandate[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Active view
  const [activeView, setActiveView] = useState<"tokens" | "statements" | "debits">("tokens");

  // Copy state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Generate Token Dialog
  const [generateTokenOpen, setGenerateTokenOpen] = useState(false);
  const [tokenContactId, setTokenContactId] = useState("");
  const [tokenType, setTokenType] = useState("portal");
  const [tokenExpiresIn, setTokenExpiresIn] = useState("30");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Generate Statement Dialog
  const [generateStatementOpen, setGenerateStatementOpen] = useState(false);
  const [statementContactId, setStatementContactId] = useState("");
  const [statementAsOf, setStatementAsOf] = useState(new Date().toISOString().split("T")[0]);

  // Confirm Dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; id: number } | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      // Fetch tokens
      const tokensResponse = await api.get<{
        success: boolean;
        data: PortalToken[];
      }>("/api/v1/gl/customer_portal/tokens");

      if (tokensResponse?.success) {
        setTokens(tokensResponse.data || []);
      }

      // Fetch statements
      const statementsResponse = await api.get<{
        success: boolean;
        data: CustomerStatement[];
      }>("/api/v1/gl/customer_portal/statements");

      if (statementsResponse?.success) {
        setStatements(statementsResponse.data || []);
      }

      // Fetch direct debits
      const debitsResponse = await api.get<{
        success: boolean;
        data: DirectDebitMandate[];
      }>("/api/v1/gl/customer_portal/direct_debits");

      if (debitsResponse?.success) {
        setDirectDebits(debitsResponse.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch customer portal data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    init();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const copyToClipboard = async (url: string, tokenId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(tokenId);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleGenerateToken = async () => {
    if (!tokenContactId) return;

    setSubmitting(true);
    setGeneratedUrl(null);
    try {
      const response = await api.post<{
        success: boolean;
        data: { token: PortalToken; portal_url: string };
        error?: string;
      }>("/api/v1/gl/customer_portal/generate_token", {
        contact_id: tokenContactId,
        token_type: tokenType,
        expires_in: parseInt(tokenExpiresIn),
      });

      if (response?.success) {
        setGeneratedUrl(response.data.portal_url);
        await fetchData();
      } else {
        setError(response?.error || "Failed to generate token");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeToken = async (tokenId: number) => {
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/gl/customer_portal/revoke_token/${tokenId}`,
        {}
      );

      if (response?.success) {
        await fetchData();
      } else {
        setError(response?.error || "Failed to revoke token");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke token");
    }
  };

  const handleGenerateStatement = async () => {
    if (!statementContactId) return;

    setSubmitting(true);
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        "/api/v1/gl/customer_portal/generate_statement",
        {
          contact_id: statementContactId,
          as_of: statementAsOf,
        }
      );

      if (response?.success) {
        setGenerateStatementOpen(false);
        await fetchData();
      } else {
        setError(response?.error || "Failed to generate statement");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate statement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendStatement = async (statementId: number) => {
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/gl/customer_portal/send_statement/${statementId}`,
        {}
      );

      if (response?.success) {
        await fetchData();
      } else {
        setError(response?.error || "Failed to send statement");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send statement");
    }
  };

  const handleCancelDirectDebit = async (mandateId: number) => {
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/gl/customer_portal/cancel_direct_debit/${mandateId}`,
        { reason: "Cancelled via admin portal" }
      );

      if (response?.success) {
        setConfirmDialogOpen(false);
        await fetchData();
      } else {
        setError(response?.error || "Failed to cancel direct debit");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel direct debit");
    }
  };

  const openConfirmDialog = (type: string, id: number) => {
    setConfirmAction({ type, id });
    setConfirmDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === "revoke_token") {
      await handleRevokeToken(confirmAction.id);
    } else if (confirmAction.type === "cancel_debit") {
      await handleCancelDirectDebit(confirmAction.id);
    }
    setConfirmDialogOpen(false);
  };

  const getTokenTypeBadge = (type: string) => {
    switch (type) {
      case "portal":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Portal</Badge>;
      case "invoice":
        return <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">Invoice</Badge>;
      case "statement":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Statement</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getTokenStatusBadge = (token: PortalToken) => {
    const now = new Date();
    const expires = new Date(token.expires_at);

    if (token.status === "revoked") {
      return <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">Revoked</Badge>;
    }
    if (expires < now) {
      return <Badge variant="outline" className="bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground">Expired</Badge>;
    }
    return <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</Badge>;
  };

  const getStatementStatusBadge = (statement: CustomerStatement) => {
    if (statement.sent_at) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">Sent</Badge>;
    }
    return <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Draft</Badge>;
  };

  const getDebitStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">Cancelled</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Stats
  const activeTokens = tokens.filter((t) => {
    const now = new Date();
    const expires = new Date(t.expires_at);
    return t.status !== "revoked" && expires >= now;
  }).length;

  const activeDebits = directDebits.filter((d) => d.status === "active").length;
  const sentStatements = statements.filter((s) => s.sent_at).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-600" />
              <div className="text-2xl font-bold">{activeTokens}</div>
            </div>
            <p className="text-xs text-muted-foreground">Active Portal Links</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <div className="text-2xl font-bold">{statements.length}</div>
            </div>
            <p className="text-xs text-muted-foreground">Statements Generated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-green-600" />
              <div className="text-2xl font-bold">{sentStatements}</div>
            </div>
            <p className="text-xs text-muted-foreground">Statements Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-600" />
              <div className="text-2xl font-bold">{activeDebits}</div>
            </div>
            <p className="text-xs text-muted-foreground">Active Direct Debits</p>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={activeView === "tokens" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("tokens")}
        >
          <Key className="h-4 w-4 mr-2" />
          Portal Links
        </Button>
        <Button
          variant={activeView === "statements" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("statements")}
        >
          <FileText className="h-4 w-4 mr-2" />
          Statements
        </Button>
        <Button
          variant={activeView === "debits" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("debits")}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Direct Debits
        </Button>
        <div className="flex-1" />
        {activeView === "tokens" && (
          <Button size="sm" onClick={() => {
            setGeneratedUrl(null);
            setTokenContactId("");
            setTokenType("portal");
            setTokenExpiresIn("30");
            setGenerateTokenOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Link
          </Button>
        )}
        {activeView === "statements" && (
          <Button size="sm" onClick={() => {
            setStatementContactId("");
            setStatementAsOf(new Date().toISOString().split("T")[0]);
            setGenerateStatementOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Statement
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Portal Tokens Table */}
      {activeView === "tokens" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Portal Access Links
              </span>
              <Badge variant="secondary">{tokens.length} links</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tokens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No portal links generated</p>
                <p className="text-sm mt-1">
                  Generate portal links to allow customers to view invoices and statements.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Accessed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell>
                        {getTokenStatusBadge(token)}
                      </TableCell>
                      <TableCell>
                        {getTokenTypeBadge(token.token_type)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{token.contact?.name || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(token.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(token.expires_at)}
                      </TableCell>
                      <TableCell>
                        {token.accessed_at ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm cursor-help">
                                  {token.access_count}x
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Last: {formatDateTime(token.accessed_at)}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground text-sm">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {token.status !== "revoked" && new Date(token.expires_at) >= new Date() && (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => copyToClipboard(
                                        `${window.location.origin}/portal/${token.token}`,
                                        token.token
                                      )}
                                    >
                                      {copiedToken === token.token ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copy link</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => window.open(`/portal/${token.token}`, "_blank")}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Open link</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => openConfirmDialog("revoke_token", token.id)}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Revoke</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statements Table */}
      {activeView === "statements" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Customer Statements
              </span>
              <Badge variant="secondary">{statements.length} statements</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No statements generated</p>
                <p className="text-sm mt-1">
                  Generate customer statements to summarize outstanding balances.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Statement Date</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statements.map((statement) => (
                    <TableRow key={statement.id}>
                      <TableCell>
                        {getStatementStatusBadge(statement)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{statement.contact?.name || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDate(statement.statement_date)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(statement.opening_balance)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {formatCurrency(statement.total_invoiced)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {formatCurrency(statement.total_payments)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(statement.closing_balance)}
                      </TableCell>
                      <TableCell className="text-right">
                        {!statement.sent_at && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleSendStatement(statement.id)}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Send to customer</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Direct Debits Table */}
      {activeView === "debits" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Direct Debit Mandates
              </span>
              <Badge variant="secondary">{directDebits.length} mandates</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {directDebits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No direct debit mandates</p>
                <p className="text-sm mt-1">
                  Customers can set up direct debit through the customer portal.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Authorized</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {directDebits.map((mandate) => (
                    <TableRow key={mandate.id}>
                      <TableCell>
                        {getDebitStatusBadge(mandate.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{mandate.contact?.name || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{mandate.account_name}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            BSB: ***{mandate.bsb_last_4} / Acc: ***{mandate.account_last_4}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {mandate.frequency === "per_invoice" ? "Per Invoice" : mandate.frequency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(mandate.authorized_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {mandate.status === "active" && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => openConfirmDialog("cancel_debit", mandate.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Cancel mandate</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generate Token Dialog */}
      <Dialog open={generateTokenOpen} onOpenChange={setGenerateTokenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Generate Portal Link
            </DialogTitle>
            <DialogDescription>
              Create a secure link for customers to access their portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="token-contact">Customer (Contact ID)</Label>
              <Input
                id="token-contact"
                placeholder="Enter contact ID"
                value={tokenContactId}
                onChange={(e) => setTokenContactId(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="token-type">Link Type</Label>
              <Select value={tokenType} onValueChange={setTokenType}>
                <SelectTrigger id="token-type" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portal">Full Portal Access</SelectItem>
                  <SelectItem value="statement">Statement Only</SelectItem>
                  <SelectItem value="invoice">Single Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="token-expires">Expires In (days)</Label>
              <Select value={tokenExpiresIn} onValueChange={setTokenExpiresIn}>
                <SelectTrigger id="token-expires" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {generatedUrl && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">Link Generated!</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={generatedUrl}
                    readOnly
                    className="text-sm font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(generatedUrl, "generated")}
                  >
                    {copiedToken === "generated" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateTokenOpen(false)}>
              {generatedUrl ? "Close" : "Cancel"}
            </Button>
            {!generatedUrl && (
              <Button onClick={handleGenerateToken} disabled={submitting || !tokenContactId}>
                {submitting ? <Spinner className="h-4 w-4 mr-2" /> : <Key className="h-4 w-4 mr-2" />}
                Generate Link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Statement Dialog */}
      <Dialog open={generateStatementOpen} onOpenChange={setGenerateStatementOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Statement
            </DialogTitle>
            <DialogDescription>
              Create a customer statement showing their account balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="statement-contact">Customer (Contact ID)</Label>
              <Input
                id="statement-contact"
                placeholder="Enter contact ID"
                value={statementContactId}
                onChange={(e) => setStatementContactId(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="statement-date">Statement Date</Label>
              <Input
                id="statement-date"
                type="date"
                value={statementAsOf}
                onChange={(e) => setStatementAsOf(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateStatementOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateStatement} disabled={submitting || !statementContactId}>
              {submitting ? <Spinner className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Generate Statement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Confirm Action
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "revoke_token"
                ? "Are you sure you want to revoke this portal link? The customer will no longer be able to access the portal with this link."
                : "Are you sure you want to cancel this direct debit mandate? The customer will need to set up a new mandate to continue automatic payments."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmAction}>
              {confirmAction?.type === "revoke_token" ? "Revoke Link" : "Cancel Mandate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
