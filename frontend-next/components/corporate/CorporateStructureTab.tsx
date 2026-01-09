"use client";

/**
 * CorporateStructureTab - Corporate structure visualization
 *
 * Displays company group structures with:
 * - Group selector
 * - Stats cards
 * - Chart/Table view toggle
 * - Fullscreen mode
 * - People table with detail sheet
 * - Filters for shareholders, directors, officers, ownership links
 *
 * Extracted from /corporate/page.tsx for maintainability.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Building2,
  Users,
  Package,
  FileText,
  Key,
  ExternalLink,
  Network,
  GitBranch,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";
import dynamic from "next/dynamic";
import { isTrust } from "@/lib/entity-types";

// Dynamically import the chart to avoid SSR issues with React Flow
const CorporateStructureChart = dynamic(
  () => import("@/components/corporate/CorporateStructureChart"),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center"><Spinner size={32} /></div> }
);

// ============================================
// TYPES
// ============================================

interface CompanyGroup {
  id: number;
  name: string;
  description?: string;
  active?: boolean;
}

interface StructureShareholder {
  id: number;
  shareholder_type: string;
  shareholder_id: number;
  shareholder_name: string;
  shares: number;
  percentage: number;
  share_class: string;
  beneficially_held: boolean;
}

interface StructureCompany {
  id: number;
  name: string;
  code: string | null;
  acn: string | null;
  abn: string | null;
  status: string;
  entity_type: string | null;
  is_trustee: boolean;
  trust_name: string | null;
  hierarchy_level: number | null;
  date_incorporated: string | null;
  shareholders: StructureShareholder[];
  investments: unknown[];
  children: StructureCompany[];
  is_trust_of_trustee?: boolean;
}

interface StructurePerson {
  id: number;
  contact_id: number;
  name: string;
  email: string | null;
  membership_type: string;
  is_active: boolean;
  roles: Array<{
    type: string;
    company_id: number;
    company_name: string;
    position?: string;
    is_current?: boolean;
    shares?: number;
    percentage?: number;
  }>;
}

interface StructureData {
  group: { id: number; name: string };
  companies: StructureCompany[];
  people: StructurePerson[];
  stats: {
    total_companies: number;
    top_level_count: number;
    trustees_count: number;
    trusts_count: number;
    people_count: number;
  };
}

interface StructureFilters {
  shareholders: boolean;
  directors: boolean;
  secretary: boolean;
  ownershipLinks: boolean;
  corporateOfficer: boolean;
}

interface CorporateStructureTabProps {
  groups: CompanyGroup[];
  initialGroupId?: number | null;
  onGroupChange?: (groupId: number | null) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getEntityTypeBadgeColor(type: string) {
  switch (type) {
    case "trust":
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
    case "company":
    default:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  }
}

function getMembershipTypeBadgeColor(type: string) {
  switch (type) {
    case "director":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
    case "shareholder":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    case "secretary":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "public_officer":
    case "corporate_officer":
    case "officer":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CorporateStructureTab({
  groups,
  initialGroupId = null,
  onGroupChange,
}: CorporateStructureTabProps) {
  const router = useRouter();

  // State
  const [selectedGroupId, setSelectedGroupId] = React.useState<number | null>(initialGroupId);
  const [structureData, setStructureData] = React.useState<StructureData | null>(null);
  const [loadingStructure, setLoadingStructure] = React.useState(false);
  const [structureFilters, setStructureFilters] = React.useState<StructureFilters>({
    shareholders: true,
    directors: true,
    secretary: true,
    ownershipLinks: true,
    corporateOfficer: true,
  });
  const [structureViewMode, setStructureViewMode] = React.useState<"chart" | "table">("chart");
  const [isStructureFullscreen, setIsStructureFullscreen] = React.useState(false);
  const [selectedPerson, setSelectedPerson] = React.useState<StructurePerson | null>(null);

  // Load structure when group changes
  const loadStructure = React.useCallback(async (groupId: number) => {
    try {
      setLoadingStructure(true);
      const response = await api.get<{ success: boolean; data: StructureData }>(
        `/api/v1/company_groups/${groupId}/structure`
      );
      setStructureData(response.data);
    } catch (error) {
      console.error("Failed to load structure:", error);
      setStructureData(null);
    } finally {
      setLoadingStructure(false);
    }
  }, []);

  // Effect: Load structure when selectedGroupId changes
  React.useEffect(() => {
    if (selectedGroupId) {
      loadStructure(selectedGroupId);
      // Auto-fullscreen when selecting a group
      setIsStructureFullscreen(true);
    } else {
      setStructureData(null);
    }
  }, [selectedGroupId, loadStructure]);

  // Handle group selection
  const handleGroupSelect = (groupId: number | null) => {
    setSelectedGroupId(groupId);
    onGroupChange?.(groupId);
  };

  // Compute table rows for structure
  const structureRows = React.useMemo((): TableRow[] => {
    if (!structureData) return [];
    const rows: TableRow[] = [];
    const flattenCompanies = (companies: StructureCompany[], level = 0) => {
      for (const company of companies) {
        rows.push({
          id: company.id,
          name: company.name,
          display_name: company.name,
          acn: company.acn,
          abn: company.abn,
          status: company.status,
          entity_type: company.entity_type || "Company",
          is_trustee: company.is_trustee ? "Yes" : "No",
          trust_name: company.trust_name,
          _level: level,
        });
        if (company.children?.length > 0) {
          flattenCompanies(company.children, level + 1);
        }
      }
    };
    flattenCompanies(structureData.companies);
    return rows;
  }, [structureData]);

  const structureColumns: TableColumn[] = [
    { key: "display_name", label: "Name", column_type: "text" },
    { key: "entity_type", label: "Type", column_type: "text" },
    { key: "acn", label: "ACN", column_type: "text" },
    { key: "status", label: "Status", column_type: "text" },
    { key: "is_trustee", label: "Trustee", column_type: "text" },
    { key: "trust_name", label: "Trust", column_type: "text" },
  ];

  // Compute people rows with filter application
  const peopleRows = React.useMemo(() => {
    if (!structureData) return [];
    return structureData.people
      .filter((person) => {
        // Filter based on role types
        const hasDirector = person.roles.some((r) => r.type === "director") && structureFilters.directors;
        const hasSecretary = person.roles.some((r) => r.type === "secretary") && structureFilters.secretary;
        const hasShareholder = person.roles.some((r) => r.type === "shareholder") && structureFilters.shareholders;
        const hasOfficer = person.roles.some((r) => ["public_officer", "corporate_officer", "officer"].includes(r.type || "")) && structureFilters.corporateOfficer;
        return hasDirector || hasSecretary || hasShareholder || hasOfficer;
      })
      .map((person) => ({
        id: person.id,
        contact_id: person.contact_id,
        name: person.name,
        email: person.email || "—",
        membership_type: person.membership_type,
        is_active: person.is_active ? "Yes" : "No",
        roles_count: person.roles.length,
      }));
  }, [structureData, structureFilters]);

  const peopleColumns: TableColumn[] = [
    { key: "name", label: "Name", column_type: "text" },
    { key: "email", label: "Email", column_type: "text" },
    { key: "membership_type", label: "Type", column_type: "text" },
    { key: "is_active", label: "Active", column_type: "text" },
    { key: "roles_count", label: "Roles", column_type: "number" },
  ];

  return (
    <div className="space-y-6">
      {/* Group Selector */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleGroupSelect(null)}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            selectedGroupId === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Select a Group
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => handleGroupSelect(group.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              selectedGroupId === group.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {group.name}
          </button>
        ))}
      </div>

      {/* No Group Selected State */}
      {selectedGroupId === null ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a Company Group</p>
              <p className="text-sm mt-1">Choose a group above to view its structure</p>
            </div>
          </CardContent>
        </Card>
      ) : loadingStructure ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size={32} className="text-muted-foreground" />
        </div>
      ) : structureData ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{structureData.stats.total_companies}</p>
                    <p className="text-xs text-muted-foreground">Total Entities</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">{structureData.stats.top_level_count}</p>
                    <p className="text-xs text-muted-foreground">Top Level</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-2xl font-bold">{structureData.stats.trustees_count}</p>
                    <p className="text-xs text-muted-foreground">Trustees</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-rose-600" />
                  <div>
                    <p className="text-2xl font-bold">{structureData.stats.trusts_count}</p>
                    <p className="text-xs text-muted-foreground">Trusts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-teal-600" />
                  <div>
                    <p className="text-2xl font-bold">{structureData.stats.people_count}</p>
                    <p className="text-xs text-muted-foreground">People</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Companies/Trusts Hierarchy */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Companies & Trusts Hierarchy
              </CardTitle>
              <div className="flex items-center gap-4 flex-wrap">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 border rounded-lg p-1">
                  <button
                    onClick={() => setStructureViewMode("chart")}
                    className={cn(
                      "px-3 py-1 text-sm rounded-md transition-colors",
                      structureViewMode === "chart"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    Chart
                  </button>
                  <button
                    onClick={() => setStructureViewMode("table")}
                    className={cn(
                      "px-3 py-1 text-sm rounded-md transition-colors",
                      structureViewMode === "table"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    Table
                  </button>
                </div>
                {/* Fullscreen Toggle */}
                {structureViewMode === "chart" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsStructureFullscreen(true)}
                    className="gap-2"
                  >
                    <Maximize2 className="h-4 w-4" />
                    Fullscreen
                  </Button>
                )}
                {/* Filters */}
                <FilterCheckboxes
                  filters={structureFilters}
                  onChange={setStructureFilters}
                />
              </div>
            </CardHeader>
            <CardContent>
              {structureViewMode === "chart" ? (
                <CorporateStructureChart
                  data={structureData}
                  filters={structureFilters}
                  onEntityClick={(id, type) => {
                    if (type === "company") {
                      router.push(`/corporate/companies/${id}`);
                    } else {
                      router.push(`/contacts/${id}`);
                    }
                  }}
                />
              ) : (
                <TeeemTableView
                  entries={structureRows}
                  columns={structureColumns}
                  tableName={`${structureData.group.name} Structure`}
                  viewOnly={true}
                  onRowClick={(row) => router.push(`/corporate/companies/${row.id}`)}
                  customCellRenderer={(entry, columnKey) => {
                    if (columnKey === "display_name") {
                      const level = entry._level as number;
                      const entryIsTrust = isTrust(entry.entity_type as string);
                      const isTrustee = entry.is_trustee === "Yes";
                      return (
                        <div className="flex items-center gap-2">
                          {level > 0 && (
                            <span className="text-muted-foreground text-xs" style={{ marginLeft: (level - 1) * 16 }}>
                              └─
                            </span>
                          )}
                          {entryIsTrust ? (
                            <Network className="h-4 w-4 text-rose-500 flex-shrink-0" />
                          ) : isTrustee ? (
                            <Building2 className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                          ) : (
                            <Building2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          )}
                          <span className={entryIsTrust ? "text-rose-700 dark:text-rose-400" : isTrustee ? "text-indigo-700 dark:text-indigo-400" : ""}>
                            {entry.name as string}
                          </span>
                        </div>
                      );
                    }
                    if (columnKey === "entity_type") {
                      const type = entry.entity_type as string;
                      return (
                        <Badge className={getEntityTypeBadgeColor(isTrust(type) ? "trust" : "company")}>
                          {type || "Company"}
                        </Badge>
                      );
                    }
                    if (columnKey === "status") {
                      const status = entry.status as string;
                      return (
                        <Badge variant={status === "active" ? "default" : "secondary"}>
                          {status}
                        </Badge>
                      );
                    }
                    return null;
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* People Table */}
          {structureData.people.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-teal-600" />
                  People in Group ({peopleRows.length})
                </CardTitle>
                <FilterCheckboxes
                  filters={structureFilters}
                  onChange={setStructureFilters}
                />
              </CardHeader>
              <CardContent>
                {peopleRows.length > 0 ? (
                  <TeeemTableView
                    entries={peopleRows}
                    columns={peopleColumns}
                    tableName={`${structureData.group.name} People`}
                    viewOnly={true}
                    onRowClick={(row) => {
                      const person = structureData.people.find(p => p.contact_id === row.contact_id);
                      if (person) setSelectedPerson(person);
                    }}
                    customCellRenderer={(entry, columnKey) => {
                      if (columnKey === "name") {
                        return (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-teal-500 flex-shrink-0" />
                            <span>{entry.name as string}</span>
                          </div>
                        );
                      }
                      if (columnKey === "membership_type") {
                        return (
                          <Badge className={getMembershipTypeBadgeColor(entry.membership_type as string)}>
                            {entry.membership_type as string}
                          </Badge>
                        );
                      }
                      if (columnKey === "is_active") {
                        return (
                          <Badge variant={(entry.is_active as string) === "Yes" ? "default" : "secondary"}>
                            {entry.is_active as string}
                          </Badge>
                        );
                      }
                      return null;
                    }}
                  />
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No people match the selected filters
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No structure data available</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Person Detail Sheet */}
      <Sheet open={!!selectedPerson} onOpenChange={(open) => !open && setSelectedPerson(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600" />
              {selectedPerson?.name}
            </SheetTitle>
          </SheetHeader>
          {selectedPerson && (
            <PersonDetailContent
              person={selectedPerson}
              onCompanyClick={(companyId) => router.push(`/corporate/companies/${companyId}`)}
              onContactClick={(contactId) => router.push(`/contacts/${contactId}`)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Fullscreen Structure Chart Modal */}
      {isStructureFullscreen && structureData && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="absolute top-0 left-0 right-0 h-16 bg-background border-b flex items-center justify-between px-6 z-10">
            <div className="flex items-center gap-4">
              <Building2 className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold">{structureData.group.name} - Structure Chart</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={structureFilters.shareholders}
                    onChange={(e) => setStructureFilters(prev => ({ ...prev, shareholders: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-amber-700">Shareholders</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={structureFilters.directors}
                    onChange={(e) => setStructureFilters(prev => ({ ...prev, directors: e.target.checked, secretary: e.target.checked, corporateOfficer: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-purple-700">Directors/Officers</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={structureFilters.ownershipLinks}
                    onChange={(e) => setStructureFilters(prev => ({ ...prev, ownershipLinks: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-emerald-700">Ownership Lines</span>
                </label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsStructureFullscreen(false)}
                className="gap-2"
              >
                <Minimize2 className="h-4 w-4" />
                Exit Fullscreen
              </Button>
            </div>
          </div>
          <div className="absolute top-16 left-0 right-0 bottom-0">
            <CorporateStructureChart
              data={structureData}
              filters={structureFilters}
              fullscreen={true}
              onEntityClick={(id, type) => {
                if (type === "company") {
                  router.push(`/corporate/companies/${id}`);
                } else {
                  router.push(`/contacts/${id}`);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface FilterCheckboxesProps {
  filters: StructureFilters;
  onChange: (filters: StructureFilters) => void;
}

function FilterCheckboxes({ filters, onChange }: FilterCheckboxesProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground">Show:</span>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.shareholders}
          onChange={(e) => onChange({ ...filters, shareholders: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
        <span className="text-sm text-amber-700 dark:text-amber-400">Shareholders</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.directors}
          onChange={(e) => onChange({ ...filters, directors: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        <span className="text-sm text-purple-700 dark:text-purple-400">Directors</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.secretary}
          onChange={(e) => onChange({ ...filters, secretary: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-blue-700 dark:text-blue-400">Secretary</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.corporateOfficer}
          onChange={(e) => onChange({ ...filters, corporateOfficer: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <span className="text-sm text-green-700 dark:text-green-400">Officer</span>
      </label>
      <span className="text-gray-300 dark:text-gray-600">|</span>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.ownershipLinks}
          onChange={(e) => onChange({ ...filters, ownershipLinks: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className="text-sm text-emerald-700 dark:text-emerald-400">Ownership Links</span>
      </label>
    </div>
  );
}

interface PersonDetailContentProps {
  person: StructurePerson;
  onCompanyClick: (companyId: number) => void;
  onContactClick: (contactId: number) => void;
}

function PersonDetailContent({ person, onCompanyClick, onContactClick }: PersonDetailContentProps) {
  const directorRoles = person.roles.filter(r => r.type === "director");
  const shareholderRoles = person.roles.filter(r => r.type === "shareholder");
  const secretaryRoles = person.roles.filter(r => r.type === "secretary");
  const officerRoles = person.roles.filter(r => ["public_officer", "corporate_officer", "officer"].includes(r.type || ""));

  return (
    <div className="mt-6 space-y-6">
      {/* Contact Info */}
      <div>
        <p className="text-sm text-muted-foreground">{person.email || "No email"}</p>
        <Badge className="mt-2" variant={person.is_active ? "default" : "secondary"}>
          {person.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Directorships */}
      {directorRoles.length > 0 && (
        <div>
          <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Directorships ({directorRoles.length})
          </h4>
          <div className="space-y-2">
            {directorRoles.map((role, i) => (
              <div key={i} className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3">
                <button
                  onClick={() => onCompanyClick(role.company_id)}
                  className="font-medium text-purple-700 dark:text-purple-300 hover:underline"
                >
                  {role.company_name}
                </button>
                {role.is_current === false && (
                  <p className="text-sm text-muted-foreground">(Former)</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shareholdings */}
      {shareholderRoles.length > 0 && (
        <div>
          <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Shareholdings ({shareholderRoles.length})
          </h4>
          <div className="space-y-2">
            {shareholderRoles.map((role, i) => (
              <div key={i} className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <button
                  onClick={() => onCompanyClick(role.company_id)}
                  className="font-medium text-amber-700 dark:text-amber-300 hover:underline"
                >
                  {role.company_name}
                </button>
                <p className="text-sm text-muted-foreground">
                  {role.shares?.toLocaleString() || 0} shares ({role.percentage || 0}%)
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Secretary Roles */}
      {secretaryRoles.length > 0 && (
        <div>
          <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Secretary ({secretaryRoles.length})
          </h4>
          <div className="space-y-2">
            {secretaryRoles.map((role, i) => (
              <div key={i} className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                <button
                  onClick={() => onCompanyClick(role.company_id)}
                  className="font-medium text-blue-700 dark:text-blue-300 hover:underline"
                >
                  {role.company_name}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public/Corporate Officer Roles */}
      {officerRoles.length > 0 && (
        <div>
          <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
            <Key className="h-4 w-4" />
            Public/Corporate Officer ({officerRoles.length})
          </h4>
          <div className="space-y-2">
            {officerRoles.map((role, i) => (
              <div key={i} className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                <button
                  onClick={() => onCompanyClick(role.company_id)}
                  className="font-medium text-green-700 dark:text-green-300 hover:underline"
                >
                  {role.company_name}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Full Contact Button */}
      <div className="pt-4 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onContactClick(person.contact_id)}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View Full Contact Profile
        </Button>
      </div>
    </div>
  );
}

export default CorporateStructureTab;
