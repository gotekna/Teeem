"use client";

/**
 * SSoT: Contact Corporate Details Sub-Tab
 * Part of Contact SSoT Consolidation
 *
 * This component displays Corporate-specific details for company/trust contacts.
 * It shows the company's own corporate data (ASIC, compliance, share register)
 * as opposed to the person-centric view (person's roles in companies).
 *
 * API Endpoints (SSoT):
 * - GET /api/v1/contacts/corporate/:contact_id/details
 * - GET /api/v1/contacts/corporate/:contact_id/directors
 * - GET /api/v1/contacts/corporate/:contact_id/shareholders
 * - GET /api/v1/contacts/corporate/:contact_id/compliance
 * - GET /api/v1/contacts/corporate/:contact_id/hierarchy
 * - POST /api/v1/contacts/corporate/:contact_id/enable
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  FileText,
  Users,
  Percent,
  ShieldCheck,
  Network,
  AlertTriangle,
  CheckCircle,
  Clock,
  Lock,
  ExternalLink,
  Calendar,
  Landmark,
  Hash,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import TeeemTableView from "@/components/table/TeeemTableView";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import type { Contact } from "../types";

// Type definitions for corporate data
interface CorporateDetails {
  id: number;
  contact_id: number;
  name: string;
  code: string | null;
  slug: string | null;
  entity_type: string | null;
  acn: string | null;
  abn: string | null;
  date_incorporated: string | null;
  state_of_incorporation: string | null;
  status: string;
  is_trustee: boolean;
  trust_name: string | null;
  trustee_type: string | null;
  registered_office_address: string | null;
  principal_place_of_business: string | null;
  tfn: string;
  corporate_key: string;
  asic_username: string;
  gst_registration_status: string | null;
  gst_registration_date: string | null;
  accounting_method: string | null;
  bas_frequency: string | null;
  financial_year_end: number | null;
  shares_on_issue: number | null;
  share_classes: string[] | null;
  company_group_id: number | null;
  group_name: string | null;
  health_score: number | null;
  health_status: string | null;
  review_date: string | null;
  has_xero_connection: boolean;
  created_at: string;
  updated_at: string;
}

interface Director {
  id: number;
  contact_id: number;
  contact_name: string | null;
  position: string;
  formatted_position: string | null;
  appointment_date: string | null;
  resignation_date: string | null;
  is_current: boolean;
  notes: string | null;
  created_at: string;
}

interface Shareholder {
  id: number;
  shareholder_type: string;
  shareholder_id: number;
  shareholder_name: string | null;
  share_class: string | null;
  number_of_shares: number | null;
  percentage_of_total: number | null;
  beneficially_held: boolean;
  acquisition_date: string | null;
  created_at: string;
}

interface ComplianceItem {
  id: number;
  item_type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  completed_date: string | null;
  completed_by: string | null;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  created_at: string;
}

interface ComplianceData {
  items: ComplianceItem[];
  overdue_count: number;
  upcoming_count: number;
  health_score: number | null;
  health_status: string | null;
}

interface HierarchyContact {
  id: number;
  display_name: string;
  entity_type: string;
  is_corporate_managed: boolean;
  corporate_details_id: number | null;
}

interface HierarchyData {
  contact: HierarchyContact;
  parent: HierarchyContact | null;
  subsidiaries: HierarchyContact[];
  corporate_hierarchy: Record<string, unknown>;
}

interface ContactCorporateDetailsSubTabProps {
  contact: Contact;
  activeSubTab: string;
  onSubTabChange: (value: string) => void;
}

export function ContactCorporateDetailsSubTab({
  contact,
  activeSubTab,
  onSubTabChange,
}: ContactCorporateDetailsSubTabProps) {
  const { toast } = useToast();

  // State for corporate data
  const [details, setDetails] = useState<CorporateDetails | null>(null);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);

  // Loading states
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [loadingDirectors, setLoadingDirectors] = useState(true);
  const [loadingShareholders, setLoadingShareholders] = useState(true);
  const [loadingCompliance, setLoadingCompliance] = useState(true);
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);
  const [enablingCorporate, setEnablingCorporate] = useState(false);

  // State for corporate not enabled
  const [corporateNotEnabled, setCorporateNotEnabled] = useState(false);
  const [canEnable, setCanEnable] = useState(false);

  // Fetch corporate details
  const fetchDetails = useCallback(async () => {
    try {
      setLoadingDetails(true);
      const response = await api.get<{ success: boolean; data: CorporateDetails; can_enable?: boolean; error?: string }>(
        `/api/v1/contacts/corporate/${contact.id}/details`
      );
      if (response.success) {
        setDetails(response.data);
        setCorporateNotEnabled(false);
      } else {
        if (response.error?.includes("corporate management enabled")) {
          setCorporateNotEnabled(true);
          setCanEnable(response.can_enable || false);
        }
      }
    } catch (err) {
      // May fail if corporate not enabled - that's OK
      setCorporateNotEnabled(true);
    } finally {
      setLoadingDetails(false);
    }
  }, [contact.id]);

  // Fetch directors
  const fetchDirectors = useCallback(async () => {
    try {
      setLoadingDirectors(true);
      const response = await api.get<{ success: boolean; data: Director[] }>(
        `/api/v1/contacts/corporate/${contact.id}/directors`
      );
      if (response.success) {
        setDirectors(response.data);
      }
    } catch {
      // Corporate not enabled
    } finally {
      setLoadingDirectors(false);
    }
  }, [contact.id]);

  // Fetch shareholders
  const fetchShareholders = useCallback(async () => {
    try {
      setLoadingShareholders(true);
      const response = await api.get<{ success: boolean; data: Shareholder[] }>(
        `/api/v1/contacts/corporate/${contact.id}/shareholders`
      );
      if (response.success) {
        setShareholders(response.data);
      }
    } catch {
      // Corporate not enabled
    } finally {
      setLoadingShareholders(false);
    }
  }, [contact.id]);

  // Fetch compliance
  const fetchCompliance = useCallback(async () => {
    try {
      setLoadingCompliance(true);
      const response = await api.get<{ success: boolean; data: ComplianceData }>(
        `/api/v1/contacts/corporate/${contact.id}/compliance`
      );
      if (response.success) {
        setCompliance(response.data);
      }
    } catch {
      // Corporate not enabled
    } finally {
      setLoadingCompliance(false);
    }
  }, [contact.id]);

  // Fetch hierarchy
  const fetchHierarchy = useCallback(async () => {
    try {
      setLoadingHierarchy(true);
      const response = await api.get<{ success: boolean; data: HierarchyData }>(
        `/api/v1/contacts/corporate/${contact.id}/hierarchy`
      );
      if (response.success) {
        setHierarchy(response.data);
      }
    } catch {
      // Corporate not enabled
    } finally {
      setLoadingHierarchy(false);
    }
  }, [contact.id]);

  // Enable corporate management
  const enableCorporateManagement = async () => {
    try {
      setEnablingCorporate(true);
      const response = await api.post<{ success: boolean; data: { contact_id: number; is_corporate_managed: boolean } }>(
        `/api/v1/contacts/corporate/${contact.id}/enable`
      );
      if (response?.success) {
        toast({
          title: "Corporate management enabled",
          description: "This contact now has corporate management features.",
        });
        setCorporateNotEnabled(false);
        // Refetch all data
        fetchDetails();
        fetchDirectors();
        fetchShareholders();
        fetchCompliance();
        fetchHierarchy();
      } else {
        toast({
          title: "Failed to enable",
          description: "Could not enable corporate management.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to enable corporate management.",
        variant: "destructive",
      });
    } finally {
      setEnablingCorporate(false);
    }
  };

  // Fetch all data on mount
  useEffect(() => {
    fetchDetails();
    fetchDirectors();
    fetchShareholders();
    fetchCompliance();
    fetchHierarchy();
  }, [fetchDetails, fetchDirectors, fetchShareholders, fetchCompliance, fetchHierarchy]);

  // If corporate not enabled, show enable prompt
  if (corporateNotEnabled) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Corporate Management
          </CardTitle>
          <CardDescription>
            Corporate management features are not enabled for this contact.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enable corporate management to track:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>ASIC registration details</li>
            <li>Directors and office holders</li>
            <li>Share register and shareholders</li>
            <li>Compliance tracking</li>
            <li>Company hierarchy</li>
          </ul>
          {canEnable && (
            <Button
              onClick={enableCorporateManagement}
              disabled={enablingCorporate}
              className="w-full"
            >
              {enablingCorporate ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Enabling...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Enable Corporate Management
                </>
              )}
            </Button>
          )}
          {!canEnable && (
            <p className="text-sm text-amber-600">
              Only company and trust contacts can have corporate management enabled.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs value={activeSubTab} onValueChange={onSubTabChange}>
      <TabsList className="mb-4">
        <TabsTrigger value="details">
          <FileText className="h-3.5 w-3.5 mr-1" />
          Details
        </TabsTrigger>
        <TabsTrigger value="directors">
          <Users className="h-3.5 w-3.5 mr-1" />
          Directors
          {directors.filter(d => d.is_current).length > 0 && (
            <Badge variant="secondary" className="ml-1.5">
              {directors.filter(d => d.is_current).length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="shareholders">
          <Percent className="h-3.5 w-3.5 mr-1" />
          Shareholders
          {shareholders.length > 0 && (
            <Badge variant="secondary" className="ml-1.5">
              {shareholders.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="compliance">
          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
          Compliance
          {compliance && compliance.overdue_count > 0 && (
            <Badge variant="destructive" className="ml-1.5">
              {compliance.overdue_count}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="hierarchy">
          <Network className="h-3.5 w-3.5 mr-1" />
          Hierarchy
        </TabsTrigger>
      </TabsList>

      {/* Details Sub-Tab */}
      <TabsContent value="details" className="mt-4">
        <DetailsSubTab details={details} loading={loadingDetails} />
      </TabsContent>

      {/* Directors Sub-Tab */}
      <TabsContent value="directors" className="mt-4">
        <DirectorsSubTab directors={directors} loading={loadingDirectors} />
      </TabsContent>

      {/* Shareholders Sub-Tab */}
      <TabsContent value="shareholders" className="mt-4">
        <ShareholdersSubTab
          shareholders={shareholders}
          loading={loadingShareholders}
          sharesOnIssue={details?.shares_on_issue}
        />
      </TabsContent>

      {/* Compliance Sub-Tab */}
      <TabsContent value="compliance" className="mt-4">
        <ComplianceSubTab compliance={compliance} loading={loadingCompliance} />
      </TabsContent>

      {/* Hierarchy Sub-Tab */}
      <TabsContent value="hierarchy" className="mt-4">
        <HierarchySubTab hierarchy={hierarchy} loading={loadingHierarchy} contactId={contact.id} />
      </TabsContent>
    </Tabs>
  );
}

// ================================
// Details Sub-Tab Component
// ================================

function DetailsSubTab({
  details,
  loading,
}: {
  details: CorporateDetails | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!details) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No corporate details available
        </CardContent>
      </Card>
    );
  }

  const isRestricted = (value: string | null) => value === "[RESTRICTED]";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Registration Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Registration Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">ACN</p>
              <p className="text-sm font-mono font-medium">{details.acn || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ABN</p>
              <p className="text-sm font-mono font-medium">{details.abn || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date Incorporated</p>
              <p className="text-sm font-medium">
                {details.date_incorporated
                  ? new Date(details.date_incorporated).toLocaleDateString()
                  : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">State</p>
              <p className="text-sm font-medium">{details.state_of_incorporation || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge
                className={
                  details.status === "active"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                }
              >
                {details.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entity Type</p>
              <p className="text-sm font-medium">{details.entity_type || "Company"}</p>
            </div>
          </div>

          {details.is_trustee && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Trust Name</p>
                  <p className="text-sm font-medium">{details.trust_name || "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Trustee Type</p>
                  <p className="text-sm font-medium">{details.trustee_type || "Not set"}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ASIC Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            ASIC Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Corporate Key</p>
              {isRestricted(details.corporate_key) ? (
                <span className="text-amber-600 flex items-center gap-1 text-sm">
                  <Lock className="h-3 w-3" /> Restricted
                </span>
              ) : (
                <p className="text-sm font-mono font-medium">{details.corporate_key || "Not set"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ASIC Username</p>
              {isRestricted(details.asic_username) ? (
                <span className="text-amber-600 flex items-center gap-1 text-sm">
                  <Lock className="h-3 w-3" /> Restricted
                </span>
              ) : (
                <p className="text-sm font-mono font-medium">{details.asic_username || "Not set"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">TFN</p>
              {isRestricted(details.tfn) ? (
                <span className="text-amber-600 flex items-center gap-1 text-sm">
                  <Lock className="h-3 w-3" /> Restricted
                </span>
              ) : (
                <p className="text-sm font-mono font-medium">{details.tfn || "Not set"}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Addresses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Addresses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Registered Office</p>
            <p className="text-sm whitespace-pre-line">
              {details.registered_office_address || "Not set"}
            </p>
          </div>
          <Separator />
          <div>
            <p className="text-xs text-muted-foreground">Principal Place of Business</p>
            <p className="text-sm whitespace-pre-line">
              {details.principal_place_of_business || "Not set"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Financial Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Financial Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">GST Registration</p>
              <Badge
                className={
                  details.gst_registration_status === "registered"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-muted text-muted-foreground"
                }
              >
                {details.gst_registration_status || "Unknown"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Accounting Method</p>
              <p className="text-sm font-medium capitalize">{details.accounting_method || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">BAS Frequency</p>
              <p className="text-sm font-medium capitalize">{details.bas_frequency || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Financial Year End</p>
              <p className="text-sm font-medium">
                {details.financial_year_end
                  ? `${details.financial_year_end === 6 ? "June" : `Month ${details.financial_year_end}`}`
                  : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Xero Connection</p>
              <Badge
                className={
                  details.has_xero_connection
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "bg-muted text-muted-foreground"
                }
              >
                {details.has_xero_connection ? "Connected" : "Not Connected"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ================================
// Directors Sub-Tab Component
// ================================

function DirectorsSubTab({
  directors,
  loading,
}: {
  directors: Director[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const currentDirectors = directors.filter((d) => d.is_current);
  const formerDirectors = directors.filter((d) => !d.is_current);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
            Current Directors ({currentDirectors.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentDirectors.length > 0 ? (
            <TeeemTableView
              entries={currentDirectors.map((d) => ({
                id: d.id,
                contact_id: d.contact_id,
                name: d.contact_name || "Unknown",
                position: d.formatted_position || d.position,
                appointed: d.appointment_date
                  ? new Date(d.appointment_date).toLocaleDateString()
                  : "-",
                notes: d.notes || "-",
              }))}
              columns={[
                { key: "name", label: "Name", column_type: "text" },
                { key: "position", label: "Position", column_type: "text" },
                { key: "appointed", label: "Appointed", column_type: "text" },
                { key: "notes", label: "Notes", column_type: "text" },
              ]}
              tableName="Current Directors"
              viewOnly={true}
            />
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No current directors on record.
            </p>
          )}
        </CardContent>
      </Card>

      {formerDirectors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <Users className="h-5 w-5" />
              Former Directors ({formerDirectors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TeeemTableView
              entries={formerDirectors.map((d) => ({
                id: d.id,
                contact_id: d.contact_id,
                name: d.contact_name || "Unknown",
                position: d.formatted_position || d.position,
                appointed: d.appointment_date
                  ? new Date(d.appointment_date).toLocaleDateString()
                  : "-",
                resigned: d.resignation_date
                  ? new Date(d.resignation_date).toLocaleDateString()
                  : "-",
              }))}
              columns={[
                { key: "name", label: "Name", column_type: "text" },
                { key: "position", label: "Position", column_type: "text" },
                { key: "appointed", label: "Appointed", column_type: "text" },
                { key: "resigned", label: "Resigned", column_type: "text" },
              ]}
              tableName="Former Directors"
              viewOnly={true}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ================================
// Shareholders Sub-Tab Component
// ================================

function ShareholdersSubTab({
  shareholders,
  loading,
  sharesOnIssue,
}: {
  shareholders: Shareholder[];
  loading: boolean;
  sharesOnIssue: number | null | undefined;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Share Capital Summary */}
      {sharesOnIssue && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-5 w-5 text-blue-600" />
              Share Capital
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Shares on Issue</p>
                <p className="text-lg font-bold">{sharesOnIssue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Shareholders</p>
                <p className="text-lg font-bold">{shareholders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shareholders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Shareholders ({shareholders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shareholders.length > 0 ? (
            <TeeemTableView
              entries={shareholders.map((s) => ({
                id: s.id,
                name: s.shareholder_name || "Unknown",
                type: s.shareholder_type,
                share_class: s.share_class || "Ordinary",
                shares: s.number_of_shares?.toLocaleString() || "-",
                percentage:
                  s.percentage_of_total != null
                    ? `${s.percentage_of_total.toFixed(1)}%`
                    : "-",
                beneficially_held: s.beneficially_held ? "Yes" : "No",
                acquired: s.acquisition_date
                  ? new Date(s.acquisition_date).toLocaleDateString()
                  : "-",
              }))}
              columns={[
                { key: "name", label: "Shareholder", column_type: "text" },
                { key: "type", label: "Type", column_type: "text" },
                { key: "share_class", label: "Class", column_type: "text" },
                { key: "shares", label: "Shares", column_type: "text" },
                { key: "percentage", label: "%", column_type: "text" },
                { key: "beneficially_held", label: "Beneficial", column_type: "text" },
                { key: "acquired", label: "Acquired", column_type: "text" },
              ]}
              tableName="Shareholders"
              viewOnly={true}
            />
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No shareholders on record.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ================================
// Compliance Sub-Tab Component
// ================================

function ComplianceSubTab({
  compliance,
  loading,
}: {
  compliance: ComplianceData | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!compliance) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No compliance data available
        </CardContent>
      </Card>
    );
  }

  const overdueItems = compliance.items.filter(
    (i) => !i.completed && i.due_date && new Date(i.due_date) < new Date()
  );
  const upcomingItems = compliance.items.filter(
    (i) =>
      !i.completed &&
      i.due_date &&
      new Date(i.due_date) >= new Date() &&
      new Date(i.due_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );
  const completedItems = compliance.items.filter((i) => i.completed);

  return (
    <div className="space-y-6">
      {/* Health Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            Compliance Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Health Score</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{compliance.health_score ?? "-"}%</p>
                {compliance.health_status && (
                  <Badge
                    className={
                      compliance.health_status === "excellent"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : compliance.health_status === "good"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : compliance.health_status === "needs_attention"
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    }
                  >
                    {compliance.health_status}
                  </Badge>
                )}
              </div>
              {compliance.health_score != null && (
                <Progress value={compliance.health_score} className="mt-2" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {overdueItems.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due in 30 Days</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {upcomingItems.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {completedItems.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Items */}
      {overdueItems.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Overdue ({overdueItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceTable items={overdueItems} variant="overdue" />
          </CardContent>
        </Card>
      )}

      {/* Upcoming Items */}
      {upcomingItems.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Clock className="h-5 w-5" />
              Due Soon ({upcomingItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceTable items={upcomingItems} variant="upcoming" />
          </CardContent>
        </Card>
      )}

      {/* Completed Items */}
      {completedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Completed ({completedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceTable items={completedItems} variant="completed" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ComplianceTable({
  items,
  variant,
}: {
  items: ComplianceItem[];
  variant: "overdue" | "upcoming" | "completed";
}) {
  return (
    <TeeemTableView
      entries={items.map((i) => ({
        id: i.id,
        title: i.title,
        type: i.item_type,
        due_date: i.due_date ? new Date(i.due_date).toLocaleDateString() : "-",
        completed_date: i.completed_date
          ? new Date(i.completed_date).toLocaleDateString()
          : "-",
        recurring: i.is_recurring ? "Yes" : "No",
      }))}
      columns={
        variant === "completed"
          ? [
              { key: "title", label: "Item", column_type: "text" },
              { key: "type", label: "Type", column_type: "text" },
              { key: "completed_date", label: "Completed", column_type: "text" },
              { key: "recurring", label: "Recurring", column_type: "text" },
            ]
          : [
              { key: "title", label: "Item", column_type: "text" },
              { key: "type", label: "Type", column_type: "text" },
              { key: "due_date", label: "Due Date", column_type: "text" },
              { key: "recurring", label: "Recurring", column_type: "text" },
            ]
      }
      tableName="Compliance Items"
      viewOnly={true}
    />
  );
}

// ================================
// Hierarchy Sub-Tab Component
// ================================

function HierarchySubTab({
  hierarchy,
  loading,
  contactId,
}: {
  hierarchy: HierarchyData | null;
  loading: boolean;
  contactId: number;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!hierarchy) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No hierarchy data available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Parent Company */}
      {hierarchy.parent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-5 w-5 text-indigo-600" />
              Parent Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/contacts/${hierarchy.parent.id}`}
              className="flex items-center gap-2 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{hierarchy.parent.display_name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {hierarchy.parent.entity_type}
                </p>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Current Company */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            This Company
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 rounded-lg bg-primary/10">
            <p className="font-medium">{hierarchy.contact.display_name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {hierarchy.contact.entity_type}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Subsidiaries */}
      {hierarchy.subsidiaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-5 w-5 text-indigo-600" />
              Subsidiaries ({hierarchy.subsidiaries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hierarchy.subsidiaries.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/contacts/${sub.id}`}
                  className="flex items-center gap-2 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{sub.display_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {sub.entity_type}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No hierarchy */}
      {!hierarchy.parent && hierarchy.subsidiaries.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Network className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No company hierarchy configured</p>
            <p className="text-sm mt-1">
              This company has no parent company or subsidiaries linked.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ContactCorporateDetailsSubTab;
