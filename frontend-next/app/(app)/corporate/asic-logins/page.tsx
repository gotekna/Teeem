"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Building2,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { copyToClipboard } from "@/utils/formatters";
import { BackButton } from "@/components/ui/back-button";
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

interface Company {
  id: number;
  name: string;
  company_group_name?: string;
  acn?: string;
  formatted_acn?: string;
  corporate_key?: string;
  asic_username?: string;
  asic_password?: string;
  recovery_question?: string;
  recovery_answer?: string;
  has_credentials?: boolean;
}

interface CompanyGroup {
  id: number;
  name: string;
}

export default function AsicLoginsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<Company[]>([]);
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
      const response = await api.get<{ company_groups: CompanyGroup[] }>("/api/v1/company_groups");
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
      const response = await api.get<{ companies: Company[] }>("/api/v1/companies/asic_logins", { params });
      setCompanies(response.companies || []);
    } catch (error) {
      console.error("Failed to load ASIC logins:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePassword = (companyId: number, field: string) => {
    const key = `${companyId}-${field}`;
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = async (text: string, companyId: number, field: string) => {
    await copyToClipboard(text);
    const key = `${companyId}-${field}`;
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGroupChange = (groupId: string) => {
    // Convert "__all__" back to empty string for the API
    const actualGroupId = groupId === "__all__" ? "" : groupId;
    setSelectedGroup(actualGroupId);
    if (actualGroupId) {
      router.push(`/corporate/asic-logins/group/${actualGroupId}`);
    } else {
      router.push("/corporate/asic-logins");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <BackButton fallbackHref="/corporate" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">ASIC Logins</h1>
            <p className="text-sm text-muted-foreground mt-1">View and manage ASIC portal credentials for all companies</p>
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
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Username</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Password</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Recovery Q&A</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {companies.map((company) => (
                <TableRow key={company.id} className="hover:bg-muted/50">
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div
                      className="flex items-center cursor-pointer"
                      onClick={() => router.push(`/corporate/companies/${company.id}`)}
                    >
                      <Building2 className="h-5 w-5 text-muted-foreground mr-2" />
                      <span className="text-sm font-medium text-primary hover:underline">{company.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {company.company_group_name || "-"}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                    {company.formatted_acn || company.acn || "-"}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    {company.corporate_key ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{company.corporate_key}</span>
                        <button
                          onClick={() => handleCopy(company.corporate_key!, company.id, "corporate_key")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {copiedField === `${company.id}-corporate_key` ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    {company.asic_username ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{company.asic_username}</span>
                        <button
                          onClick={() => handleCopy(company.asic_username!, company.id, "username")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {copiedField === `${company.id}-username` ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    {company.asic_password ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">
                          {showPasswords[`${company.id}-password`] ? company.asic_password : "••••••••"}
                        </span>
                        <button
                          onClick={() => togglePassword(company.id, "password")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {showPasswords[`${company.id}-password`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleCopy(company.asic_password!, company.id, "password")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {copiedField === `${company.id}-password` ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {company.recovery_question ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{company.recovery_question}</p>
                        {company.recovery_answer && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono">
                              {showPasswords[`${company.id}-recovery`] ? company.recovery_answer : "••••••••"}
                            </span>
                            <button
                              onClick={() => togglePassword(company.id, "recovery")}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {showPasswords[`${company.id}-recovery`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleCopy(company.recovery_answer!, company.id, "recovery")}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {copiedField === `${company.id}-recovery` ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {companies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="px-6 py-12 text-center">
                    <Key className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-medium">No ASIC logins found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedGroup ? "No companies with ASIC credentials in this group." : "No companies with ASIC credentials found."}
                    </p>
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
        {companies.filter((c) => c.has_credentials).length > 0 && (
          <span> ({companies.filter((c) => c.has_credentials).length} with ASIC credentials)</span>
        )}
      </div>
    </div>
  );
}
