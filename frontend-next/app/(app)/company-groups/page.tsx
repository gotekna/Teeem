"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  Users,
  DollarSign,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { isTrust } from "@/lib/entity-types";

// Shape icons matching the family trust diagram
const CompanyIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="5" width="18" height="14" rx="1" />
  </svg>
);

const TrustIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3L22 20H2L12 3Z" strokeLinejoin="round" />
  </svg>
);

const PersonIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="12" rx="9" ry="7" />
  </svg>
);

const SuperfundIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L22 12L12 22L2 12L12 2Z" strokeLinejoin="round" />
  </svg>
);

// Entity icon helper
function getEntityIcon(entityType: string | undefined, className = "h-5 w-5") {
  switch (entityType?.toLowerCase()) {
    case "trust":
      return <TrustIcon className={className} />;
    case "superfund":
      return <SuperfundIcon className={className} />;
    case "person":
      return <PersonIcon className={className} />;
    case "company":
    default:
      return <CompanyIcon className={className} />;
  }
}

// Entity color helper
function getEntityColor(entityType: string | undefined, isTrustee = false) {
  if (isTrustee) return "text-purple-600 dark:text-purple-400";
  switch (entityType?.toLowerCase()) {
    case "trust":
      return "text-rose-500";
    case "superfund":
      return "text-amber-600";
    case "person":
      return "text-teal-600";
    case "company":
    default:
      return "text-blue-600 dark:text-blue-400";
  }
}

interface Company {
  id: number;
  name: string;
  code?: string;
  acn?: string;
  entity_type?: string;
  is_trustee?: boolean;
  trust_name?: string;
  is_trust_of_trustee?: boolean;
  ownership_percentage?: number;
  shareholders?: unknown[];
  investments?: unknown[];
  children?: Company[];
  document_count?: number;
}

interface CompanyGroup {
  id: number;
  name: string;
  active?: boolean;
  companies_count?: number;
}

interface PersonRole {
  type: string;
  company_id: number;
  company_name: string;
  position?: string;
  is_current?: boolean;
  shares?: number;
  percentage?: number;
}

interface PersonMembership {
  id: number;
  contact_id: number;
  name: string;
  email?: string;
  membership_type: string;
  is_active: boolean;
  roles: PersonRole[];
}

interface GroupStructure {
  companies: Company[];
  people?: PersonMembership[];
  stats?: {
    total_companies: number;
    top_level_count: number;
    trustees_count: number;
    trusts_count: number;
    people_count?: number;
  };
}

// Person row component for the People section
function PersonRow({
  person,
  onNavigate,
}: {
  person: PersonMembership;
  onNavigate: (contactId: number) => void;
}) {
  const getRoleSummary = (roles: PersonRole[]) => {
    const directorships = roles.filter(r => r.type === 'director');
    const secretaries = roles.filter(r => r.type === 'secretary');
    const corporateOfficers = roles.filter(r => r.type === 'corporate_officer');
    const publicOfficers = roles.filter(r => r.type === 'public_officer');
    const shareholdings = roles.filter(r => r.type === 'shareholder');
    const parts: string[] = [];

    if (directorships.length > 0) {
      parts.push(`Director (${directorships.length})`);
    }
    if (secretaries.length > 0) {
      parts.push(`Secretary (${secretaries.length})`);
    }
    if (corporateOfficers.length > 0) {
      parts.push(`Corporate Officer (${corporateOfficers.length})`);
    }
    if (publicOfficers.length > 0) {
      parts.push(`Public Officer (${publicOfficers.length})`);
    }
    if (shareholdings.length > 0) {
      parts.push(`Shareholder`);
    }
    return parts.join(', ') || person.membership_type;
  };

  return (
    <div
      className="flex items-center py-2 px-3 hover:bg-muted/50 cursor-pointer border-b"
      onClick={() => onNavigate(person.contact_id)}
    >
      {/* Person icon */}
      <div className="flex-shrink-0 mr-3 text-teal-600">
        <PersonIcon className="h-5 w-5" />
      </div>

      {/* Person details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-foreground">{person.name}</span>
          {!person.is_active && (
            <Badge variant="secondary" className="text-xs">Inactive</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{getRoleSummary(person.roles)}</div>
      </div>

      {/* Roles detail */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {person.roles.filter(r => r.type === 'director').map((role, i) => (
          <Badge key={i} variant="outline" className="text-[10px]">
            {role.company_name.split(' ')[0]}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// Recursive tree node component
function CompanyTreeNode({
  company,
  level = 0,
  expandedNodes,
  toggleNode,
  onNavigate,
}: {
  company: Company;
  level?: number;
  expandedNodes: Set<number>;
  toggleNode: (id: number) => void;
  onNavigate: (id: number) => void;
}) {
  const isExpanded = expandedNodes.has(company.id);
  const hasChildren = company.children && company.children.length > 0;
  const paddingLeft = level * 24;

  return (
    <div>
      <div
        className={cn(
          "flex items-center py-2 px-3 hover:bg-muted/50 cursor-pointer border-b",
          level === 0 && "bg-muted/30 font-medium"
        )}
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleNode(company.id);
          }}
          className={cn(
            "mr-2 p-0.5 rounded",
            hasChildren ? "hover:bg-muted" : "invisible"
          )}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>

        {/* Entity icon */}
        <div className={cn("flex-shrink-0 mr-3", getEntityColor(company.entity_type, company.is_trustee))}>
          {getEntityIcon(company.entity_type)}
        </div>

        {/* Company details */}
        <div className="flex-1 min-w-0" onClick={() => onNavigate(company.id)}>
          <div className="flex items-center gap-2">
            <span className={cn("truncate", level === 0 ? "text-foreground" : "text-muted-foreground")}>
              {company.name}
            </span>
            {company.code && (
              <Badge variant="secondary" className="text-xs">
                {company.code}
              </Badge>
            )}
            {company.is_trustee && (
              <Badge className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 dark:bg-purple-900/30 dark:text-purple-300">
                Trustee
              </Badge>
            )}
            {company.is_trustee && company.trust_name && (
              <span className="text-xs text-purple-600 dark:text-purple-400 italic">
                ATF {company.trust_name}
              </span>
            )}
            {company.is_trust_of_trustee && (
              <span className="text-xs text-rose-500 dark:text-rose-400 italic">
                (Trust)
              </span>
            )}
          </div>
          {company.acn && (
            <div className="text-xs text-muted-foreground">ACN: {company.acn}</div>
          )}
        </div>

        {/* Ownership percentage */}
        {level > 0 && company.ownership_percentage && (
          <div className="text-sm text-muted-foreground mr-4">
            {company.ownership_percentage}%
          </div>
        )}

        {/* Quick stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {company.document_count !== undefined && company.document_count > 0 && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <FileText className="h-3.5 w-3.5" />
              {company.document_count}
            </span>
          )}
          {company.shareholders && company.shareholders.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {company.shareholders.length}
            </span>
          )}
          {company.investments && company.investments.length > 0 && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              {company.investments.length}
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {company.children!.map((child) => (
            <CompanyTreeNode
              key={child.id}
              company={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompanyGroupsPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [loadingStructure, setLoadingStructure] = React.useState(false);
  const [groups, setGroups] = React.useState<CompanyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<CompanyGroup | null>(null);
  const [structure, setStructure] = React.useState<GroupStructure | null>(null);
  const [expandedNodes, setExpandedNodes] = React.useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState("");

  // Load groups
  React.useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoading(true);
        const response = await api.get<{ success: boolean; data: CompanyGroup[] }>("/api/v1/company_groups");
        const groupsList = response.data || [];
        setGroups(groupsList);

        // Auto-select first active group
        const activeGroup = groupsList.find((g) => g.active) || groupsList[0];
        if (activeGroup) {
          setSelectedGroup(activeGroup);
        }
      } catch (error) {
        console.error("Failed to load company groups:", error);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };
    loadGroups();
  }, []);

  // Load structure when group changes
  React.useEffect(() => {
    if (!selectedGroup) return;

    const loadStructure = async () => {
      try {
        setLoadingStructure(true);
        const response = await api.get<{ success: boolean; data: GroupStructure }>(
          `/api/v1/company_groups/${selectedGroup.id}/structure`
        );
        setStructure(response.data);

        // Expand all top-level companies by default
        const topLevelIds = new Set(response.data?.companies?.map((c) => c.id) || []);
        setExpandedNodes(topLevelIds);
      } catch (error) {
        console.error("Failed to load structure:", error);
        setStructure(null);
      } finally {
        setLoadingStructure(false);
      }
    };
    loadStructure();
  }, [selectedGroup]);

  const toggleNode = (nodeId: number) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!structure?.companies) return;

    const getAllIds = (companies: Company[]): number[] => {
      let ids: number[] = [];
      companies.forEach((c) => {
        ids.push(c.id);
        if (c.children) {
          ids = ids.concat(getAllIds(c.children));
        }
      });
      return ids;
    };

    setExpandedNodes(new Set(getAllIds(structure.companies)));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Filter companies
  const filterCompanies = (companies: Company[], query: string): Company[] => {
    if (!query) return companies;

    const results: Company[] = [];
    for (const company of companies) {
      const matches =
        company.name?.toLowerCase().includes(query.toLowerCase()) ||
        company.code?.toLowerCase().includes(query.toLowerCase()) ||
        company.acn?.includes(query);

      const filteredChildren = company.children
        ? filterCompanies(company.children, query)
        : [];

      if (matches || filteredChildren.length > 0) {
        results.push({ ...company, children: filteredChildren });
      }
    }
    return results;
  };

  const filteredCompanies = structure?.companies
    ? filterCompanies(structure.companies, searchQuery)
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Company Groups</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View ownership structure and hierarchy
          </p>
        </div>
        <Button onClick={() => router.push("/corporate/companies/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Sidebar - Group selector */}
        <Card className="w-64 flex-shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Groups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  selectedGroup?.id === group.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <div className="flex items-center justify-between">
                  <span>{group.name}</span>
                  <span className="text-xs opacity-70">{group.companies_count}</span>
                </div>
              </button>
            ))}

            {/* Stats */}
            {structure?.stats && (
              <div className="pt-4 mt-4 border-t space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{structure.stats.total_companies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Top Level</span>
                  <span className="font-medium">{structure.stats.top_level_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trustees</span>
                  <span className="font-medium text-purple-600 dark:text-purple-400">{structure.stats.trustees_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trusts</span>
                  <span className="font-medium text-rose-500">{structure.stats.trusts_count}</span>
                </div>
                {structure.stats.people_count !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">People</span>
                    <span className="font-medium text-teal-600">{structure.stats.people_count}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main content */}
        <Card className="flex-1 flex flex-col min-h-0">
          {/* Toolbar */}
          <div className="border-b px-4 py-3 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search companies..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto">
            {loadingStructure ? (
              <div className="flex items-center justify-center h-48">
                <Spinner size={24} className="text-muted-foreground" />
              </div>
            ) : selectedGroup ? (
              filteredCompanies.length > 0 || (structure?.people && structure.people.length > 0) ? (
                (() => {
                  // Categorize companies into 4 sections
                  // Helper to check if entity is trust or superfund (SMSF)
                  const isTrustOrSuperfund = (entityType: string | null | undefined) =>
                    isTrust(entityType) || entityType?.toLowerCase() === "superfund";

                  const tradingCompanies = filteredCompanies.filter(
                    (c) => !c.is_trustee && !isTrustOrSuperfund(c.entity_type)
                  );
                  const corporateTrustees = filteredCompanies.filter((c) => c.is_trustee);
                  const trusts = filteredCompanies.filter(
                    (c) => isTrustOrSuperfund(c.entity_type)
                  );

                  return (
                    <div className="space-y-0">
                      {/* Trading Companies Section */}
                      {tradingCompanies.length > 0 && (
                        <div>
                          <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-2 flex items-center gap-2 border-b">
                            <CompanyIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="font-medium text-blue-700 dark:text-blue-300 text-sm">
                              Trading Companies ({tradingCompanies.length})
                            </span>
                          </div>
                          <div className="divide-y">
                            {tradingCompanies.map((company) => (
                              <CompanyTreeNode
                                key={company.id}
                                company={company}
                                level={0}
                                expandedNodes={expandedNodes}
                                toggleNode={toggleNode}
                                onNavigate={(id) => router.push(`/corporate/companies/${id}`)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Corporate Trustees Section */}
                      {corporateTrustees.length > 0 && (
                        <div className="border-t-2 border-purple-200 dark:border-purple-900">
                          <div className="bg-purple-50 dark:bg-purple-950/30 px-4 py-2 flex items-center gap-2">
                            <CompanyIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span className="font-medium text-purple-700 dark:text-purple-300 text-sm">
                              Corporate Trustees ({corporateTrustees.length})
                            </span>
                          </div>
                          <div className="divide-y">
                            {corporateTrustees.map((company) => (
                              <CompanyTreeNode
                                key={company.id}
                                company={company}
                                level={0}
                                expandedNodes={expandedNodes}
                                toggleNode={toggleNode}
                                onNavigate={(id) => router.push(`/corporate/companies/${id}`)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Trusts Section */}
                      {trusts.length > 0 && (
                        <div className="border-t-2 border-rose-200 dark:border-rose-900">
                          <div className="bg-rose-50 dark:bg-rose-950/30 px-4 py-2 flex items-center gap-2">
                            <TrustIcon className="h-4 w-4 text-rose-500" />
                            <span className="font-medium text-rose-700 dark:text-rose-300 text-sm">
                              Trusts ({trusts.length})
                            </span>
                          </div>
                          <div className="divide-y">
                            {trusts.map((company) => (
                              <CompanyTreeNode
                                key={company.id}
                                company={company}
                                level={0}
                                expandedNodes={expandedNodes}
                                toggleNode={toggleNode}
                                onNavigate={(id) => router.push(`/corporate/companies/${id}`)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* People Section - SSoT */}
                      {structure?.people && structure.people.length > 0 && (
                        <div className="border-t-2 border-teal-200 dark:border-teal-900">
                          <div className="bg-teal-50 dark:bg-teal-950/30 px-4 py-2 flex items-center gap-2">
                            <Users className="h-4 w-4 text-teal-600" />
                            <span className="font-medium text-teal-700 dark:text-teal-300 text-sm">
                              People ({structure.people.length})
                            </span>
                          </div>
                          <div className="divide-y">
                            {structure.people.map((person) => (
                              <PersonRow
                                key={person.id}
                                person={person}
                                onNavigate={(contactId) => router.push(`/contacts/${contactId}`)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  {searchQuery ? "No companies match your search" : "No companies in this group"}
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                Select a group to view its structure
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="border-t px-4 py-3 bg-muted/30">
            <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
              <span className="font-medium">Legend:</span>
              <div className="flex items-center gap-1.5">
                <CompanyIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Company</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrustIcon className="h-4 w-4 text-rose-500" />
                <span>Trust</span>
              </div>
              <div className="flex items-center gap-1.5">
                <SuperfundIcon className="h-4 w-4 text-amber-600" />
                <span>Superfund</span>
              </div>
              <div className="flex items-center gap-1.5">
                <PersonIcon className="h-4 w-4 text-teal-600" />
                <span>Person</span>
              </div>
              <div className="border-l h-4 mx-1" />
              <div className="flex items-center gap-1.5">
                <Badge className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">Trustee</Badge>
                <span>Acts as trustee</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>Documents</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>Shareholders</span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                <span>Investments</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
