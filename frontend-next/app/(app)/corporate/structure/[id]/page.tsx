"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, GitBranch, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";

// Dynamic import for PersonStructureChart to avoid SSR issues with ReactFlow
const PersonStructureChart = dynamic(
  () => import("@/components/corporate/PersonStructureChart"),
  { ssr: false }
);

interface PersonRole {
  id: number;
  type: string;
  company_id: number;
  company_name: string;
  position?: string;
  shares?: number;
  percentage?: number;
  is_current: boolean;
}

interface OwnershipNode {
  company_id: number;
  company_name: string;
  percentage: number;
  entity_type?: string;
  is_trustee?: boolean;
  trust_name?: string;
  trust_id?: number;
  trust_entity_type?: string;
  children?: OwnershipNode[];
}

interface PersonData {
  id: number;
  display_name: string;
  email?: string | null;
}

export default function CorporateStructurePage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [person, setPerson] = React.useState<PersonData | null>(null);
  const [roles, setRoles] = React.useState<PersonRole[]>([]);
  const [ownershipChain, setOwnershipChain] = React.useState<OwnershipNode[]>([]);
  const [showFullDetail, setShowFullDetail] = React.useState(false);

  // Fetch person data and roles
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch contact info
        const contactResponse = await api.get<{ success: boolean; data: PersonData }>(
          `/api/v1/contacts/${contactId}`
        );
        if (contactResponse.success && contactResponse.data) {
          setPerson(contactResponse.data);
        }

        // Fetch directorships
        const directorshipsResponse = await api.get<{ success: boolean; data: Array<{
          id: number;
          company_id: number;
          company_name: string;
          position: string;
          formatted_position?: string;
          is_current: boolean;
        }> }>(`/api/v1/contacts/corporate_structure/${contactId}/directorships`);

        // Fetch shareholdings
        const shareholdingsResponse = await api.get<{ success: boolean; data: Array<{
          id: number;
          company_id: number;
          company_name: string;
          shares: number;
          percentage: number;
        }> }>(`/api/v1/contacts/corporate_structure/${contactId}/shareholdings`);

        // Combine into roles format
        const combinedRoles: PersonRole[] = [];

        if (directorshipsResponse.success && directorshipsResponse.data) {
          directorshipsResponse.data.forEach((d) => {
            combinedRoles.push({
              id: d.id,
              type: "director",
              company_id: d.company_id,
              company_name: d.company_name,
              position: d.formatted_position || d.position,
              is_current: d.is_current,
            });
          });
        }

        if (shareholdingsResponse.success && shareholdingsResponse.data) {
          shareholdingsResponse.data.forEach((s) => {
            combinedRoles.push({
              id: s.id,
              type: "shareholder",
              company_id: s.company_id,
              company_name: s.company_name,
              shares: s.shares,
              percentage: s.percentage,
              is_current: true,
            });
          });
        }

        setRoles(combinedRoles);

        // Fetch ownership chain
        const ownershipResponse = await api.get<{ success: boolean; data: OwnershipNode[] }>(
          `/api/v1/contacts/corporate_structure/${contactId}/ownership_chain`
        );
        if (ownershipResponse.success && ownershipResponse.data) {
          setOwnershipChain(ownershipResponse.data);
        }
      } catch (error) {
        console.error("Failed to fetch corporate structure data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (contactId) {
      fetchData();
    }
  }, [contactId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
        <p className="text-muted-foreground">Contact not found</p>
        <BackButton fallbackHref="/contacts" label="Go Back" variant="outline" />
      </div>
    );
  }

  const directorRoles = roles
    .filter((r) => r.type === "director")
    .map((r) => ({
      company_id: r.company_id,
      company_name: r.company_name,
      position: r.position,
      is_current: r.is_current,
    }));

  // Group roles by company for the detail view
  const companiesMap = new Map<
    number,
    { id: number; name: string; roles: PersonRole[] }
  >();
  roles.forEach((role) => {
    if (!companiesMap.has(role.company_id)) {
      companiesMap.set(role.company_id, {
        id: role.company_id,
        name: role.company_name,
        roles: [],
      });
    }
    companiesMap.get(role.company_id)!.roles.push(role);
  });

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/contacts" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-teal-600" />
              {person.display_name} - Corporate Structure
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              All company relationships for this person
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/contacts/${contactId}`)}
        >
          View Full Contact
        </Button>
      </div>

      {/* Structure Chart - Full Width */}
      <div className="flex-1 min-h-[600px]">
        <PersonStructureChart
          personName={person.display_name}
          personEmail={person.email}
          ownershipChain={ownershipChain}
          directorRoles={directorRoles}
          onCompanyClick={(companyId) =>
            router.push(`/corporate/companies/${companyId}`)
          }
          showFullDetail={showFullDetail}
          onToggleFullDetail={() => setShowFullDetail(!showFullDetail)}
        />
      </div>

      {/* Detail Cards - shown when Full Detail is enabled */}
      {showFullDetail && companiesMap.size > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {Array.from(companiesMap.values()).map((company) => (
            <Card
              key={company.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/corporate/companies/${company.id}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  {company.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {company.roles.map((role, idx) => {
                    const roleColors: Record<string, string> = {
                      director:
                        "bg-purple-100 text-purple-700 dark:bg-purple-900/30",
                      shareholder:
                        "bg-amber-100 text-amber-700 dark:bg-amber-900/30",
                      secretary:
                        "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
                      officer:
                        "bg-green-100 text-green-700 dark:bg-green-900/30",
                    };
                    const colorClass =
                      roleColors[role.type] ||
                      "bg-gray-100 text-gray-700 dark:bg-gray-900/30";

                    return (
                      <Badge key={idx} className={colorClass}>
                        {role.type === "shareholder"
                          ? `${role.percentage || 0}% Shareholder`
                          : role.position || role.type}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
