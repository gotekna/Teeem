"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  Heart,
  AlertTriangle,
  Package,
  Clock,
  Plus,
  Calendar,
  FileText,
  Key,
  ExternalLink,
  Loader2,
  CheckCircle2,
  ArrowLeftRight,
  Network,
  GitBranch,
  ChevronRight,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Pencil,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";

// Import from centralized utilities
import {
  convertColumnsToTEEEMFormat,
  type ApiColumn,
} from "@/lib/corporate/column-utils";
import {
  CORPORATE_TABLE_IDS,
  COLUMN_WIDTH_OVERRIDES,
} from "@/lib/corporate/config";

// Use centralized table ID
const COMPANIES_TABLE_ID = CORPORATE_TABLE_IDS.COMPANIES;

// ===== TYPES =====

interface DashboardStats {
  totalCompanies: number;
  activeCompanies: number;
  totalAssets: number;
  complianceDueSoon: number;
  healthScore: number;
  criticalCompanies: number;
}

interface ComplianceItem {
  id: number;
  title: string;
  due_date: string;
  days_until_due: number;
  company: {
    id: number;
    name: string;
    slug?: string;
  };
}

interface CompanyGroup {
  id: number;
  name: string;
  description?: string;
  default_registered_office?: string;
  default_principal_place?: string;
  default_accountant?: string;
  default_accountant_contact?: string;
  active?: boolean;
  companies_count?: number;
  created_at?: string;
  updated_at?: string;
}

interface Membership {
  id: number;
  contact_id: number;
  contact_name: string;
  contact_email: string | null;
  contact_entity_type: string | null;
  company_group_id: number;
  company_group_name?: string;
  membership_type: string;
  company_id: number | null;
  company_name: string | null;
  can_view_confidential: boolean;
  can_edit: boolean;
  is_active: boolean;
  has_linked_company: boolean;
  linked_company_id: number | null;
}

interface GroupedContact {
  contact_id: number;
  contact_name: string;
  contact_email: string | null;
  contact_entity_type: string | null;
  has_linked_company: boolean;
  linked_company_id: number | null;
  memberships: Membership[];
}

// Structure endpoint types
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
  shareholders: StructureShareholder[];
  investments: unknown[];
  children: StructureCompany[];
  is_trust_of_trustee?: boolean;
  is_trustee_of_trust?: boolean;
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

// ===== COMPONENTS =====

interface StatCardProps {
  name: string;
  value: string | number;
  icon: React.ElementType;
  href: string;
  alert?: boolean;
  alertColor?: "green" | "yellow" | "red" | "orange";
}

function StatCard({ name, value, icon: Icon, href, alert, alertColor }: StatCardProps) {
  const router = useRouter();

  const getColors = () => {
    if (alertColor === "green") return { bg: "bg-green-500", ring: "ring-2 ring-green-500" };
    if (alertColor === "yellow") return { bg: "bg-yellow-500", ring: "ring-2 ring-yellow-500" };
    if (alertColor === "red") return { bg: "bg-red-500", ring: "ring-2 ring-red-500" };
    if (alert) return { bg: "bg-orange-500", ring: "ring-2 ring-orange-500" };
    return { bg: "bg-primary", ring: "" };
  };

  const colors = getColors();

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        colors.ring
      )}
      onClick={() => router.push(href)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn("p-3 rounded-md", colors.bg)}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{name}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickActionProps {
  label: string;
  icon?: React.ElementType;
  href: string;
  variant?: "primary" | "secondary" | "outline";
  color?: string;
}

function QuickAction({ label, icon: Icon, href, variant = "outline", color }: QuickActionProps) {
  const router = useRouter();

  const getButtonClass = () => {
    if (color === "green") return "bg-green-600 hover:bg-green-700 text-white";
    if (color === "indigo") return "bg-indigo-600 hover:bg-indigo-700 text-white";
    if (color === "blue") return "bg-blue-600 hover:bg-blue-700 text-white";
    if (variant === "primary") return "bg-primary hover:bg-primary/90 text-primary-foreground";
    return "";
  };

  return (
    <Button
      variant={variant === "outline" ? "outline" : "default"}
      className={cn("justify-start h-10", getButtonClass())}
      onClick={() => router.push(href)}
    >
      {Icon && <Icon className="h-4 w-4 mr-2" />}
      {label}
    </Button>
  );
}

// ===== MAIN COMPONENT =====

export default function CorporateDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dashboard state
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<DashboardStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    totalAssets: 0,
    complianceDueSoon: 0,
    healthScore: 0,
    criticalCompanies: 0,
  });
  const [upcomingCompliance, setUpcomingCompliance] = React.useState<ComplianceItem[]>([]);
  const [companies, setCompanies] = React.useState<TableRow[]>([]);
  const [columns, setColumns] = React.useState<TableColumn[]>([]);

  // SSoT state
  const [groups, setGroups] = React.useState<CompanyGroup[]>([]);
  const [groupsMap, setGroupsMap] = React.useState<Record<number, string>>({});
  const [selectedGroupId, setSelectedGroupId] = React.useState<number | null>(null);
  const [memberships, setMemberships] = React.useState<Membership[]>([]);
  const [loadingMemberships, setLoadingMemberships] = React.useState(false);
  const [groupByEntityType, setGroupByEntityType] = React.useState(false);
  const [expandedContacts, setExpandedContacts] = React.useState<Set<number>>(new Set());

  // Tab state
  const [activeTab, setActiveTab] = React.useState(searchParams.get("tab") || "dashboard");

  // Structure tab state
  const [structureData, setStructureData] = React.useState<StructureData | null>(null);
  const [loadingStructure, setLoadingStructure] = React.useState(false);

  // People tab state
  const [people, setPeople] = React.useState<TableRow[]>([]);
  const [loadingPeople, setLoadingPeople] = React.useState(false);

  // Groups tab state
  const [showCreateGroupDialog, setShowCreateGroupDialog] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<CompanyGroup | null>(null);
  const [savingGroup, setSavingGroup] = React.useState(false);
  const [newGroupForm, setNewGroupForm] = React.useState({
    name: "",
    description: "",
    default_registered_office: "",
    default_principal_place: "",
    default_accountant: "",
    default_accountant_contact: "",
  });

  // Load initial data
  React.useEffect(() => {
    loadDashboardData();
    fetchColumns();
    loadGroups();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load companies
      const companiesResponse = await api.get<{ companies: TableRow[] }>("/api/v1/companies");
      const companiesList = companiesResponse.companies || [];
      setCompanies(companiesList);

      // Load compliance items due soon
      let compliance: ComplianceItem[] = [];
      try {
        const complianceResponse = await api.get<{ compliance_items: ComplianceItem[] }>("/api/v1/company_compliance_items", {
          params: { due_soon: "true", days: 30 },
        });
        compliance = complianceResponse.compliance_items || [];
      } catch {
        // Compliance endpoint may not exist
      }

      // Load assets
      let assets: unknown[] = [];
      try {
        const assetsResponse = await api.get<{ assets: unknown[] }>("/api/v1/assets");
        assets = assetsResponse.assets || [];
      } catch {
        // Assets endpoint may not exist
      }

      // Load health report
      let healthSummary: { average_score?: number; critical?: number } = {};
      try {
        const healthResponse = await api.get<{ summary: { average_score?: number; critical?: number } }>("/api/v1/companies/health_report");
        healthSummary = healthResponse.summary || {};
      } catch {
        // Health endpoint may not exist
      }

      setStats({
        totalCompanies: companiesList.length,
        activeCompanies: companiesList.filter((c) => c.status === "active" || c.status === "Active").length,
        totalAssets: assets.length,
        complianceDueSoon: compliance.length,
        healthScore: healthSummary.average_score || 0,
        criticalCompanies: healthSummary.critical || 0,
      });

      setUpcomingCompliance(compliance.slice(0, 5));
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchColumns = async () => {
    try {
      const response = await api.get<{ foundation: { columns: ApiColumn[] } }>(`/api/v1/foundations/${COMPANIES_TABLE_ID}`);
      const dbColumns = response?.foundation?.columns || [];
      const teeemColumns = convertColumnsToTEEEMFormat(
        dbColumns,
        COMPANIES_TABLE_ID,
        COLUMN_WIDTH_OVERRIDES.companies
      );
      setColumns(teeemColumns);
    } catch (err) {
      console.error("Failed to fetch columns:", err);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await api.get<{ success: boolean; data: CompanyGroup[] }>("/api/v1/company_groups");
      const groupsList = response.data || [];
      setGroups(groupsList);
      const map: Record<number, string> = {};
      groupsList.forEach(g => { map[g.id] = g.name; });
      setGroupsMap(map);
    } catch (error) {
      console.error("Failed to load company groups:", error);
    }
  };

  // Load memberships when group changes
  React.useEffect(() => {
    const loadMemberships = async () => {
      if (activeTab !== "memberships") return;

      try {
        setLoadingMemberships(true);
        if (selectedGroupId === null) {
          // Load all memberships from all groups
          const allMemberships: Membership[] = [];
          for (const group of groups) {
            const response = await api.get<{ success: boolean; data: Membership[] }>(
              `/api/v1/company_groups/${group.id}/contacts`
            );
            const groupMemberships = (response.data || []).map(m => ({
              ...m,
              company_group_name: group.name
            }));
            allMemberships.push(...groupMemberships);
          }
          setMemberships(allMemberships);
        } else {
          const response = await api.get<{ success: boolean; data: Membership[] }>(
            `/api/v1/company_groups/${selectedGroupId}/contacts`
          );
          const groupName = groupsMap[selectedGroupId] || "";
          setMemberships((response.data || []).map(m => ({ ...m, company_group_name: groupName })));
        }
      } catch (error) {
        console.error("Failed to load memberships:", error);
        setMemberships([]);
      } finally {
        setLoadingMemberships(false);
      }
    };

    if (groups.length > 0 && activeTab === "memberships") {
      loadMemberships();
    }
  }, [selectedGroupId, groups, groupsMap, activeTab]);

  // Load structure when group is selected and structure tab is active
  React.useEffect(() => {
    const loadStructure = async () => {
      if (selectedGroupId === null) {
        setStructureData(null);
        return;
      }

      try {
        setLoadingStructure(true);
        const response = await api.get<{ success: boolean; data: StructureData }>(
          `/api/v1/company_groups/${selectedGroupId}/structure`
        );
        setStructureData(response.data || null);
      } catch (error) {
        console.error("Failed to load structure:", error);
        setStructureData(null);
      } finally {
        setLoadingStructure(false);
      }
    };

    if (activeTab === "structure" && selectedGroupId !== null) {
      loadStructure();
    }
  }, [selectedGroupId, activeTab]);

  // Load people when people tab is active - only people linked to company groups
  React.useEffect(() => {
    const loadPeople = async () => {
      try {
        setLoadingPeople(true);
        // Get all people from all company groups (people who have memberships)
        const allPeople: TableRow[] = [];
        const seenIds = new Set<number>();

        for (const group of groups) {
          const response = await api.get<{ success: boolean; data: Membership[] }>(
            `/api/v1/company_groups/${group.id}/contacts`
          );
          const memberships = response.data || [];
          // Filter for people only (not company_entity or trust_entity)
          const peopleInGroup = memberships.filter(m =>
            m.contact_entity_type === 'person' ||
            (!['company_entity', 'trust_entity'].includes(m.membership_type) &&
             !['company', 'trust'].includes(m.contact_entity_type || ''))
          );

          for (const m of peopleInGroup) {
            if (!seenIds.has(m.contact_id)) {
              seenIds.add(m.contact_id);
              allPeople.push({
                id: m.contact_id,
                full_name: m.contact_name,
                email: m.contact_email,
                entity_type: m.contact_entity_type,
                company_group_memberships_count: 1, // Will be updated below
                membership_types: [m.membership_type],
                company_group_names: [groupsMap[group.id] || group.name],
              });
            } else {
              // Update existing entry with additional membership info
              const existing = allPeople.find(p => p.id === m.contact_id);
              if (existing) {
                existing.company_group_memberships_count = ((existing.company_group_memberships_count as number) || 0) + 1;
                const types = existing.membership_types as string[];
                if (!types.includes(m.membership_type)) {
                  types.push(m.membership_type);
                }
                const groupNames = existing.company_group_names as string[];
                const groupName = groupsMap[group.id] || group.name;
                if (!groupNames.includes(groupName)) {
                  groupNames.push(groupName);
                }
              }
            }
          }
        }

        // Sort by name
        allPeople.sort((a, b) => ((a.full_name as string) || '').localeCompare((b.full_name as string) || ''));
        setPeople(allPeople);
      } catch (error) {
        console.error("Failed to load people:", error);
        setPeople([]);
      } finally {
        setLoadingPeople(false);
      }
    };

    if (activeTab === "people" && people.length === 0 && groups.length > 0) {
      loadPeople();
    }
  }, [activeTab, people.length, groups, groupsMap]);

  // ===== HANDLERS =====

  const handleEdit = async (entry: TableRow) => {
    try {
      const response = await api.patch<{ company: TableRow }>(`/api/v1/companies/${entry.id}`, { company: entry });
      setCompanies(companies.map((c) => (c.id === entry.id ? response.company : c)));
    } catch (err) {
      console.error("Failed to update company:", err);
    }
  };

  const handleDelete = async (entry: TableRow) => {
    if (!confirm(`Delete company "${entry.name}"? This cannot be undone.`)) return;

    try {
      await api.delete(`/api/v1/companies/${entry.id}`);
      setCompanies(companies.filter((c) => c.id !== entry.id));
    } catch (err) {
      console.error("Failed to delete company:", err);
    }
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    try {
      await Promise.all(ids.map((id) => api.delete(`/api/v1/companies/${id}`)));
      setCompanies(companies.filter((c) => !ids.includes(c.id)));
    } catch (err) {
      console.error("Failed to bulk delete companies:", err);
    }
  };

  // ===== GROUP HANDLERS =====

  const resetGroupForm = () => {
    setNewGroupForm({
      name: "",
      description: "",
      default_registered_office: "",
      default_principal_place: "",
      default_accountant: "",
      default_accountant_contact: "",
    });
    setEditingGroup(null);
  };

  const handleCreateGroup = async () => {
    if (!newGroupForm.name.trim()) {
      alert("Group name is required");
      return;
    }

    try {
      setSavingGroup(true);
      const response = await api.post<{ success: boolean; data: CompanyGroup }>("/api/v1/company_groups", {
        company_group: newGroupForm,
      });

      if (response?.success && response?.data) {
        setGroups([...groups, response.data].sort((a, b) => a.name.localeCompare(b.name)));
        setGroupsMap(prev => ({ ...prev, [response.data!.id]: response.data!.name }));
        setShowCreateGroupDialog(false);
        resetGroupForm();
      }
    } catch (err) {
      console.error("Failed to create group:", err);
      alert("Failed to create group. Please try again.");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !newGroupForm.name.trim()) {
      alert("Group name is required");
      return;
    }

    try {
      setSavingGroup(true);
      const response = await api.patch<{ success: boolean; data: CompanyGroup }>(
        `/api/v1/company_groups/${editingGroup.id}`,
        { company_group: newGroupForm }
      );

      if (response.success && response.data) {
        setGroups(groups.map(g => g.id === editingGroup.id ? response.data : g).sort((a, b) => a.name.localeCompare(b.name)));
        setGroupsMap(prev => ({ ...prev, [response.data.id]: response.data.name }));
        setShowCreateGroupDialog(false);
        resetGroupForm();
      }
    } catch (err) {
      console.error("Failed to update group:", err);
      alert("Failed to update group. Please try again.");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (group: CompanyGroup) => {
    if (group.companies_count && group.companies_count > 0) {
      alert(`Cannot delete group with ${group.companies_count} companies. Reassign companies first.`);
      return;
    }

    if (!confirm(`Delete group "${group.name}"? This cannot be undone.`)) return;

    try {
      await api.delete(`/api/v1/company_groups/${group.id}`);
      setGroups(groups.filter(g => g.id !== group.id));
      const newMap = { ...groupsMap };
      delete newMap[group.id];
      setGroupsMap(newMap);
      if (selectedGroupId === group.id) {
        setSelectedGroupId(null);
      }
    } catch (err) {
      console.error("Failed to delete group:", err);
      alert("Failed to delete group. Please try again.");
    }
  };

  const openEditGroupDialog = (group: CompanyGroup) => {
    setEditingGroup(group);
    setNewGroupForm({
      name: group.name,
      description: group.description || "",
      default_registered_office: group.default_registered_office || "",
      default_principal_place: group.default_principal_place || "",
      default_accountant: group.default_accountant || "",
      default_accountant_contact: group.default_accountant_contact || "",
    });
    setShowCreateGroupDialog(true);
  };

  // ===== STRUCTURE HELPERS =====

  const flattenHierarchy = React.useCallback((comps: StructureCompany[], level = 0, parentPath = ""): TableRow[] => {
    const rows: TableRow[] = [];

    comps.forEach((company, index) => {
      const path = parentPath ? `${parentPath}.${index}` : `${index}`;
      const prefix = level > 0 ? "└─".padStart(level * 3, "  ") : "";

      rows.push({
        id: company.id,
        _level: level,
        _path: path,
        _prefix: prefix,
        name: company.name,
        display_name: `${prefix} ${company.name}`.trim(),
        code: company.code || "—",
        acn: company.acn || "—",
        abn: company.abn || "—",
        status: company.status,
        entity_type: company.entity_type || "Company",
        is_trustee: company.is_trustee ? "Yes" : "No",
        trust_name: company.trust_name || "—",
        is_trust_of_trustee: company.is_trust_of_trustee || false,
        is_trustee_of_trust: company.is_trustee_of_trust || false,
        shareholders_count: company.shareholders.length,
        children_count: company.children.length,
      });

      if (company.children.length > 0) {
        rows.push(...flattenHierarchy(company.children, level + 1, path));
      }
    });

    return rows;
  }, []);

  const structureColumns: TableColumn[] = React.useMemo(() => [
    { key: "display_name", label: "Entity Name", width: 300, sortable: true, filterable: true },
    { key: "entity_type", label: "Type", width: 100, sortable: true, filterable: true, filterType: "dropdown" },
    { key: "code", label: "Code", width: 80, sortable: true },
    { key: "acn", label: "ACN", width: 120, sortable: true },
    { key: "abn", label: "ABN", width: 140, sortable: true },
    { key: "status", label: "Status", width: 100, sortable: true, filterable: true, filterType: "dropdown" },
    { key: "is_trustee", label: "Trustee", width: 80, sortable: true, filterable: true, filterType: "dropdown" },
    { key: "trust_name", label: "Trust Name", width: 150, sortable: true },
    { key: "shareholders_count", label: "Shareholders", width: 100, sortable: true },
    { key: "children_count", label: "Subsidiaries", width: 100, sortable: true },
  ], []);

  const structureRows: TableRow[] = React.useMemo(() => {
    if (!structureData) return [];
    return flattenHierarchy(structureData.companies);
  }, [structureData, flattenHierarchy]);

  const peopleColumns: TableColumn[] = React.useMemo(() => [
    { key: "name", label: "Name", width: 200, sortable: true, filterable: true },
    { key: "email", label: "Email", width: 200, sortable: true, filterable: true },
    { key: "membership_type", label: "Membership", width: 120, sortable: true, filterable: true, filterType: "dropdown" },
    { key: "roles_summary", label: "Roles", width: 300, sortable: false, filterable: true },
    { key: "is_active", label: "Active", width: 80, sortable: true, filterable: true, filterType: "dropdown" },
  ], []);

  const peopleRows: TableRow[] = React.useMemo(() => {
    if (!structureData) return [];
    return structureData.people.map(p => ({
      id: p.id,
      contact_id: p.contact_id,
      name: p.name,
      email: p.email || "—",
      membership_type: p.membership_type,
      is_active: p.is_active ? "Yes" : "No",
      roles_summary: p.roles.map(r => `${r.type} @ ${r.company_name}`).join(", ") || "—",
      roles: p.roles,
    }));
  }, [structureData]);

  // ===== BADGE HELPERS =====

  const getEntityTypeBadgeColor = (type: string | null) => {
    switch (type?.toLowerCase()) {
      case "person":
        return "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300";
      case "company":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "trust":
        return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const getMembershipTypeBadgeColor = (type: string) => {
    switch (type) {
      case "director":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "shareholder":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
      case "company_entity":
      case "trust_entity":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  // ===== MEMBERSHIP GROUPING =====

  const groupedByContact = React.useMemo(() => {
    const contactMap = new Map<number, GroupedContact>();

    memberships.forEach((m) => {
      if (!contactMap.has(m.contact_id)) {
        contactMap.set(m.contact_id, {
          contact_id: m.contact_id,
          contact_name: m.contact_name,
          contact_email: m.contact_email,
          contact_entity_type: m.contact_entity_type,
          has_linked_company: m.has_linked_company || false,
          linked_company_id: m.linked_company_id || null,
          memberships: [],
        });
      }
      contactMap.get(m.contact_id)!.memberships.push(m);
    });

    return Array.from(contactMap.values()).sort((a, b) =>
      a.contact_name.localeCompare(b.contact_name)
    );
  }, [memberships]);

  const groupedByEntityType = React.useMemo(() => {
    const grouped: Record<string, GroupedContact[]> = {
      person: [],
      company: [],
      trust: [],
      unknown: [],
    };
    groupedByContact.forEach((contact) => {
      const type = contact.contact_entity_type?.toLowerCase() || "unknown";
      if (grouped[type]) {
        grouped[type].push(contact);
      } else {
        grouped.unknown.push(contact);
      }
    });
    return grouped;
  }, [groupedByContact]);

  const entityTypeLabels: Record<string, string> = {
    person: "People",
    company: "Companies",
    trust: "Trusts",
    unknown: "Unknown",
  };

  const toggleExpanded = (contactId: number) => {
    setExpandedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedContacts(new Set(groupedByContact.map(c => c.contact_id)));
  };

  const collapseAll = () => {
    setExpandedContacts(new Set());
  };

  // ===== RENDER CONTACT ROW =====

  const renderContactRow = (contact: GroupedContact) => {
    const isExpanded = expandedContacts.has(contact.contact_id);
    const hasMultipleMemberships = contact.memberships.length > 1;

    return (
      <React.Fragment key={contact.contact_id}>
        <tr
          className={`border-b hover:bg-muted/50 ${hasMultipleMemberships ? 'cursor-pointer' : ''}`}
          onClick={() => hasMultipleMemberships && toggleExpanded(contact.contact_id)}
        >
          <td className="py-2 px-3">
            <div className="flex items-center gap-2">
              {hasMultipleMemberships ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )
              ) : (
                <span className="w-4" />
              )}
              <div>
                <div className="font-medium">{contact.contact_name}</div>
                <div className="text-xs text-muted-foreground">
                  Contact ID: {contact.contact_id}
                  {contact.contact_email && ` · ${contact.contact_email}`}
                </div>
              </div>
            </div>
          </td>
          <td className="py-2 px-3">
            <Badge className={getEntityTypeBadgeColor(contact.contact_entity_type)}>
              {contact.contact_entity_type || "unknown"}
            </Badge>
          </td>
          <td className="py-2 px-3">
            {contact.has_linked_company && contact.linked_company_id ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/corporate/companies/${contact.linked_company_id}`);
                }}
                className="flex items-center gap-1 text-green-600 hover:text-green-800 hover:underline"
                title="View linked Company"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs">View</span>
              </button>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </td>
          <td className="py-2 px-3">
            {hasMultipleMemberships ? (
              <span className="text-muted-foreground text-sm">
                {contact.memberships.length} memberships
              </span>
            ) : (
              <Badge className={getMembershipTypeBadgeColor(contact.memberships[0].membership_type)}>
                {contact.memberships[0].membership_type}
              </Badge>
            )}
          </td>
          <td className="py-2 px-3">
            {hasMultipleMemberships ? (
              <span className="text-muted-foreground text-sm">—</span>
            ) : contact.memberships[0].company_group_name ? (
              <span className="text-sm">{contact.memberships[0].company_group_name}</span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </td>
          <td className="py-2 px-3">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/contacts/${contact.contact_id}`);
                }}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                title="View Contact"
              >
                <ExternalLink className="h-4 w-4" />
                View
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/contacts/${contact.contact_id}?edit=true`);
                }}
                className="text-amber-600 hover:text-amber-800 flex items-center gap-1"
                title="Edit Contact (SSoT)"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            </div>
          </td>
        </tr>
        {isExpanded && contact.memberships.map((m, idx) => (
          <tr key={`${contact.contact_id}-${m.id}`} className="bg-muted/20 border-b">
            <td className="py-1.5 px-3 pl-10">
              <span className="text-muted-foreground text-sm">└</span>
            </td>
            <td className="py-1.5 px-3">
              <span className="text-xs text-muted-foreground">Membership {idx + 1}</span>
            </td>
            <td className="py-1.5 px-3" />
            <td className="py-1.5 px-3">
              <Badge className={getMembershipTypeBadgeColor(m.membership_type)}>
                {m.membership_type}
              </Badge>
            </td>
            <td className="py-1.5 px-3">
              <span className="text-sm">{m.company_group_name || "-"}</span>
            </td>
            <td className="py-1.5 px-3">
              {m.company_name && (
                <button
                  onClick={() => router.push(`/corporate/companies/${m.company_id}`)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  {m.company_name}
                </button>
              )}
            </td>
          </tr>
        ))}
      </React.Fragment>
    );
  };

  // ===== STAT CARDS CONFIG =====

  const statCards: StatCardProps[] = [
    { name: "Total Companies", value: stats.totalCompanies, icon: Building2, href: "/corporate?tab=companies" },
    { name: "Active Companies", value: stats.activeCompanies, icon: CheckCircle2, href: "/corporate?tab=companies" },
    {
      name: "Health Score",
      value: stats.healthScore > 0 ? `${stats.healthScore.toFixed(1)}%` : "N/A",
      icon: Heart,
      href: "/corporate/health",
      alert: stats.criticalCompanies > 0,
      alertColor: stats.healthScore >= 80 ? "green" : stats.healthScore >= 60 ? "yellow" : "red",
    },
    { name: "Critical Companies", value: stats.criticalCompanies, icon: AlertTriangle, href: "/corporate/health", alert: stats.criticalCompanies > 0 },
    { name: "Total Assets", value: stats.totalAssets, icon: Package, href: "/corporate/assets" },
    { name: "Compliance Due", value: stats.complianceDueSoon, icon: Clock, href: "/corporate/compliance-calendar", alert: stats.complianceDueSoon > 0 },
  ];

  // ===== LOADING STATE =====

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const uniqueContactCount = groupedByContact.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight font-serif">Corporate Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Contact-based SSoT for companies, trusts, and group structure
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <StatCard key={stat.name} {...stat} />
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-base font-medium mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction label="Health Report" icon={Heart} href="/corporate/health" color="green" />
            <QuickAction label="Company Groups" icon={Building2} href="/company-groups" color="indigo" />
            <QuickAction label="Add Company" icon={Plus} href="/corporate/companies/new" color="blue" />
            <QuickAction label="Add Asset" icon={Package} href="/corporate/assets/new" />
            <QuickAction label="View Directors" icon={Users} href="/corporate/directors" />
            <QuickAction label="Compliance Calendar" icon={Calendar} href="/corporate/compliance-calendar" />
            <QuickAction label="Minute Templates" icon={FileText} href="/corporate/minute-templates" />
            <QuickAction label="Xero Integration" icon={ExternalLink} href="/xero" />
            <QuickAction label="ASIC Logins" icon={Key} href="/corporate/asic-logins" />
            <QuickAction label="Document Types" icon={FileText} href="/admin/system?tab=document-types" />
            <QuickAction label="Consolidation" icon={ArrowLeftRight} href="/corporate/consolidation" />
          </div>
        </CardContent>
      </Card>

      {/* Data Health Indicator */}
      {stats.healthScore > 0 && (
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/corporate/health")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-full",
                stats.healthScore >= 80 ? "bg-green-100 text-green-600" :
                stats.healthScore >= 60 ? "bg-yellow-100 text-yellow-600" :
                "bg-red-100 text-red-600"
              )}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Data Health</p>
                <p className="text-sm text-muted-foreground">
                  {stats.criticalCompanies > 0
                    ? `${stats.criticalCompanies} issues found • Click to fix`
                    : "All companies healthy"}
                </p>
              </div>
            </div>
            <span className={cn(
              "text-2xl font-bold",
              stats.healthScore >= 80 ? "text-green-600" :
              stats.healthScore >= 60 ? "text-yellow-600" :
              "text-red-600"
            )}>
              {stats.healthScore.toFixed(0)}%
            </span>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 max-w-4xl">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Groups
          </TabsTrigger>
          <TabsTrigger value="companies" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Companies
          </TabsTrigger>
          <TabsTrigger value="people" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            People
          </TabsTrigger>
          <TabsTrigger value="memberships" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Memberships
          </TabsTrigger>
          <TabsTrigger value="structure" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Structure
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab - Upcoming Compliance */}
        <TabsContent value="dashboard" className="mt-4">
          {upcomingCompliance.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-base font-medium mb-4">Upcoming Compliance (Next 30 Days)</h3>
                <div className="space-y-3">
                  {upcomingCompliance.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => router.push(`/corporate/companies/${item.company.slug || item.company.id}?tab=compliance`)}
                      className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.company.name}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={item.days_until_due <= 7 ? "destructive" : "default"}>
                          {item.days_until_due} days
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(item.due_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="link"
                  className="mt-4 p-0 h-auto"
                  onClick={() => router.push("/corporate/compliance-calendar")}
                >
                  View all compliance items →
                </Button>
              </CardContent>
            </Card>
          )}
          {upcomingCompliance.length === 0 && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-medium">No upcoming compliance items</p>
                  <p className="text-sm mt-1">All compliance items are up to date</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-indigo-600" />
                  Company Groups ({groups.length})
                </CardTitle>
                <CardDescription>
                  Manage company groups to organize related entities
                </CardDescription>
              </div>
              <Dialog open={showCreateGroupDialog} onOpenChange={(open) => {
                setShowCreateGroupDialog(open);
                if (!open) resetGroupForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Group
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{editingGroup ? "Edit Group" : "Create New Group"}</DialogTitle>
                    <DialogDescription>
                      {editingGroup
                        ? "Update the group details below."
                        : "Create a new company group to organize related companies and trusts."
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="group-name">Name *</Label>
                      <Input
                        id="group-name"
                        placeholder="e.g., Smith Family Group"
                        value={newGroupForm.name}
                        onChange={(e) => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="group-description">Description</Label>
                      <Textarea
                        id="group-description"
                        placeholder="Optional description of this group"
                        value={newGroupForm.description}
                        onChange={(e) => setNewGroupForm({ ...newGroupForm, description: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="group-registered-office">Default Registered Office</Label>
                      <Input
                        id="group-registered-office"
                        placeholder="Address for registered office"
                        value={newGroupForm.default_registered_office}
                        onChange={(e) => setNewGroupForm({ ...newGroupForm, default_registered_office: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="group-principal-place">Default Principal Place of Business</Label>
                      <Input
                        id="group-principal-place"
                        placeholder="Address for principal place"
                        value={newGroupForm.default_principal_place}
                        onChange={(e) => setNewGroupForm({ ...newGroupForm, default_principal_place: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="group-accountant">Default Accountant</Label>
                        <Input
                          id="group-accountant"
                          placeholder="Accountant name"
                          value={newGroupForm.default_accountant}
                          onChange={(e) => setNewGroupForm({ ...newGroupForm, default_accountant: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="group-accountant-contact">Accountant Contact</Label>
                        <Input
                          id="group-accountant-contact"
                          placeholder="Contact details"
                          value={newGroupForm.default_accountant_contact}
                          onChange={(e) => setNewGroupForm({ ...newGroupForm, default_accountant_contact: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setShowCreateGroupDialog(false);
                      resetGroupForm();
                    }}>
                      Cancel
                    </Button>
                    <Button
                      onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}
                      disabled={savingGroup || !newGroupForm.name.trim()}
                    >
                      {savingGroup && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingGroup ? "Save Changes" : "Create Group"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No groups yet</p>
                  <p className="text-sm mt-1">Create your first company group to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map((group) => (
                    <Card
                      key={group.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setActiveTab("structure");
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-5 w-5 text-indigo-600" />
                              <h3 className="font-medium">{group.name}</h3>
                            </div>
                            {group.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {group.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-3">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Building2 className="h-4 w-4" />
                                <span>{group.companies_count || 0} companies</span>
                              </div>
                              {group.active === false && (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditGroupDialog(group);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGroup(group);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {(group.default_accountant || group.default_registered_office) && (
                          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
                            {group.default_accountant && (
                              <div>Accountant: {group.default_accountant}</div>
                            )}
                            {group.default_registered_office && (
                              <div className="truncate">Office: {group.default_registered_office}</div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="mt-4">
          <TeeemTableView
            foundationId="companies"
            foundationIdNumeric={COMPANIES_TABLE_ID}
            tableName="All Companies"
            entries={companies}
            columns={columns}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            onRowDoubleClick={(company) => router.push(`/corporate/companies/${company.id}`)}
            enableExport={true}
            enableSchemaEditor={true}
            hideUpdateViewButton={true}
            onColumnUpdate={fetchColumns}
            leftActions={
              <Button onClick={() => router.push("/corporate/companies/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Company
              </Button>
            }
          />
        </TabsContent>

        {/* People Tab */}
        <TabsContent value="people" className="mt-4">
          {loadingPeople ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-teal-600" />
                  People ({people.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {people.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No people found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Name</th>
                          <th className="text-left py-2 px-3 font-medium">Email</th>
                          <th className="text-left py-2 px-3 font-medium">Roles</th>
                          <th className="text-left py-2 px-3 font-medium">Company Groups</th>
                          <th className="text-left py-2 px-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {people.map((person) => {
                          const name = (person.full_name || person.name || "Unknown") as string;
                          const email = (person.email || "—") as string;
                          const membershipTypes = (person.membership_types || []) as string[];
                          const groupNames = (person.company_group_names || []) as string[];
                          return (
                            <tr key={person.id} className="border-b hover:bg-muted/50">
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-teal-500" />
                                  <div className="font-medium">{name}</div>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">
                                {email}
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex flex-wrap gap-1">
                                  {membershipTypes.map((type, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {type.replace('_', ' ')}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex flex-wrap gap-1">
                                  {groupNames.map((gn, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {gn}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => router.push(`/contacts/${person.id}`)}
                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    View
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Memberships Tab (SSoT) */}
        <TabsContent value="memberships" className="mt-4">
          {/* Group Selector */}
          <div className="flex gap-2 flex-wrap mb-4">
            <button
              onClick={() => setSelectedGroupId(null)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                selectedGroupId === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              All
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Contacts ({uniqueContactCount}) · {memberships.length} memberships
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <button
                    onClick={expandAll}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Expand All
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    onClick={collapseAll}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Collapse All
                  </button>
                </div>
                <button
                  onClick={() => setGroupByEntityType(!groupByEntityType)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {groupByEntityType ? (
                    <ToggleRight className="h-5 w-5 text-primary" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                  Group by Entity Type
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMemberships ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : groupedByContact.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No contacts in this group
                </div>
              ) : groupByEntityType ? (
                <div className="space-y-6">
                  {["person", "company", "trust", "unknown"].map((entityType) => {
                    const contacts = groupedByEntityType[entityType];
                    if (contacts.length === 0) return null;
                    return (
                      <div key={entityType}>
                        <h3 className={`font-medium mb-2 flex items-center gap-2 ${
                          entityType === "person" ? "text-teal-600" :
                          entityType === "company" ? "text-blue-600" :
                          entityType === "trust" ? "text-rose-500" : "text-gray-600"
                        }`}>
                          {entityTypeLabels[entityType]} ({contacts.length})
                        </h3>
                        <div className="overflow-x-auto border rounded-lg">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/30">
                                <th className="text-left py-2 px-3 font-medium">Contact</th>
                                <th className="text-left py-2 px-3 font-medium">Entity Type</th>
                                <th className="text-left py-2 px-3 font-medium">Company</th>
                                <th className="text-left py-2 px-3 font-medium">Membership</th>
                                <th className="text-left py-2 px-3 font-medium">Group</th>
                                <th className="text-left py-2 px-3 font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {contacts.map(renderContactRow)}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Contact</th>
                        <th className="text-left py-2 px-3 font-medium">Entity Type</th>
                        <th className="text-left py-2 px-3 font-medium">Company</th>
                        <th className="text-left py-2 px-3 font-medium">Membership</th>
                        <th className="text-left py-2 px-3 font-medium">Group</th>
                        <th className="text-left py-2 px-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedByContact.map(renderContactRow)}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Structure Tab */}
        <TabsContent value="structure" className="mt-4 space-y-6">
          {/* Group Selector for Structure */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedGroupId(null)}
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
                onClick={() => setSelectedGroupId(group.id)}
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
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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

              {/* Companies/Trusts Hierarchy Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    Companies & Trusts Hierarchy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TeeemTableView
                    entries={structureRows}
                    columns={structureColumns}
                    tableName={`${structureData.group.name} Structure`}
                    viewOnly={true}
                    onRowClick={(row) => router.push(`/corporate/companies/${row.id}`)}
                    customCellRenderer={(entry, columnKey) => {
                      if (columnKey === "display_name") {
                        const level = entry._level as number;
                        const isTrust = (entry.entity_type as string)?.toLowerCase() === "trust";
                        const isTrustee = entry.is_trustee === "Yes";
                        return (
                          <div className="flex items-center gap-2">
                            {level > 0 && (
                              <span className="text-muted-foreground text-xs" style={{ marginLeft: (level - 1) * 16 }}>
                                └─
                              </span>
                            )}
                            {isTrust ? (
                              <Network className="h-4 w-4 text-rose-500 flex-shrink-0" />
                            ) : isTrustee ? (
                              <Building2 className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                            ) : (
                              <Building2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            )}
                            <span className={isTrust ? "text-rose-700 dark:text-rose-400" : isTrustee ? "text-indigo-700 dark:text-indigo-400" : ""}>
                              {entry.name as string}
                            </span>
                          </div>
                        );
                      }
                      if (columnKey === "entity_type") {
                        const type = entry.entity_type as string;
                        return (
                          <Badge className={getEntityTypeBadgeColor(type?.toLowerCase() === "trust" ? "trust" : "company")}>
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
                </CardContent>
              </Card>

              {/* People Table */}
              {peopleRows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-5 w-5 text-teal-600" />
                      People in Group ({peopleRows.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TeeemTableView
                      entries={peopleRows}
                      columns={peopleColumns}
                      tableName={`${structureData.group.name} People`}
                      viewOnly={true}
                      onRowClick={(row) => router.push(`/contacts/${row.contact_id}`)}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
