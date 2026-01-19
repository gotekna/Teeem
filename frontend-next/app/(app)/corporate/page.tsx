"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  X,
  Settings,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { API_TIMEOUT_HEAVY_SYNC } from "@/lib/constants/timeout-constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow as TeeemTableRow } from "@/components/table/types";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { FullHeightContainer, ScrollContent } from "@/components/ui/layout-containers";
import dynamic from "next/dynamic";
import { CorporateStructureTab } from "@/components/corporate/CorporateStructureTab";
import { Spinner } from "@/components/ui/spinner";

const PersonStructureChart = dynamic(
  () => import("@/components/corporate/PersonStructureChart"),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center"><Spinner size={32} /></div> }
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
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline";
  color?: string;
  loading?: boolean;
  disabled?: boolean;
}

function QuickAction({ label, icon: Icon, href, onClick, variant = "outline", color, loading, disabled }: QuickActionProps) {
  const router = useRouter();

  const getButtonClass = () => {
    if (color === "green") return "bg-green-600 hover:bg-green-700 text-white";
    if (color === "indigo") return "bg-indigo-600 hover:bg-indigo-700 text-white";
    if (color === "blue") return "bg-blue-600 hover:bg-blue-700 text-white";
    if (color === "purple") return "bg-purple-600 hover:bg-purple-700 text-white";
    if (variant === "primary") return "bg-primary hover:bg-primary/90 text-primary-foreground";
    return "";
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    }
  };

  return (
    <Button
      variant={variant === "outline" ? "outline" : "default"}
      className={cn("justify-start h-10", getButtonClass())}
      onClick={handleClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <Spinner size={16} className="mr-2" />
      ) : (
        Icon && <Icon className="h-4 w-4 mr-2" />
      )}
      {loading ? "Syncing..." : label}
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
        <Spinner size={24} className="text-muted-foreground" />
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
      <Table className="w-full text-sm">
        <TableHeader>
          <TableRow className="border-b">
            <TableHead className="text-left py-2 px-3 font-medium">Shareholder</TableHead>
            <TableHead className="text-left py-2 px-3 font-medium">Company</TableHead>
            <TableHead className="text-right py-2 px-3 font-medium">Shares</TableHead>
            <TableHead className="text-right py-2 px-3 font-medium">%</TableHead>
            <TableHead className="text-left py-2 px-3 font-medium">Class</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shareholdings.map((sh) => (
            <TableRow key={sh.id} className="border-b hover:bg-muted/50">
              <TableCell className="py-2 px-3">
                <button
                  onClick={() => router.push(`/contacts/${sh.shareholder_id}`)}
                  className="text-amber-600 hover:text-amber-800 hover:underline"
                >
                  {sh.shareholder_name}
                </button>
              </TableCell>
              <TableCell className="py-2 px-3">
                <button
                  onClick={() => router.push(`/corporate/companies/${sh.company_id}`)}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {sh.company_name}
                </button>
              </TableCell>
              <TableCell className="py-2 px-3 text-right font-mono">
                {sh.number_of_shares?.toLocaleString() || "—"}
              </TableCell>
              <TableCell className="py-2 px-3 text-right">
                {sh.percentage ? `${sh.percentage}%` : "—"}
              </TableCell>
              <TableCell className="py-2 px-3">
                {sh.share_class || "Ordinary"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
        <Spinner size={24} className="text-muted-foreground" />
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
      <Table className="w-full text-sm">
        <TableHeader>
          <TableRow className="border-b">
            <TableHead className="text-left py-2 px-3 font-medium">Beneficiary</TableHead>
            <TableHead className="text-left py-2 px-3 font-medium">Trust</TableHead>
            <TableHead className="text-left py-2 px-3 font-medium">Type</TableHead>
            <TableHead className="text-right py-2 px-3 font-medium">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {beneficiaries.map((b) => (
            <TableRow key={b.id} className="border-b hover:bg-muted/50">
              <TableCell className="py-2 px-3">
                <button
                  onClick={() => router.push(`/contacts/${b.beneficiary_id}`)}
                  className="text-rose-600 hover:text-rose-800 hover:underline"
                >
                  {b.beneficiary_name}
                </button>
              </TableCell>
              <TableCell className="py-2 px-3">
                <button
                  onClick={() => router.push(`/corporate/companies/${b.trust_id}`)}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {b.trust_name}
                </button>
              </TableCell>
              <TableCell className="py-2 px-3">
                {b.beneficiary_type || "—"}
              </TableCell>
              <TableCell className="py-2 px-3 text-right">
                {b.percentage ? `${b.percentage}%` : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ===== MAIN COMPONENT =====

export default function CorporateDashboardPage() {
  useSetLayoutMode("full-height");
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { confirm } = useConfirm();

  // Parse tab from path: /corporate/structure → "structure", /corporate → "groups"
  const activeTab = React.useMemo(() => {
    const parts = pathname.replace("/corporate", "").split("/").filter(Boolean);
    // Skip "companies" and other sub-routes (they have their own pages)
    const VALID_TABS = ["groups", "memberships", "people", "structure"];
    if (parts[0] && VALID_TABS.includes(parts[0])) {
      return parts[0];
    }
    return "groups";
  }, [pathname]);

  const handleTabChange = React.useCallback((tabId: string) => {
    // Path-based navigation: /corporate, /corporate/structure, etc.
    const url = tabId === "groups" ? "/corporate" : `/corporate/${tabId}`;
    router.push(url, { scroll: false });
  }, [router]);

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
  const [companies, setCompanies] = React.useState<TeeemTableRow[]>([]);

  // Company groups state
  const [groups, setGroups] = React.useState<CompanyGroup[]>([]);
  const [groupsMap, setGroupsMap] = React.useState<Record<number, string>>({});
  const [selectedGroupId, setSelectedGroupId] = React.useState<number | null>(null);
  const [memberships, setMemberships] = React.useState<Membership[]>([]);
  const [loadingMemberships, setLoadingMemberships] = React.useState(false);
  const [groupByEntityType, setGroupByEntityType] = React.useState(false);
  const [expandedContacts, setExpandedContacts] = React.useState<Set<number>>(new Set());

  // NOTE: Structure tab state moved to CorporateStructureTab component

  // People tab state
  const [people, setPeople] = React.useState<TeeemTableRow[]>([]);
  const [loadingPeople, setLoadingPeople] = React.useState(false);
  const [fullScreenPerson, setFullScreenPerson] = React.useState<TeeemTableRow | null>(null);
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

  // Xero sync state
  const [syncingXero, setSyncingXero] = React.useState(false);

  // Handle sync all Xero companies
  const handleSyncAllXero = async () => {
    setSyncingXero(true);
    try {
      interface SyncData {
        total_companies: number;
        successful: number;
        failed: number;
      }
      interface SyncResponse {
        success: boolean;
        data?: SyncData;
        error?: string;
      }
      // Use longer timeout for syncing all companies (can take 30-60 seconds)
      // SSoT: Uses API_TIMEOUT_HEAVY_SYNC from timeout-constants.ts
      const response = await api.post<SyncResponse>('/api/v1/xero/sync_all_companies', undefined, { timeout: API_TIMEOUT_HEAVY_SYNC });
      if (response?.success && response?.data) {
        const data = response.data;
        toast({ title: "Xero Sync Complete", description: `Total: ${data.total_companies} companies, Successful: ${data.successful}, Failed: ${data.failed}` });
      } else {
        toast({ title: "Error", description: `Xero Sync Failed: ${response?.error || 'Unknown error'}`, variant: "destructive" });
      }
    } catch (error: unknown) {
      console.error('Xero sync error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "Error", description: `Xero Sync Error: ${message}`, variant: "destructive" });
    } finally {
      setSyncingXero(false);
    }
  };

  // Load initial data
  React.useEffect(() => {
    loadDashboardData();
    loadGroups();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load companies - only those belonging to a Company Group (corporate entities)
      const companiesResponse = await api.get<{ companies: TeeemTableRow[] }>("/api/v1/companies");
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

  // NOTE: Structure loading now handled by CorporateStructureTab component

  // Load people when people tab is active - only people linked to company groups
  React.useEffect(() => {
    const loadPeople = async () => {
      try {
        setLoadingPeople(true);
        // Get all people from all company groups (people who have memberships)
        const allPeople: TeeemTableRow[] = [];
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
            `/api/v1/contacts/corporate_structure/${contactId}/ownership_chain`
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

  const handleEdit = async (entry: TeeemTableRow) => {
    try {
      const response = await api.patch<{ company: TeeemTableRow }>(`/api/v1/companies/${entry.id}`, { company: entry });
      setCompanies(companies.map((c) => (c.id === entry.id ? response.company : c)));
    } catch (err) {
      console.error("Failed to update company:", err);
    }
  };

  const handleDelete = async (entry: TeeemTableRow) => {
    if (!(await confirm(`Delete company "${entry.name}"? This cannot be undone.`))) return;

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
      toast({ title: "Validation Error", description: "Group name is required", variant: "destructive" });
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
        toast({ title: "Success", description: "Group created successfully" });
      }
    } catch (err) {
      console.error("Failed to create group:", err);
      toast({ title: "Error", description: "Failed to create group. Please try again.", variant: "destructive" });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !newGroupForm.name.trim()) {
      toast({ title: "Validation Error", description: "Group name is required", variant: "destructive" });
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
        toast({ title: "Success", description: "Group updated successfully" });
      }
    } catch (err) {
      console.error("Failed to update group:", err);
      toast({ title: "Error", description: "Failed to update group. Please try again.", variant: "destructive" });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (group: CompanyGroup) => {
    if (group.companies_count && group.companies_count > 0) {
      toast({ title: "Cannot Delete", description: `Cannot delete group with ${group.companies_count} companies. Reassign companies first.`, variant: "destructive" });
      return;
    }

    const confirmed = await confirm({
      title: "Delete Group",
      description: `Delete group "${group.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      await api.delete(`/api/v1/company_groups/${group.id}`);
      setGroups(groups.filter(g => g.id !== group.id));
      const newMap = { ...groupsMap };
      delete newMap[group.id];
      setGroupsMap(newMap);
      if (selectedGroupId === group.id) {
        setSelectedGroupId(null);
      }
      toast({ title: "Success", description: "Group deleted successfully" });
    } catch (err) {
      console.error("Failed to delete group:", err);
      toast({ title: "Error", description: "Failed to delete group. Please try again.", variant: "destructive" });
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

  // NOTE: Structure helpers (flattenHierarchy, structureColumns, structureRows, peopleColumns, peopleRows)
  // now in CorporateStructureTab component

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
        return "bg-muted text-foreground dark:bg-background/30 dark:text-muted-foreground";
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
        return "bg-muted text-foreground dark:bg-background/30 dark:text-muted-foreground";
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
                  router.push(`/contacts/${contact.contact_id}/edit`);
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
    { name: "Total Companies", value: stats.totalCompanies, icon: Building2, href: "/corporate/companies" },
    { name: "Active Companies", value: stats.activeCompanies, icon: CheckCircle2, href: "/corporate/companies" },
    { name: "Total Assets", value: stats.totalAssets, icon: Package, href: "/corporate/assets" },
    { name: "Compliance Due", value: stats.complianceDueSoon, icon: Clock, href: "/corporate/compliance-calendar", alert: stats.complianceDueSoon > 0 },
  ];

  // ===== LOADING STATE =====

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
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
            <QuickAction label="Manage Groups" icon={Building2} href="/admin/system/company/groups" color="indigo" />
            <QuickAction label="Manage Companies" icon={Plus} href="/admin/system/company/companies" color="blue" />
            <QuickAction label="Add Asset" icon={Package} href="/corporate/assets/new" />
            <QuickAction label="View Directors" icon={Users} href="/corporate/directors" />
            <QuickAction label="Compliance Calendar" icon={Calendar} href="/corporate/compliance-calendar" />
            <QuickAction label="Minute Templates" icon={FileText} href="/corporate/minute-templates" />
            <QuickAction label="Xero Integration" icon={ExternalLink} href="/xero" />
            <QuickAction label="Sync All Xero" icon={RefreshCw} onClick={handleSyncAllXero} loading={syncingXero} color="purple" />
            <QuickAction label="Financial Dashboard" icon={DollarSign} href="/financial" color="green" />
            <QuickAction label="ASIC Logins" icon={Key} href="/corporate/asic-logins" />
            <QuickAction label="Document Types" icon={FileText} href="/corporate/document-types" />
            <QuickAction label="Consolidation" icon={ArrowLeftRight} href="/corporate/consolidation" />
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
              <Button variant="outline" onClick={() => router.push("/admin/system/company/groups")}>
                <Settings className="h-4 w-4 mr-2" />
                Manage in Admin
              </Button>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No groups yet</p>
                  <p className="text-sm mt-1">Create groups in Admin &gt; System &gt; Company</p>
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
                                handleTabChange("structure");
                              }}
                            >
                              <FolderOpen className="h-5 w-5 text-indigo-600" />
                              <h3 className="font-medium">{group.name}</h3>
                              {group.active === false && (
                                <Badge variant="secondary" className="text-xs">Inactive</Badge>
                              )}
                              <Maximize2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                            {/* Edit/Delete moved to Admin > Corporate */}
                          </div>

                          {/* Companies list */}
                          <div className="mt-3 space-y-1">
                            {!structure ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Spinner size={12} />
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
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              router.push(`/financial/company/${company.id}`);
                                            }}
                                            className="p-0.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                            title="Open Financial Dashboard"
                                          >
                                            <DollarSign className="h-3.5 w-3.5 text-green-600" />
                                          </button>
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
            onRowDoubleClick={(company) => router.push(`/corporate/companies/${company.id}`)}
            enableExport={true}
            enableSchemaEditor={true}
            hideUpdateViewButton={true}
            leftActions={
              <Button variant="outline" onClick={() => router.push("/admin/system/company/companies")}>
                <Settings className="h-4 w-4 mr-2" />
                Manage in Admin
              </Button>
            }
          />
        </TabsContent>

        {/* People Tab */}
        <TabsContent value="people" className="mt-4">
          {loadingPeople ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size={32} className="text-muted-foreground" />
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
                    <Table className="w-full text-sm">
                      <TableHeader>
                        <TableRow className="border-b">
                          <TableHead className="text-left py-2 px-3 font-medium">Name</TableHead>
                          <TableHead className="text-left py-2 px-3 font-medium">Email</TableHead>
                          <TableHead className="text-left py-2 px-3 font-medium">Roles</TableHead>
                          <TableHead className="text-left py-2 px-3 font-medium">Company Groups</TableHead>
                          <TableHead className="text-left py-2 px-3 font-medium">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {people.map((person) => {
                          const name = (person.display_name || person.name || "Unknown") as string;
                          const email = (person.email || "—") as string;
                          const membershipTypes = (person.membership_types || []) as string[];
                          const groupNames = (person.company_group_names || []) as string[];
                          return (
                            <TableRow key={person.id} className="border-b hover:bg-muted/50">
                              <TableCell className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-teal-500" />
                                  <div className="font-medium">{name}</div>
                                </div>
                              </TableCell>
                              <TableCell className="py-2 px-3 text-muted-foreground">
                                {email}
                              </TableCell>
                              <TableCell className="py-2 px-3">
                                <div className="flex flex-wrap gap-1">
                                  {membershipTypes.map((type, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {type.replace('_', ' ')}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="py-2 px-3">
                                <div className="flex flex-wrap gap-1">
                                  {groupNames.map((gn, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {gn}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="py-2 px-3">
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
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Full Screen Person Structure Overlay */}
          {fullScreenPerson && (
            <div className="fixed inset-0 z-50 bg-white dark:bg-background flex flex-col">
              {/* Floating action buttons in top-right corner */}
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFullScreenPerson(null);
                    router.push(`/contacts/${fullScreenPerson?.id}`);
                  }}
                  className="bg-white/90 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-900 shadow-sm"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Contact
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFullScreenPerson(null)}
                  className="bg-white/90 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-900 shadow-sm"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Full screen chart */}
              <div className="flex-1 overflow-hidden">
                {loadingPersonRoles ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner size={32} className="text-muted-foreground" />
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
                  <Spinner size={24} className="text-muted-foreground" />
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
                          isTrust(entityType) ? "text-rose-500" : "text-muted-foreground"
                        }`}>
                          {entityTypeLabels[entityType]} ({contacts.length})
                        </h3>
                        <div className="overflow-x-auto border rounded-lg">
                          <Table className="w-full text-sm">
                            <TableHeader>
                              <TableRow className="border-b bg-muted/30">
                                <TableHead className="text-left py-2 px-3 font-medium">Contact</TableHead>
                                <TableHead className="text-left py-2 px-3 font-medium">Entity Type</TableHead>
                                <TableHead className="text-left py-2 px-3 font-medium">Company</TableHead>
                                <TableHead className="text-left py-2 px-3 font-medium">Membership</TableHead>
                                <TableHead className="text-left py-2 px-3 font-medium">Group</TableHead>
                                <TableHead className="text-left py-2 px-3 font-medium">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {contacts.map(renderContactRow)}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full text-sm">
                    <TableHeader>
                      <TableRow className="border-b">
                        <TableHead className="text-left py-2 px-3 font-medium">Contact</TableHead>
                        <TableHead className="text-left py-2 px-3 font-medium">Entity Type</TableHead>
                        <TableHead className="text-left py-2 px-3 font-medium">Company</TableHead>
                        <TableHead className="text-left py-2 px-3 font-medium">Membership</TableHead>
                        <TableHead className="text-left py-2 px-3 font-medium">Group</TableHead>
                        <TableHead className="text-left py-2 px-3 font-medium">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedByContact.map(renderContactRow)}
                    </TableBody>
                  </Table>
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
        {/* Structure Tab - Extracted to CorporateStructureTab component */}
        <TabsContent value="structure" className="mt-4">
          <CorporateStructureTab
            groups={groups}
            initialGroupId={selectedGroupId}
            onGroupChange={setSelectedGroupId}
          />
        </TabsContent>

      </Tabs>
      {/* NOTE: Fullscreen Structure Chart Modal now handled by CorporateStructureTab component */}
      </ScrollContent>
    </FullHeightContainer>
  );
}
