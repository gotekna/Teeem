"use client";

/**
 * MembersTab - Shows members for Charity and Superfund entities
 *
 * Extracted from corporate page for unified tab system.
 * Similar to Shareholdings but without share-specific data.
 */

import * as React from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";
import { api } from "@/lib/api";
import type { CorporateCompany } from "@/lib/types/corporate";

interface Member {
  id: number;
  name: string;
  email?: string;
  member_type?: string;
  joined_date?: string;
  status?: string;
}

interface MembersTabProps {
  company: CorporateCompany;
  companyId?: string;
  entityId?: string;
}

export function MembersTab({ company, companyId }: MembersTabProps) {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);

  const effectiveCompanyId = companyId || String(company.id);

  React.useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await api.get<{ success: boolean; data: { members?: Member[] } }>(
          `/api/v1/companies/${effectiveCompanyId}/members`
        );
        setMembers(response.data?.members || []);
      } catch (error) {
        console.error("Failed to load members:", error);
        // Fallback to empty - API may not exist yet
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };
    loadMembers();
  }, [effectiveCompanyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Members</h3>
        <span className="text-sm text-muted-foreground">
          {members.length} member{members.length !== 1 ? 's' : ''} registered
        </span>
      </div>

      {members.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Member</TableHead>
                <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Type</TableHead>
                <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Joined</TableHead>
                <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {members.map((member, idx) => (
                <TableRow key={member.id || idx} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-medium">
                        {member.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        {member.email && (
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm capitalize">{member.member_type || "Member"}</TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    {member.joined_date ? format(new Date(member.joined_date), "dd/MM/yyyy") : "-"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge className={member.status === "active"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-muted text-foreground dark:bg-background/30 dark:text-muted-foreground"
                    }>
                      {member.status || "Active"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No members recorded</p>
          <p className="text-xs text-muted-foreground mt-1">
            {company.entity_type === "Charity"
              ? "Add charity members and their roles"
              : "Add superfund members and their contribution details"
            }
          </p>
        </div>
      )}
    </div>
  );
}

export default MembersTab;
