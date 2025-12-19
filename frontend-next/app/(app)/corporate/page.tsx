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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
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
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { FullHeightContainer, ScrollContent } from "@/components/ui/layout-containers";
import dynamic from "next/dynamic";

// Dynamically import the charts to avoid SSR issues with React Flow
const CorporateStructureChart = dynamic(
  () => import("@/components/corporate/CorporateStructureChart"),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);

const PersonStructureChart = dynamic(
  () => import("@/components/corporate/PersonStructureChart"),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);

import { useEntityTypes } from "@/hooks/useEntityTypes";
import { getEntityTypeLabel, isPerson, isCompany, isTrust } from "@/lib/entity-types";

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

// ===== SHAREHOLDERS TABLE COMPONENT =====

interface Shareholding {
  id: number;
  shareholder_name: string;
  shareholder_id: number;
  company_name: string;
  company_id: number;
  number_of_shares: number;
  percentage?: number;
  share_class?: string;
}

function ShareholdersTable() {
  const router = useRouter();
  const [shareholdings, setShareholdings] = React.useState<Shareholding[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadShareholdings = async () => {
      try {
        setLoading(true);
        const response = await api.get<{ shareholdings: Shareholding[] }>("/api/v1/shareholdings");
        setShareholdings(response.shareholdings || []);
      } catch (error) {
        console.error("Failed to load shareholdings:", error);
      } finally {
        setLoading(false);
      }
    };
    loadShareholdings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (shareholdings.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No shareholdings found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium">Shareholder</th>
            <th className="text-left py-2 px-3 font-medium">Company</th>
            <th className="text-right py-2 px-3 font-medium">Shares</th>
            <th className="text-right py-2 px-3 font-medium">%</th>
            <th className="text-left py-2 px-3 font-medium">Class</th>
          </tr>
        </thead>
        <tbody>
          {shareholdings.map((sh) => (
            <tr key={sh.id} className="border-b hover:bg-muted/50">
              <td className="py-2 px-3">
                <button
                  onClick={() => router.push(`/contacts/${sh.shareholder_id}`)}
                  className="text-amber-600 hover:text-amber-800 hover:underline"
                >
                  {sh.shareholder_name}
                </button>
              </td>
              <td className="py-2 px-3">
                <button
                  onClick={() => router.push(`/corporate/companies/${sh.company_id}`)}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {sh.company_name}
                </button>
              </td>
              <td className="py-2 px-3 text-right font-mono">
                {sh.number_of_shares?.toLocaleString() || "—"}
              </td>
              <td className="py-2 px-3 text-right">
                {sh.percentage ? `${sh.percentage}%` : "—"}
              </td>
              <td className="py-2 px-3">
                {sh.share_class || "Ordinary"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== BENEFICIARIES TABLE COMPONENT =====

interface Beneficiary {
  id: number;
  beneficiary_name: string;
  beneficiary_id: number;
  trust_name: string;
  trust_id: number;
  beneficiary_type?: string;
  percentage?: number;
}

function BeneficiariesTable() {
  const router = useRouter();
  const [beneficiaries, setBeneficiaries] = React.useState<Beneficiary[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadBeneficiaries = async () => {
      try {
        setLoading(true);
        const response = await api.get<{ beneficiaries: Beneficiary[] }>("/api/v1/beneficiaries");
        setBeneficiaries(response.beneficiaries || []);
      } catch (error) {
        console.error("Failed to load beneficiaries:", error);
        setBeneficiaries([]);
      } finally {
        setLoading(false);
      }
    };
    loadBeneficiaries();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (beneficiaries.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No beneficiaries found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium">Beneficiary</th>
            <th className="text-left py-2 px-3 font-medium">Trust</th>
            <th className="text-left py-2 px-3 font-medium">Type</th>
            <th className="text-right py-2 px-3 font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {beneficiaries.map((b) => (
            <tr key={b.id} className="border-b hover:bg-muted/50">
              <td className="py-2 px-3">
                <button
                  onClick={() => router.push(`/contacts/${b.beneficiary_id}`)}
                  className="text-rose-600 hover:text-rose-800 hover:underline"
                >
                  {b.beneficiary_name}
                </button>
              </td>
              <td className="py-2 px-3">
                <button
                  onClick={() => router.push(`/corporate/companies/${b.trust_id}`)}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {b.trust_name}
                </button>
              </td>
              <td className="py-2 px-3">
                {b.beneficiary_type || "—"}
              </td>
              <td className="py-2 px-3 text-right">
                {b.percentage ? `${b.percentage}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== MAIN COMPONENT =====

export default function CorporateDashboardPage() {
  useSetLayoutMode("full-height");
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

  // Company groups state
  const [groups, setGroups] = React.useState<CompanyGroup[]>([]);
  const [groupsMap, setGroupsMap] = React.useState<Record<number, string>>({});
  const [selectedGroupId, setSelectedGroupId] = React.useState<number | null>(null);
  const [memberships, setMemberships] = React.useState<Membership[]>([]);
  const [loadingMemberships, setLoadingMemberships] = React.useState(false);
  const [groupByEntityType, setGroupByEntityType] = React.useState(false);
  const [expandedContacts, setExpandedContacts] = React.useState<Set<number>>(new Set());

  // Tab state
  const [activeTab, setActiveTab] = React.useState(searchParams.get("tab") || "groups");

  // Structure tab state
  const [structureData, setStructureData] = React.useState<StructureData | null>(null);
  const [loadingStructure, setLoadingStructure] = React.useState(false);
  const [structureFilters, setStructureFilters] = React.useState({
    shareholders: true,
    directors: true,
    secretary: true,
    ownershipLinks: true,
    corporateOfficer: true,
  });
  const [structureViewMode, setStructureViewMode] = React.useState<"chart" | "table">("chart");
  const [isStructureFullscreen, setIsStructureFullscreen] = React.useState(false);
  const [selectedPerson, setSelectedPerson] = React.useState<StructurePerson | null>(null);

  // People tab state
  const [people, setPeople] = React.useState<TableRow[]>([]);
  const [loadingPeople, setLoadingPeople] = React.useState(false);
  const [fullScreenPerson, setFullScreenPerson] = React.useState<TableRow | null>(null);
  const [fullScreenPersonRoles, setFullScreenPersonRoles] = React.useState<Array<{
    type: string;
    company_id: number;
    company_name: string;
    position?: string;
    is_current?: boolean;
    shares?: number;
    percentage?: number;
  }>>([]);
  // Define recursive ownership node type
  interface OwnershipNodeState {
    company_id: number;
    company_name: string;
    percentage: number;
    entity_type?: string;
    is_trustee?: boolean;
    trust_name?: string;
    trust_id?: number;
    trust_entity_type?: string;
    children?: OwnershipNodeState[];
  }
  const [fullScreenPersonOwnershipChain, setFullScreenPersonOwnershipChain] = React.useState<OwnershipNodeState[]>([]);
  const [loadingPersonRoles, setLoadingPersonRoles] = React.useState(false);

  // Groups tab state
  const [showCreateGroupDialog, setShowCreateGroupDialog] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<CompanyGroup | null>(null);
  const [savingGroup, setSavingGroup] = React.useState(false);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<number>>(new Set());
  const [groupStructures, setGroupStructures] = React.useState<Record<number, StructureData>>({});
  const [loadingGroupStructure, setLoadingGroupStructure] = React.useState<number | null>(null);
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
    loadGroups();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load companies - only those belonging to a Company Group (corporate entities)
      const companiesResponse = await api.get<{ companies: TableRow[] }>("/api/v1/companies");
      const allCompanies = companiesResponse.companies || [];
      // Filter to only show companies in a company group
      const companiesList = allCompanies.filter((c) => c.company_group_id != null);
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

      // Health report removed from initial load - too slow (4.5s with 1600+ queries)
      // Health is now loaded per-company when clicking on a specific company

      setStats({
        totalCompanies: companiesList.length,
        activeCompanies: companiesList.filter((c) => c.status === "active" || c.status === "Active").length,
        totalAssets: assets.length,
        complianceDueSoon: compliance.length,
        healthScore: 0,
        criticalCompanies: 0,
      });

      setUpcomingCompliance(compliance.slice(0, 5));
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
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

  // Load memberships - only from Charity group
  React.useEffect(() => {
    const loadMemberships = async () => {
      if (activeTab !== "memberships") return;

      try {
        setLoadingMemberships(true);
        // Find the Charity group
        const charityGroup = groups.find(g => g.name === "Charity");
        if (charityGroup) {
          const response = await api.get<{ success: boolean; data: Membership[] }>(
            `/api/v1/company_groups/${charityGroup.id}/contacts`
          );
          setMemberships((response.data || []).map(m => ({ ...m, company_group_name: "Charity" })));
        } else {
          setMemberships([]);
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
  }, [groups, activeTab]);

  // Auto-load all group structures when Groups tab is active
  const loadedGroupsRef = React.useRef<Set<number>>(new Set());

  React.useEffect(() => {
    const loadAllGroupStructures = async () => {
      if (activeTab !== "groups" || groups.length === 0) return;

      // Load structures for groups we haven't loaded yet
      for (const group of groups) {
        if (!loadedGroupsRef.current.has(group.id)) {
          loadedGroupsRef.current.add(group.id);
          try {
            const response = await api.get<{ success: boolean; data: StructureData }>(
              `/api/v1/company_groups/${group.id}/structure`
            );
            if (response.success && response.data) {
              setGroupStructures(prev => ({ ...prev, [group.id]: response.data }));
            }
          } catch (error) {
            console.error(`Failed to load structure for group ${group.id}:`, error);
          }
        }
      }
    };

    loadAllGroupStructures();
  }, [activeTab, groups]);

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
            isPerson(m.contact_entity_type) ||
            (!['company_entity', 'trust_entity'].includes(m.membership_type) &&
             !isCompany(m.contact_entity_type) && !isTrust(m.contact_entity_type))
          );

          for (const m of peopleInGroup) {
            if (!seenIds.has(m.contact_id)) {
              seenIds.add(m.contact_id);
              allPeople.push({
                id: m.contact_id,
                display_name: m.contact_name,
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
        allPeople.sort((a, b) => ((a.display_name as string) || '').localeCompare((b.display_name as string) || ''));
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

  // Load roles and ownership chain when full screen person dialog opens
  React.useEffect(() => {
    const loadPersonData = async () => {
      if (!fullScreenPerson) {
        setFullScreenPersonRoles([]);
        setFullScreenPersonOwnershipChain([]);
        return;
      }

      const contactId = fullScreenPerson.id as number;

      try {
        setLoadingPersonRoles(true);

        // Fetch ownership chain from the new API endpoint
        try {
          const ownershipResponse = await api.get<{ success: boolean; data: OwnershipNodeState[] }>(
            `/api/v1/contacts/${contactId}/ownership_chain`
          );
          if (ownershipResponse.success && ownershipResponse.data) {
            setFullScreenPersonOwnershipChain(ownershipResponse.data);
          }
        } catch (ownershipError) {
          console.error("Failed to load ownership chain:", ownershipError);
          setFullScreenPersonOwnershipChain([]);
        }

        // If the person already has roles (from Structure tab), use them
        if (fullScreenPerson.roles && Array.isArray(fullScreenPerson.roles) && (fullScreenPerson.roles as unknown[]).length > 0) {
          setFullScreenPersonRoles(fullScreenPerson.roles as typeof fullScreenPersonRoles);
          return;
        }

        // Otherwise, fetch roles from all company groups
        const allRoles: typeof fullScreenPersonRoles = [];

        // Search through all groups to find this person's roles
        for (const group of groups) {
          try {
            const response = await api.get<{ success: boolean; data: StructureData }>(
              `/api/v1/company_groups/${group.id}/structure`
            );
            const data = response.data;
            if (data?.people) {
              const personInGroup = data.people.find(p => p.contact_id === contactId);
              if (personInGroup?.roles && personInGroup.roles.length > 0) {
                // Deduplicate roles by company_id + type
                personInGroup.roles.forEach(role => {
                  const exists = allRoles.some(r =>
                    r.company_id === role.company_id && r.type === role.type
                  );
                  if (!exists) {
                    allRoles.push(role);
                  }
                });
              }
            }
          } catch (groupError) {
            console.error(`Failed to load structure for group ${group.id}:`, groupError);
          }
        }

        setFullScreenPersonRoles(allRoles);
      } catch (error) {
        console.error("Failed to load person data:", error);
        setFullScreenPersonRoles([]);
      } finally {
        setLoadingPersonRoles(false);
      }
    };

    loadPersonData();
  }, [fullScreenPerson, groups]);

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

  const toggleGroupExpansion = async (groupId: number) => {
    const newExpanded = new Set(expandedGroups);

    if (newExpanded.has(groupId)) {
      // Collapse
      newExpanded.delete(groupId);
      setExpandedGroups(newExpanded);
    } else {
      // Expand and load data if not already loaded
      newExpanded.add(groupId);
      setExpandedGroups(newExpanded);

      if (!groupStructures[groupId]) {
        try {
          setLoadingGroupStructure(groupId);
          const response = await api.get<{ success: boolean; data: StructureData }>(
            `/api/v1/company_groups/${groupId}/structure`
          );
          if (response.success && response.data) {
            setGroupStructures(prev => ({ ...prev, [groupId]: response.data }));
          }
        } catch (error) {
          console.error(`Failed to load structure for group ${groupId}:`, error);
        } finally {
          setLoadingGroupStructure(null);
        }
      }
    }
  };

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

      if (response?.success && response.data) {
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

    // Filter people based on selected role filters
    return structureData.people
      .filter(p => {
        // Check if person has any of the selected roles
        const hasDirector = p.roles.some(r => r.type?.toLowerCase() === 'director');
        const hasSecretary = p.roles.some(r => r.type?.toLowerCase() === 'secretary');
        const hasShareholder = p.roles.some(r => r.type?.toLowerCase() === 'shareholder');
        const hasCorporateOfficer = p.roles.some(r => r.type?.toLowerCase() === 'corporate officer' || r.type?.toLowerCase() === 'officer');

        // If no filters selected, show nothing
        if (!structureFilters.shareholders && !structureFilters.directors && !structureFilters.secretary && !structureFilters.corporateOfficer) {
          return false;
        }

        // Show person if they match any selected filter
        return (structureFilters.directors && hasDirector) ||
               (structureFilters.secretary && hasSecretary) ||
               (structureFilters.shareholders && hasShareholder) ||
               (structureFilters.corporateOfficer && hasCorporateOfficer);
      })
      .map(p => ({
        id: p.id,
        contact_id: p.contact_id,
        name: p.name,
        email: p.email || "—",
        membership_type: p.membership_type,
        is_active: p.is_active ? "Yes" : "No",
        roles_summary: p.roles.map(r => `${r.type} @ ${r.company_name}`).join(", ") || "—",
        roles: p.roles,
      }));
  }, [structureData, structureFilters]);

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

  // Display labels for entity types
  const entityTypeLabels: Record<string, string> = {
    person: "People",
    company: "Companies",
    trust: "Trusts",
    sole_trader: "Sole Traders",
    price_only: "Price Only",
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
                {contact.contact_email && (
                  <div className="text-xs text-muted-foreground">
                    {contact.contact_email}
                  </div>
                )}
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
                title="Edit Contact"
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
    <FullHeightContainer>
      <ScrollContent className="flex flex-col gap-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight font-serif">Corporate Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your companies, trusts, directors, and corporate structure
        </p>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-base font-medium mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction label="Company Groups" icon={Building2} href="/company-groups" color="indigo" />
            <QuickAction label="Add Company" icon={Plus} href="/corporate/companies/new" color="blue" />
            <QuickAction label="Add Asset" icon={Package} href="/corporate/assets/new" />
            <QuickAction label="View Directors" icon={Users} href="/corporate/directors" />
            <QuickAction label="Compliance Calendar" icon={Calendar} href="/corporate/compliance-calendar" />
            <QuickAction label="Minute Templates" icon={FileText} href="/corporate/minute-templates" />
            <QuickAction label="Xero Integration" icon={ExternalLink} href="/xero" />
            <QuickAction label="ASIC Logins" icon={Key} href="/corporate/asic-logins" />
            <QuickAction label="Document Types" icon={FileText} href="/corporate/document-types" />
            <QuickAction label="Consolidation" icon={ArrowLeftRight} href="/corporate/consolidation" />
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7 max-w-5xl">
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
            Charity Members
          </TabsTrigger>
          <TabsTrigger value="shareholders" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Shareholders
          </TabsTrigger>
          <TabsTrigger value="beneficiaries" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Trust Beneficiaries
          </TabsTrigger>
          <TabsTrigger value="structure" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Structure
          </TabsTrigger>
        </TabsList>

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
                  {groups.map((group) => {
                    const structure = groupStructures[group.id];

                    return (
                      <Card
                        key={group.id}
                        className="hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                              onClick={() => {
                                setSelectedGroupId(group.id);
                                setActiveTab("structure");
                                setIsStructureFullscreen(true);
                              }}
                            >
                              <FolderOpen className="h-5 w-5 text-indigo-600" />
                              <h3 className="font-medium">{group.name}</h3>
                              {group.active === false && (
                                <Badge variant="secondary" className="text-xs">Inactive</Badge>
                              )}
                              <Maximize2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditGroupDialog(group);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteGroup(group);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Companies list */}
                          <div className="mt-3 space-y-1">
                            {!structure ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading...</span>
                              </div>
                            ) : structure.companies && structure.companies.length > 0 ? (
                              (() => {
                                // Flatten all companies including children
                                const flattenCompanies = (companies: typeof structure.companies, level = 0): Array<typeof structure.companies[0] & { _level: number }> => {
                                  const result: Array<typeof structure.companies[0] & { _level: number }> = [];
                                  for (const company of companies) {
                                    result.push({ ...company, _level: level });
                                    if (company.children && company.children.length > 0) {
                                      result.push(...flattenCompanies(company.children as typeof structure.companies, level + 1));
                                    }
                                  }
                                  return result;
                                };
                                const allCompanies = flattenCompanies(structure.companies);
                                const isExpanded = expandedGroups.has(group.id);
                                const displayCompanies = isExpanded ? allCompanies : allCompanies.slice(0, 5);
                                const hasMore = allCompanies.length > 5;

                                return (
                                  <>
                                    {displayCompanies.map((company) => (
                                      <div
                                        key={company.id}
                                        className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 cursor-pointer -mx-2"
                                        style={{ paddingLeft: `${8 + company._level * 16}px` }}
                                        onClick={() => router.push(`/corporate/companies/${company.id}`)}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {company._level > 0 && (
                                            <span className="text-muted-foreground text-xs">└</span>
                                          )}
                                          <Building2 className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                                          <span className="text-sm truncate">{company.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                          {company.hierarchy_level === 0 && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">
                                              Parent
                                            </Badge>
                                          )}
                                          {(company.entity_type === "Trust" || company.entity_type === "Superfund") && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                                              Trust
                                            </Badge>
                                          )}
                                          {company.is_trustee && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                              Trustee
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                    {hasMore && (
                                      <button
                                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 py-1 px-2 -mx-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedGroups(prev => {
                                            const next = new Set(prev);
                                            if (next.has(group.id)) {
                                              next.delete(group.id);
                                            } else {
                                              next.add(group.id);
                                            }
                                            return next;
                                          });
                                        }}
                                      >
                                        {isExpanded ? (
                                          <>
                                            <ChevronDown className="h-3 w-3" />
                                            Show less
                                          </>
                                        ) : (
                                          <>
                                            <ChevronRight className="h-3 w-3" />
                                            +{allCompanies.length - 5} more
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </>
                                );
                              })()
                            ) : (
                              <div className="text-sm text-muted-foreground py-2">
                                No companies
                              </div>
                            )}
                          </div>

                          {/* People count */}
                          {structure?.people && structure.people.length > 0 && (
                            <div className="mt-2 pt-2 border-t flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              <span>{structure.people.length} people</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="mt-4">
          <TeeemTableView
            foundationId="companies"
            tableName="All Companies"
            entries={companies}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            onRowDoubleClick={(company) => router.push(`/corporate/companies/${company.id}`)}
            enableExport={true}
            enableSchemaEditor={true}
            hideUpdateViewButton={true}
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
                          const name = (person.display_name || person.name || "Unknown") as string;
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
                                    onClick={() => setFullScreenPerson(person)}
                                    className="text-teal-600 hover:text-teal-800 flex items-center gap-1"
                                    title="View Structure"
                                  >
                                    <GitBranch className="h-4 w-4" />
                                    Structure
                                  </button>
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

          {/* Full Screen Person Structure Overlay */}
          {fullScreenPerson && (
            <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
              {/* Floating action buttons in top-right corner */}
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFullScreenPerson(null);
                    router.push(`/contacts/${fullScreenPerson?.id}`);
                  }}
                  className="bg-white/90 hover:bg-white shadow-sm"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Contact
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFullScreenPerson(null)}
                  className="bg-white/90 hover:bg-white shadow-sm"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Full screen chart */}
              <div className="flex-1 overflow-hidden">
                {loadingPersonRoles ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <PersonStructureChart
                    personName={String(fullScreenPerson?.display_name || fullScreenPerson?.name || "")}
                    personEmail={fullScreenPerson?.email as string | null}
                    ownershipChain={fullScreenPersonOwnershipChain}
                    directorRoles={fullScreenPersonRoles
                      .filter(r => ["director", "secretary", "public_officer", "corporate_officer", "officer"].includes(r.type || ""))
                      .map(r => ({
                        company_id: r.company_id,
                        company_name: r.company_name,
                        position: r.type, // Use type for role classification (director/secretary/officer)
                        is_current: r.is_current,
                      }))}
                    onCompanyClick={(companyId) => {
                      setFullScreenPerson(null);
                      router.push(`/corporate/companies/${companyId}`);
                    }}
                    fullscreen
                  />
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Memberships Tab */}
        <TabsContent value="memberships" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-pink-600" />
                Charity Members ({memberships.length})
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
                  {/* Group contacts by entity type */}
                  {["person", "company", "sole_trader", "trust", "price_only", "unknown"].map((entityType) => {
                    const contacts = groupedByEntityType[entityType];
                    if (contacts.length === 0) return null;
                    return (
                      <div key={entityType}>
                        <h3 className={`font-medium mb-2 flex items-center gap-2 ${
                          isPerson(entityType) ? "text-teal-600" :
                          isCompany(entityType) ? "text-blue-600" :
                          isTrust(entityType) ? "text-rose-500" : "text-gray-600"
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

        {/* Shareholders Tab */}
        <TabsContent value="shareholders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-600" />
                Shareholders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ShareholdersTable />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trust Beneficiaries Tab */}
        <TabsContent value="beneficiaries" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-rose-600" />
                Trust Beneficiaries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BeneficiariesTable />
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
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setIsStructureFullscreen(true);
                }}
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
                    <span className="text-sm text-muted-foreground">Show:</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={structureFilters.shareholders}
                        onChange={(e) => setStructureFilters(prev => ({ ...prev, shareholders: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-amber-700 dark:text-amber-400">Shareholders</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={structureFilters.directors}
                        onChange={(e) => setStructureFilters(prev => ({ ...prev, directors: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-purple-700 dark:text-purple-400">Directors</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={structureFilters.secretary}
                        onChange={(e) => setStructureFilters(prev => ({ ...prev, secretary: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-blue-700 dark:text-blue-400">Secretary</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={structureFilters.corporateOfficer}
                        onChange={(e) => setStructureFilters(prev => ({ ...prev, corporateOfficer: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-green-700 dark:text-green-400">Officer</span>
                    </label>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={structureFilters.ownershipLinks}
                        onChange={(e) => setStructureFilters(prev => ({ ...prev, ownershipLinks: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-emerald-700 dark:text-emerald-400">Ownership Links</span>
                    </label>
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
              {structureData && structureData.people.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-5 w-5 text-teal-600" />
                      People in Group ({peopleRows.length})
                    </CardTitle>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={structureFilters.shareholders}
                          onChange={(e) => setStructureFilters(prev => ({ ...prev, shareholders: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm text-amber-700 dark:text-amber-400">Shareholders</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={structureFilters.directors}
                          onChange={(e) => setStructureFilters(prev => ({ ...prev, directors: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-purple-700 dark:text-purple-400">Directors</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={structureFilters.secretary}
                          onChange={(e) => setStructureFilters(prev => ({ ...prev, secretary: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-blue-700 dark:text-blue-400">Secretary</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={structureFilters.corporateOfficer}
                          onChange={(e) => setStructureFilters(prev => ({ ...prev, corporateOfficer: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-green-700 dark:text-green-400">Corporate Officer</span>
                      </label>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {peopleRows.length > 0 ? (
                      <TeeemTableView
                        entries={peopleRows}
                        columns={peopleColumns}
                        tableName={`${structureData.group.name} People`}
                        viewOnly={true}
                        onRowClick={(row) => {
                          // Find the full person data to show in detail panel
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
                <div className="mt-6 space-y-6">
                  {/* Contact Info */}
                  <div>
                    <p className="text-sm text-muted-foreground">{selectedPerson.email || "No email"}</p>
                    <Badge className="mt-2" variant={selectedPerson.is_active ? "default" : "secondary"}>
                      {selectedPerson.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {/* Directorships */}
                  {selectedPerson.roles.filter(r => r.type === "director").length > 0 && (
                    <div>
                      <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Directorships ({selectedPerson.roles.filter(r => r.type === "director").length})
                      </h4>
                      <div className="space-y-2">
                        {selectedPerson.roles.filter(r => r.type === "director").map((role, i) => (
                          <div key={i} className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3">
                            <button
                              onClick={() => router.push(`/corporate/companies/${role.company_id}`)}
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
                  {selectedPerson.roles.filter(r => r.type === "shareholder").length > 0 && (
                    <div>
                      <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Shareholdings ({selectedPerson.roles.filter(r => r.type === "shareholder").length})
                      </h4>
                      <div className="space-y-2">
                        {selectedPerson.roles.filter(r => r.type === "shareholder").map((role, i) => (
                          <div key={i} className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                            <button
                              onClick={() => router.push(`/corporate/companies/${role.company_id}`)}
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
                  {selectedPerson.roles.filter(r => r.type === "secretary").length > 0 && (
                    <div>
                      <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Secretary ({selectedPerson.roles.filter(r => r.type === "secretary").length})
                      </h4>
                      <div className="space-y-2">
                        {selectedPerson.roles.filter(r => r.type === "secretary").map((role, i) => (
                          <div key={i} className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                            <button
                              onClick={() => router.push(`/corporate/companies/${role.company_id}`)}
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
                  {selectedPerson.roles.filter(r => ["public_officer", "corporate_officer", "officer"].includes(r.type || "")).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Public/Corporate Officer ({selectedPerson.roles.filter(r => ["public_officer", "corporate_officer", "officer"].includes(r.type || "")).length})
                      </h4>
                      <div className="space-y-2">
                        {selectedPerson.roles.filter(r => ["public_officer", "corporate_officer", "officer"].includes(r.type || "")).map((role, i) => (
                          <div key={i} className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                            <button
                              onClick={() => router.push(`/corporate/companies/${role.company_id}`)}
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
                      onClick={() => router.push(`/contacts/${selectedPerson.contact_id}`)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Full Contact Profile
                    </Button>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </TabsContent>
      </Tabs>

      {/* Fullscreen Structure Chart Modal */}
      {isStructureFullscreen && structureData && (
        <div className="fixed inset-0 z-50 bg-background">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-background border-b flex items-center justify-between px-6 z-10">
            <div className="flex items-center gap-4">
              <Building2 className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold">{structureData.group.name} - Structure Chart</h2>
            </div>
            <div className="flex items-center gap-4">
              {/* Filters in fullscreen */}
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
          {/* Chart takes full remaining space */}
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
      </ScrollContent>
    </FullHeightContainer>
  );
}
