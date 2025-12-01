"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  Users,
  FileText,
  Calendar,
  DollarSign,
  Shield,
  Edit,
  Loader2,
  ExternalLink,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { format } from "date-fns";

interface Director {
  id: number;
  position: string;
  appointment_date: string;
  resignation_date?: string;
  is_current: boolean;
  formatted_position: string;
  contact: {
    id: number;
    full_name: string;
    email?: string;
    mobile_phone?: string;
  };
}

interface ComplianceItem {
  id: number;
  title: string;
  due_date: string;
  completed: boolean;
  days_until_due: number;
  formatted_compliance_type: string;
}

interface BankAccount {
  id: number;
  institution_name: string;
  status: string;
  display_name: string;
  masked_account_number: string;
}

interface Company {
  id: number;
  name: string;
  code?: string;
  acn?: string;
  abn?: string;
  tfn?: string;
  entity_type?: string;
  status?: string;
  date_incorporated?: string;
  purpose?: string;
  is_trustee?: boolean;
  trust_name?: string;
  registered_office_address?: string;
  principal_place_of_business?: string;
  gst_registration_status?: string;
  accounting_method?: string;
  shares_on_issue?: number;
  carry_forward_losses?: number;
  franking_balance?: number;
  amount_owing?: number;
  review_date?: string;
  formatted_acn?: string;
  formatted_abn?: string;
  has_xero_connection?: boolean;
  sharepoint_folder_url?: string;
  current_directors?: Director[];
  pending_compliance_items?: ComplianceItem[];
  bank_accounts?: BankAccount[];
  company_xero_connection?: {
    id: number;
    connection_status: string;
    xero_tenant_name: string;
    last_sync_at?: string;
  };
}

interface Shareholding {
  id: number;
  shareholder_type: string;
  shareholder_id: number;
  shareholder_name: string;
  number_of_shares: number;
  percentage: number;
  share_class?: string;
  beneficially_held?: boolean;
  beneficial_owner?: string;
  acquisition_date?: string;
}

interface Investment {
  id: number;
  company_id: number;
  company_name: string;
  company_acn?: string;
  number_of_shares: number;
  percentage: number;
  share_class?: string;
  acquisition_date?: string;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-muted rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

function InfoRow({ label, value, copyable = false }: { label: string; value?: string | number | null; copyable?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium flex items-center gap-1">
        {value}
        {copyable && typeof value === "string" && <CopyButton value={value} />}
      </span>
    </div>
  );
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [company, setCompany] = React.useState<Company | null>(null);
  const [shareholders, setShareholders] = React.useState<Shareholding[]>([]);
  const [investments, setInvestments] = React.useState<Investment[]>([]);
  const [loadingShareholders, setLoadingShareholders] = React.useState(false);
  const [loadingInvestments, setLoadingInvestments] = React.useState(false);

  // Load company details
  React.useEffect(() => {
    const loadCompany = async () => {
      try {
        setLoading(true);
        const response = await api.get<{ success: boolean; company: Company }>(
          `/api/v1/companies/${companyId}`
        );
        setCompany(response.company);
      } catch (error) {
        console.error("Failed to load company:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCompany();
  }, [companyId]);

  // Load shareholders
  const loadShareholders = async () => {
    if (shareholders.length > 0) return;
    try {
      setLoadingShareholders(true);
      const response = await api.get<{ success: boolean; data: { shareholdings: Shareholding[] } }>(
        `/api/v1/companies/${companyId}/shareholders`
      );
      setShareholders(response.data?.shareholdings || []);
    } catch (error) {
      console.error("Failed to load shareholders:", error);
    } finally {
      setLoadingShareholders(false);
    }
  };

  // Load investments
  const loadInvestments = async () => {
    if (investments.length > 0) return;
    try {
      setLoadingInvestments(true);
      const response = await api.get<{ success: boolean; data: { investments: Investment[] } }>(
        `/api/v1/companies/${companyId}/investments`
      );
      setInvestments(response.data?.investments || []);
    } catch (error) {
      console.error("Failed to load investments:", error);
    } finally {
      setLoadingInvestments(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Company not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "inactive":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "deregistered":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    }
  };

  const getEntityIcon = () => {
    switch (company.entity_type?.toLowerCase()) {
      case "trust":
        return "△";
      case "superfund":
        return "◇";
      case "person":
        return "○";
      default:
        return "□";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getEntityIcon()}</span>
              <h1 className="text-2xl font-bold tracking-tight font-serif">{company.name}</h1>
              {company.code && (
                <Badge variant="secondary">{company.code}</Badge>
              )}
              <Badge className={getStatusColor(company.status)}>
                {company.status || "Active"}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {company.formatted_acn && <span>ACN: {company.formatted_acn}</span>}
              {company.formatted_abn && <span>ABN: {company.formatted_abn}</span>}
              {company.is_trustee && company.trust_name && (
                <span className="text-purple-600">ATF {company.trust_name}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {company.sharepoint_folder_url && (
            <Button variant="outline" asChild>
              <a href={company.sharepoint_folder_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                SharePoint
              </a>
            </Button>
          )}
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="overview" className="flex-1">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="directors">Directors</TabsTrigger>
          <TabsTrigger value="shareholders" onClick={loadShareholders}>Shareholders</TabsTrigger>
          <TabsTrigger value="investments" onClick={loadInvestments}>Investments</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Company Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <InfoRow label="Entity Type" value={company.entity_type} />
                <InfoRow label="ACN" value={company.formatted_acn} copyable />
                <InfoRow label="ABN" value={company.formatted_abn} copyable />
                <InfoRow label="TFN" value={company.tfn} copyable />
                <InfoRow
                  label="Date Incorporated"
                  value={company.date_incorporated ? format(new Date(company.date_incorporated), "d MMM yyyy") : undefined}
                />
                <InfoRow label="Purpose" value={company.purpose} />
              </CardContent>
            </Card>

            {/* Addresses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Addresses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {company.registered_office_address && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Registered Office</p>
                    <p className="text-sm">{company.registered_office_address}</p>
                  </div>
                )}
                {company.principal_place_of_business && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Principal Place of Business</p>
                    <p className="text-sm">{company.principal_place_of_business}</p>
                  </div>
                )}
                {!company.registered_office_address && !company.principal_place_of_business && (
                  <p className="text-sm text-muted-foreground">No addresses recorded</p>
                )}
              </CardContent>
            </Card>

            {/* Financial */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financial
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <InfoRow label="GST Status" value={company.gst_registration_status} />
                <InfoRow label="Accounting Method" value={company.accounting_method} />
                <InfoRow label="Shares on Issue" value={company.shares_on_issue?.toLocaleString()} />
                <InfoRow
                  label="Carry Forward Losses"
                  value={company.carry_forward_losses ? `$${company.carry_forward_losses.toLocaleString()}` : undefined}
                />
                <InfoRow
                  label="Franking Balance"
                  value={company.franking_balance ? `$${company.franking_balance.toLocaleString()}` : undefined}
                />
              </CardContent>
            </Card>

            {/* Bank Accounts */}
            {company.bank_accounts && company.bank_accounts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Bank Accounts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {company.bank_accounts.map((account) => (
                    <div key={account.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{account.display_name}</p>
                        <p className="text-xs text-muted-foreground">{account.masked_account_number}</p>
                      </div>
                      <Badge variant={account.status === "active" ? "default" : "secondary"}>
                        {account.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Xero Connection */}
            {company.company_xero_connection && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Xero Connection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <InfoRow label="Tenant" value={company.company_xero_connection.xero_tenant_name} />
                  <InfoRow label="Status" value={company.company_xero_connection.connection_status} />
                  <InfoRow
                    label="Last Sync"
                    value={
                      company.company_xero_connection.last_sync_at
                        ? format(new Date(company.company_xero_connection.last_sync_at), "d MMM yyyy HH:mm")
                        : undefined
                    }
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="directors" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Directors
              </CardTitle>
            </CardHeader>
            <CardContent>
              {company.current_directors && company.current_directors.length > 0 ? (
                <div className="space-y-4">
                  {company.current_directors.map((director) => (
                    <div
                      key={director.id}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {director.contact.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{director.contact.full_name}</p>
                          <p className="text-sm text-muted-foreground">{director.formatted_position}</p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">
                          Appointed {format(new Date(director.appointment_date), "d MMM yyyy")}
                        </p>
                        {director.contact.email && (
                          <a href={`mailto:${director.contact.email}`} className="text-primary hover:underline">
                            {director.contact.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No directors recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shareholders" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Shareholders
                {company.shares_on_issue && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({company.shares_on_issue.toLocaleString()} shares on issue)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingShareholders ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : shareholders.length > 0 ? (
                <div className="space-y-3">
                  {shareholders.map((sh) => (
                    <div
                      key={sh.id}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium">{sh.shareholder_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {sh.share_class || "Ordinary"} shares
                          {sh.beneficially_held && ` (Beneficial owner: ${sh.beneficial_owner})`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{sh.number_of_shares.toLocaleString()} shares</p>
                        <p className="text-sm text-muted-foreground">{sh.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No shareholders recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Investments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingInvestments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : investments.length > 0 ? (
                <div className="space-y-3">
                  {investments.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between py-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 -mx-4 px-4 transition-colors"
                      onClick={() => router.push(`/corporate/companies/${inv.company_id}`)}
                    >
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {inv.company_name}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </p>
                        {inv.company_acn && (
                          <p className="text-sm text-muted-foreground">ACN: {inv.company_acn}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{inv.number_of_shares.toLocaleString()} shares</p>
                        <p className="text-sm text-muted-foreground">{inv.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No investments recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Compliance Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {company.pending_compliance_items && company.pending_compliance_items.length > 0 ? (
                <div className="space-y-3">
                  {company.pending_compliance_items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.formatted_compliance_type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          Due: {format(new Date(item.due_date), "d MMM yyyy")}
                        </p>
                        <Badge
                          variant={item.days_until_due < 0 ? "destructive" : item.days_until_due < 30 ? "default" : "secondary"}
                        >
                          {item.days_until_due < 0
                            ? `${Math.abs(item.days_until_due)} days overdue`
                            : item.days_until_due === 0
                              ? "Due today"
                              : `${item.days_until_due} days`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No pending compliance items</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
