"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  Building2,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { API } from "@/lib/constants/api-endpoints";
import { copyToClipboard } from "@/utils/formatters";
import { BackButton } from "@/components/ui/back-button";
import { EmptyState } from "@/components/ui/empty-state";
import { UI_COPY_FEEDBACK_MS } from "@/lib/constants/timeout-constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyGroup } from "@/lib/types";
import type { AsicPortalCredential } from "@/lib/types/corporate";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  resigned: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  expired: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

interface AsicCompany {
  id: number;
  name: string;
  acn?: string;
  formatted_acn?: string;
  company_group_id?: number;
  company_group_name?: string;
  corporate_key?: string;
  has_credentials?: boolean;
  credentials: AsicPortalCredential[];
}

export default function AsicLoginsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<AsicCompany[]>([]);
  const [companyGroups, setCompanyGroups] = React.useState<CompanyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState(searchParams.get("company_group_id") || "");
  const [showPasswords, setShowPasswords] = React.useState<Record<string, boolean>>({});
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadCompanyGroups();
  }, []);

  React.useEffect(() => {
    loadAsicLogins();
  }, [selectedGroup]);

  const loadCompanyGroups = async () => {
    try {
      const response = await api.get<{ company_groups: CompanyGroup[] }>(API.companyGroups.list);
      setCompanyGroups(response.company_groups || []);
    } catch (error) {
      console.error("Failed to load company groups:", error);
    }
  };

  const loadAsicLogins = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (selectedGroup) params.company_group_id = selectedGroup;
      const response = await api.get<{ companies: AsicCompany[] }>(`${API.companies.list}/asic_logins`, { params });
      setCompanies(response.companies || []);
    } catch (error) {
      console.error("Failed to load ASIC logins:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePassword = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = async (text: string, key: string) => {
    await copyToClipboard(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), UI_COPY_FEEDBACK_MS);
  };

  const handleGroupChange = (groupId: string) => {
    const actualGroupId = groupId === "__all__" ? "" : groupId;
    setSelectedGroup(actualGroupId);
    if (actualGroupId) {
      router.push(`/corporate/asic-logins/group/${actualGroupId}`);
    } else {
      router.push("/corporate/asic-logins");
    }
  };

  // Count total credentials across all companies
  const totalCredentials = companies.reduce((sum, c) => sum + (c.credentials?.length || 0), 0);

  if (loading) {
    return <LoadingOverlay height="h-96" />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <BackButton fallbackHref="/corporate" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">ASIC Logins</h1>
            <p className="text-sm text-muted-foreground mt-1">View ASIC portal credentials for all companies</p>
          </div>
        </div>
        <Select value={selectedGroup || "__all__"} onValueChange={handleGroupChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Company Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Company Groups</SelectItem>
            {companyGroups.map((group) => (
              <SelectItem key={group.id} value={String(group.id)}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Company</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Group</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">ACN</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Corporate Key</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Username</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Recovery Q</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {companies.map((company) => {
                const creds = company.credentials || [];
                if (creds.length === 0) {
                  return (
                    <TableRow key={company.id} className="hover:bg-muted/50">
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center cursor-pointer" onClick={() => router.push(`/corporate/companies/${company.id}`)}>
                          <Building2 className="h-5 w-5 text-muted-foreground mr-2" />
                          <span className="text-sm font-medium text-primary hover:underline">{company.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{company.company_group_name || "-"}</TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-mono">{company.formatted_acn || company.acn || "-"}</TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <CopyableField value={company.corporate_key} fieldKey={`${company.id}-key`} copiedField={copiedField} onCopy={handleCopy} mono />
                      </TableCell>
                      <TableCell colSpan={4} className="px-6 py-4 text-sm text-muted-foreground">No portal users</TableCell>
                    </TableRow>
                  );
                }
                return creds.map((cred, idx) => (
                  <TableRow key={`${company.id}-${cred.id}`} className="hover:bg-muted/50">
                    {idx === 0 ? (
                      <>
                        <TableCell className="px-6 py-4 whitespace-nowrap" rowSpan={creds.length}>
                          <div className="flex items-center cursor-pointer" onClick={() => router.push(`/corporate/companies/${company.id}`)}>
                            <Building2 className="h-5 w-5 text-muted-foreground mr-2" />
                            <span className="text-sm font-medium text-primary hover:underline">{company.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground" rowSpan={creds.length}>
                          {company.company_group_name || "-"}
                        </TableCell>
                        <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-mono" rowSpan={creds.length}>
                          {company.formatted_acn || company.acn || "-"}
                        </TableCell>
                        <TableCell className="px-6 py-4 whitespace-nowrap" rowSpan={creds.length}>
                          <CopyableField value={company.corporate_key} fieldKey={`${company.id}-key`} copiedField={copiedField} onCopy={handleCopy} mono />
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm">{cred.contact_name || "-"}</TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <CopyableField value={cred.username} fieldKey={`${cred.id}-user`} copiedField={copiedField} onCopy={handleCopy} mono />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground truncate max-w-[200px]">{cred.recovery_question || "-"}</TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cred.status] || ""}`}>
                        {cred.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ));
              })}
              {companies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="px-6 py-12">
                    <EmptyState
                      title="No ASIC logins found"
                      description={selectedGroup ? "No companies with ASIC credentials in this group." : "No companies with ASIC credentials found."}
                      icon={<Key className="h-12 w-12" />}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {companies.length} companies
        {totalCredentials > 0 && <span> ({totalCredentials} portal users)</span>}
      </div>
    </div>
  );
}

/** Small copyable field helper */
function CopyableField({
  value,
  fieldKey,
  copiedField,
  onCopy,
  mono,
}: {
  value?: string;
  fieldKey: string;
  copiedField: string | null;
  onCopy: (text: string, key: string) => void;
  mono?: boolean;
}) {
  if (!value) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
      <button onClick={() => onCopy(value, fieldKey)} className="text-muted-foreground hover:text-foreground" aria-label="Copy">
        {copiedField === fieldKey ? <Check className="h-4 w-4 text-green-500 dark:text-green-400" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
