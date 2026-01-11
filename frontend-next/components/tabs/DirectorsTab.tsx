"use client";

/**
 * DirectorsTab - Displays corporate officers (directors, secretaries, public officers)
 *
 * Extracted from corporate page for unified tab system.
 * Fetches and displays officer history with current/former status.
 */

import * as React from "react";
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

import { format } from "date-fns";
import { api } from "@/lib/api";
import type { OfficerRecord } from "@/lib/types/corporate";

interface DirectorsTabProps {
  companyId: string;
  entityId?: string;
}

export function DirectorsTab({ companyId, entityId }: DirectorsTabProps) {
  const effectiveCompanyId = companyId || entityId;
  const [officers, setOfficers] = React.useState<OfficerRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadOfficers = async () => {
      try {
        const response = await api.get<{ success: boolean; directors: OfficerRecord[] }>(
          `/api/v1/companies/${effectiveCompanyId}/directors`
        );
        setOfficers(response.directors || []);
      } catch (error) {
        console.error("Failed to load officers:", error);
      } finally {
        setLoading(false);
      }
    };
    loadOfficers();
  }, [effectiveCompanyId]);

  // Group officers by role type
  const directors = officers.filter(o => o.position?.includes("director") || o.position === "chairman");
  const secretaries = officers.filter(o => o.position?.includes("secretary"));
  const publicOfficers = officers.filter(o => o.position?.includes("public_officer"));

  const renderOfficerList = (title: string, officerList: OfficerRecord[]) => {
    const current = officerList.filter(o => o.is_current);
    const former = officerList.filter(o => !o.is_current);

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
        {officerList.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No {title.toLowerCase()} recorded</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Name</TableHead>
                  <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Position</TableHead>
                  <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Appointed</TableHead>
                  <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Resigned</TableHead>
                  <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {/* Current officers first */}
                {current.map((officer) => (
                  <TableRow key={officer.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-300 text-xs font-medium">
                          {officer.contact?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{officer.contact?.display_name || "Unknown"}</p>
                          {officer.contact?.email && (
                            <a href={`mailto:${officer.contact.email}`} className="text-xs text-muted-foreground hover:text-primary">
                              {officer.contact.email}
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">{officer.formatted_position}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{officer.appointment_date ? format(new Date(officer.appointment_date), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">-</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Current</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Former officers */}
                {former.map((officer) => (
                  <TableRow key={officer.id} className="hover:bg-muted/30 opacity-60">
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted dark:bg-gray-800 flex items-center justify-center text-muted-foreground text-xs font-medium">
                          {officer.contact?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{officer.contact?.display_name || "Unknown"}</p>
                          {officer.contact?.email && (
                            <span className="text-xs text-muted-foreground">{officer.contact.email}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">{officer.formatted_position}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{officer.appointment_date ? format(new Date(officer.appointment_date), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{officer.resignation_date ? format(new Date(officer.resignation_date), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="secondary">Former</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Corporate Officers History</h3>
      {renderOfficerList("Directors", directors)}
      {renderOfficerList("Secretaries", secretaries)}
      {renderOfficerList("Public Officers", publicOfficers)}
    </div>
  );
}

export default DirectorsTab;
