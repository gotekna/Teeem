"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IdCard,
  Table as TableIcon,
  Network,
  Lock,
  Home,
  Briefcase,
  Percent,
  Landmark,
  ShieldCheck,
  Building2,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TeeemTableView from "@/components/table/TeeemTableView";
import PersonStructureChart from "@/components/corporate/PersonStructureChart";
import type {
  Contact,
  Directorship,
  Shareholding,
  TrustRolesData,
  CompanyGroupMembership,
  OwnershipNode,
} from "../types";

// Import TableColumn type from TeeemTableView
type TableColumn = {
  key: string;
  label: string;
  column_type: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
};

interface ContactCorporateTabProps {
  contact: Contact;
  activeSubTab: string;
  handleCorporateSubTabChange: (value: string) => void;
  directorships: Directorship[];
  loadingDirectorships: boolean;
  shareholdings: Shareholding[];
  loadingShareholdings: boolean;
  trustRoles: TrustRolesData | null;
  loadingTrustRoles: boolean;
  memberships: CompanyGroupMembership[];
  loadingMemberships: boolean;
  ownershipChain: OwnershipNode[];
  loadingOwnershipChain: boolean;
}

export function ContactCorporateTab({
  contact,
  activeSubTab,
  handleCorporateSubTabChange,
  directorships,
  loadingDirectorships,
  shareholdings,
  loadingShareholdings,
  trustRoles,
  loadingTrustRoles,
  memberships,
  loadingMemberships,
  ownershipChain,
  loadingOwnershipChain,
}: ContactCorporateTabProps) {
  const router = useRouter();

  return (
    <Tabs value={activeSubTab} onValueChange={handleCorporateSubTabChange}>
      <TabsList className="mb-4">
        <TabsTrigger value="identity">
          <IdCard className="h-3.5 w-3.5 mr-1" />
          Identity
        </TabsTrigger>
        <TabsTrigger value="summary">
          <TableIcon className="h-3.5 w-3.5 mr-1" />
          Summary
          {(directorships.length > 0 || shareholdings.length > 0 || (trustRoles && trustRoles.total_count > 0) || memberships.length > 0) && (
            <Badge variant="secondary" className="ml-1.5">
              {directorships.length + shareholdings.length + (trustRoles?.total_count || 0) + memberships.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="structure">
          <Network className="h-3.5 w-3.5 mr-1" />
          Structure
        </TabsTrigger>
      </TabsList>

      {/* Identity Sub-Tab */}
      <TabsContent value="identity" className="mt-4">
        <IdentitySubTab contact={contact} />
      </TabsContent>

      {/* Summary Sub-Tab */}
      <TabsContent value="summary" className="mt-4">
        <SummarySubTab
          contact={contact}
          directorships={directorships}
          loadingDirectorships={loadingDirectorships}
          shareholdings={shareholdings}
          loadingShareholdings={loadingShareholdings}
          trustRoles={trustRoles}
          loadingTrustRoles={loadingTrustRoles}
          memberships={memberships}
          loadingMemberships={loadingMemberships}
          router={router}
        />
      </TabsContent>

      {/* Structure Sub-Tab */}
      <TabsContent value="structure" className="mt-4">
        <StructureSubTab
          contact={contact}
          directorships={directorships}
          loadingDirectorships={loadingDirectorships}
          ownershipChain={ownershipChain}
          loadingOwnershipChain={loadingOwnershipChain}
          router={router}
        />
      </TabsContent>
    </Tabs>
  );
}

// ================================
// Identity Sub-Tab
// ================================

function IdentitySubTab({ contact }: { contact: Contact }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Identity Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IdCard className="h-5 w-5" />
            Identity Information
            {!contact.can_view_confidential && (
              <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                <Lock className="h-3 w-3 mr-1" />
                Restricted
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Date of Birth */}
            <div>
              <p className="text-xs text-muted-foreground">Date of Birth</p>
              <p className="text-sm font-medium">
                {contact.date_of_birth === "[RESTRICTED]" ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Restricted
                  </span>
                ) : contact.date_of_birth ? (
                  new Date(contact.date_of_birth).toLocaleDateString()
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </p>
            </div>

            {/* Place of Birth */}
            <div>
              <p className="text-xs text-muted-foreground">Place of Birth</p>
              <p className="text-sm font-medium">
                {contact.place_of_birth === "[RESTRICTED]" ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Restricted
                  </span>
                ) : contact.place_of_birth ? (
                  `${contact.place_of_birth}${contact.birth_state ? `, ${contact.birth_state}` : ""}${contact.birth_country ? `, ${contact.birth_country}` : ""}`
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </p>
            </div>

            {/* Director ID (DIN) */}
            <div>
              <p className="text-xs text-muted-foreground">Director ID (DIN)</p>
              <p className="text-sm font-medium font-mono">
                {contact.director_id || <span className="text-muted-foreground">Not set</span>}
              </p>
            </div>

            {/* TFN */}
            <div>
              <p className="text-xs text-muted-foreground">Tax File Number</p>
              <p className="text-sm font-medium font-mono">
                {contact.abn === "[RESTRICTED]" ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Restricted
                  </span>
                ) : contact.abn ? (
                  contact.abn
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </p>
            </div>
          </div>

          <Separator />

          {/* Passport */}
          <div>
            <p className="text-xs text-muted-foreground">Passport Number</p>
            <p className="text-sm font-medium font-mono">
              {contact.passport_number === "[RESTRICTED]" ? (
                <span className="text-amber-600 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Restricted
                </span>
              ) : contact.passport_number ? (
                contact.passport_number
              ) : (
                <span className="text-muted-foreground">Not set</span>
              )}
            </p>
          </div>

          {/* Drivers Licence */}
          <div>
            <p className="text-xs text-muted-foreground">Drivers Licence</p>
            <p className="text-sm font-medium font-mono">
              {contact.drivers_licence === "[RESTRICTED]" ? (
                <span className="text-amber-600 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Restricted
                </span>
              ) : contact.drivers_licence ? (
                contact.drivers_licence
              ) : (
                <span className="text-muted-foreground">Not set</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Residential Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="h-5 w-5" />
            Residential Address
            {!contact.can_view_confidential && (
              <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                <Lock className="h-3 w-3 mr-1" />
                Restricted
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contact.residential_address === "[RESTRICTED]" ? (
            <div className="text-amber-600 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span>Restricted - You don&apos;t have permission to view this field</span>
            </div>
          ) : contact.residential_address ? (
            <p className="text-sm whitespace-pre-line">{contact.residential_address}</p>
          ) : (
            <p className="text-muted-foreground text-sm">No residential address on file</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ================================
// Summary Sub-Tab
// ================================

interface SummarySubTabProps {
  contact: Contact;
  directorships: Directorship[];
  loadingDirectorships: boolean;
  shareholdings: Shareholding[];
  loadingShareholdings: boolean;
  trustRoles: TrustRolesData | null;
  loadingTrustRoles: boolean;
  memberships: CompanyGroupMembership[];
  loadingMemberships: boolean;
  router: ReturnType<typeof useRouter>;
}

function SummarySubTab({
  contact,
  directorships,
  loadingDirectorships,
  shareholdings,
  loadingShareholdings,
  trustRoles,
  loadingTrustRoles,
  memberships,
  loadingMemberships,
  router,
}: SummarySubTabProps) {
  if (loadingDirectorships || loadingShareholdings || loadingTrustRoles || loadingMemberships) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Spinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Directorships Table */}
      <DirectorshipsTable directorships={directorships} router={router} />

      {/* Shareholdings Table */}
      <ShareholdingsTable shareholdings={shareholdings} router={router} />

      {/* Company Bank Accounts */}
      {contact.linked_company && contact.linked_company.bank_accounts && contact.linked_company.bank_accounts.length > 0 && (
        <BankAccountsTable contact={contact} />
      )}

      {/* Trust Roles Table */}
      {trustRoles && trustRoles.total_count > 0 && (
        <TrustRolesTable trustRoles={trustRoles} router={router} />
      )}

      {/* Company Groups Table */}
      <CompanyGroupsTable memberships={memberships} />
    </div>
  );
}

// ================================
// Summary Sub-Tab Components
// ================================

function DirectorshipsTable({
  directorships,
  router,
}: {
  directorships: Directorship[];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-green-600" />
          Directorships ({directorships.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {directorships.length > 0 ? (
          <TeeemTableView
            entries={directorships.map(d => ({
              id: d.id,
              company_id: d.company_id,
              company_name: d.company_name,
              position: d.formatted_position || d.position,
              company_group: d.company_group_name || "-",
              status: d.is_current ? "Current" : "Former",
              appointed: d.appointment_date ? new Date(d.appointment_date).toLocaleDateString() : "-",
              resigned: d.resignation_date ? new Date(d.resignation_date).toLocaleDateString() : "-",
            }))}
            columns={[
              { key: "company_name", label: "Company", column_type: "text" },
              { key: "position", label: "Position", column_type: "text" },
              { key: "company_group", label: "Group", column_type: "text" },
              { key: "status", label: "Status", column_type: "text" },
              { key: "appointed", label: "Appointed", column_type: "text" },
              { key: "resigned", label: "Resigned", column_type: "text" },
            ] as TableColumn[]}
            tableName="Directorships"
            viewOnly={true}
            onRowClick={(row) => router.push(`/corporate/companies/${row.company_id}`)}
            customCellRenderer={(entry, columnKey) => {
              if (columnKey === "status") {
                const status = entry.status as string;
                return (
                  <Badge className={status === "Current" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                    {status}
                  </Badge>
                );
              }
              return null;
            }}
          />
        ) : (
          <p className="text-muted-foreground text-center py-4">No directorships found.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ShareholdingsTable({
  shareholdings,
  router,
}: {
  shareholdings: Shareholding[];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Percent className="h-5 w-5 text-blue-600" />
          Shareholdings ({shareholdings.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {shareholdings.length > 0 ? (
          <TeeemTableView
            entries={shareholdings.map(sh => ({
              id: sh.id,
              company_id: sh.company_id,
              company_name: sh.company_name,
              share_class: sh.share_class || "Ordinary",
              shares: sh.number_of_shares?.toLocaleString() || "-",
              percentage: sh.percentage_of_total != null ? `${sh.percentage_of_total.toFixed(1)}%` : "-",
              company_group: sh.company_group_name || "-",
              status: !sh.disposal_date ? "Current" : "Disposed",
              acquired: sh.acquisition_date ? new Date(sh.acquisition_date).toLocaleDateString() : "-",
            }))}
            columns={[
              { key: "company_name", label: "Company", column_type: "text" },
              { key: "share_class", label: "Class", column_type: "text" },
              { key: "shares", label: "Shares", column_type: "text" },
              { key: "percentage", label: "%", column_type: "text" },
              { key: "company_group", label: "Group", column_type: "text" },
              { key: "status", label: "Status", column_type: "text" },
              { key: "acquired", label: "Acquired", column_type: "text" },
            ] as TableColumn[]}
            tableName="Shareholdings"
            viewOnly={true}
            onRowClick={(row) => router.push(`/corporate/companies/${row.company_id}`)}
            customCellRenderer={(entry, columnKey) => {
              if (columnKey === "status") {
                const status = entry.status as string;
                return (
                  <Badge className={status === "Current" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}>
                    {status}
                  </Badge>
                );
              }
              return null;
            }}
          />
        ) : (
          <p className="text-muted-foreground text-center py-4">No shareholdings found.</p>
        )}
      </CardContent>
    </Card>
  );
}

function BankAccountsTable({ contact }: { contact: Contact }) {
  if (!contact.linked_company?.bank_accounts) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="h-5 w-5 text-emerald-600" />
          Company Bank Accounts ({contact.linked_company.bank_accounts.length})
          <Link
            href={`/corporate/companies/${contact.linked_company.id}?subtab=bank-accounts`}
            className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
          >
            Edit in Corporate <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table className="w-full text-sm">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-left px-4 py-2 text-muted-foreground font-medium">Bank</TableHead>
                <TableHead className="text-left px-4 py-2 text-muted-foreground font-medium">BSB</TableHead>
                <TableHead className="text-left px-4 py-2 text-muted-foreground font-medium">Account</TableHead>
                <TableHead className="text-left px-4 py-2 text-muted-foreground font-medium">Name</TableHead>
                <TableHead className="text-left px-4 py-2 text-muted-foreground font-medium">Xero</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {contact.linked_company.bank_accounts.filter(ba => ba.status === "active").map((account) => (
                <TableRow key={account.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2 font-medium">{account.institution_name}</TableCell>
                  <TableCell className="px-4 py-2 font-mono">{account.formatted_bsb || account.bsb || "-"}</TableCell>
                  <TableCell className="px-4 py-2 font-mono">****{account.account_number.slice(-4)}</TableCell>
                  <TableCell className="px-4 py-2">{account.account_name || "-"}</TableCell>
                  <TableCell className="px-4 py-2">
                    {account.linked_to_xero ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Linked
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function TrustRolesTable({
  trustRoles,
  router,
}: {
  trustRoles: TrustRolesData;
  router: ReturnType<typeof useRouter>;
}) {
  const allRoles = [
    ...trustRoles.trustee_roles.map(r => ({
      id: r.id,
      trust_id: r.trust_id,
      trust_name: r.trust_name,
      role: "Trustee",
      entitlement: "-",
      status: r.is_active ? "Active" : "Inactive",
      since: r.start_date ? new Date(r.start_date).toLocaleDateString() : "-",
    })),
    ...trustRoles.beneficiary_roles.map(r => ({
      id: r.id,
      trust_id: r.trust_id,
      trust_name: r.trust_name,
      role: "Beneficiary",
      entitlement: r.ownership_percentage != null ? `${r.ownership_percentage.toFixed(1)}%` : "-",
      status: r.is_active ? "Active" : "Inactive",
      since: r.start_date ? new Date(r.start_date).toLocaleDateString() : "-",
    })),
    ...trustRoles.appointor_roles.map(r => ({
      id: r.id,
      trust_id: r.trust_id,
      trust_name: r.trust_name,
      role: "Appointor",
      entitlement: "-",
      status: r.is_active ? "Active" : "Inactive",
      since: r.start_date ? new Date(r.start_date).toLocaleDateString() : "-",
    })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-purple-600" />
          Trust Roles ({trustRoles.total_count})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TeeemTableView
          entries={allRoles}
          columns={[
            { key: "trust_name", label: "Trust", column_type: "text" },
            { key: "role", label: "Role", column_type: "text" },
            { key: "entitlement", label: "Entitlement", column_type: "text" },
            { key: "status", label: "Status", column_type: "text" },
            { key: "since", label: "Since", column_type: "text" },
          ] as TableColumn[]}
          tableName="Trust Roles"
          viewOnly={true}
          onRowClick={(row) => router.push(`/corporate/companies/${row.trust_id}`)}
          customCellRenderer={(entry, columnKey) => {
            if (columnKey === "role") {
              const role = entry.role as string;
              const colorClass = role === "Trustee"
                ? "bg-purple-100 text-purple-700"
                : role === "Beneficiary"
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700";
              return <Badge className={colorClass}>{role}</Badge>;
            }
            if (columnKey === "status") {
              const status = entry.status as string;
              return (
                <Badge className={status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                  {status}
                </Badge>
              );
            }
            return null;
          }}
        />
      </CardContent>
    </Card>
  );
}

function CompanyGroupsTable({
  memberships,
}: {
  memberships: CompanyGroupMembership[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-5 w-5 text-indigo-600" />
          Company Groups ({memberships.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {memberships.length > 0 ? (
          <TeeemTableView
            entries={memberships.map(m => ({
              id: m.id,
              company_group_id: m.company_group_id,
              company_group_name: m.company_group_name,
              membership_type: m.membership_type,
              company_name: m.company_name || "-",
              can_view: m.can_view_confidential ? "Yes" : "No",
              can_edit: m.can_edit ? "Yes" : "No",
              status: m.is_active ? "Active" : "Inactive",
            }))}
            columns={[
              { key: "company_group_name", label: "Group", column_type: "text" },
              { key: "membership_type", label: "Type", column_type: "text" },
              { key: "company_name", label: "Via Company", column_type: "text" },
              { key: "can_view", label: "View Confidential", column_type: "text" },
              { key: "can_edit", label: "Can Edit", column_type: "text" },
              { key: "status", label: "Status", column_type: "text" },
            ] as TableColumn[]}
            tableName="Company Groups"
            viewOnly={true}
            customCellRenderer={(entry, columnKey) => {
              if (columnKey === "membership_type") {
                const type = entry.membership_type as string;
                const colorClass = type === "director"
                  ? "bg-purple-100 text-purple-700"
                  : type === "shareholder"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-600";
                return <Badge className={colorClass}>{type}</Badge>;
              }
              if (columnKey === "status") {
                const status = entry.status as string;
                return (
                  <Badge className={status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                    {status}
                  </Badge>
                );
              }
              return null;
            }}
          />
        ) : (
          <p className="text-muted-foreground text-center py-4">Not a member of any company groups.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ================================
// Structure Sub-Tab
// ================================

interface StructureSubTabProps {
  contact: Contact;
  directorships: Directorship[];
  loadingDirectorships: boolean;
  ownershipChain: OwnershipNode[];
  loadingOwnershipChain: boolean;
  router: ReturnType<typeof useRouter>;
}

function StructureSubTab({
  contact,
  directorships,
  loadingDirectorships,
  ownershipChain,
  loadingOwnershipChain,
  router,
}: StructureSubTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Network className="h-5 w-5 text-indigo-600" />
          Corporate Structure
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Visual representation of all company relationships for this person
        </p>
      </CardHeader>
      <CardContent>
        {loadingOwnershipChain || loadingDirectorships ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : ownershipChain.length > 0 || directorships.length > 0 ? (
          <PersonStructureChart
            personName={contact.display_name}
            personEmail={contact.email}
            ownershipChain={ownershipChain}
            directorRoles={directorships.map(d => ({
              company_id: d.company_id,
              company_name: d.company_name,
              position: d.formatted_position || d.position,
              is_current: d.is_current,
            }))}
            onCompanyClick={(companyId: number) => router.push(`/corporate/companies/${companyId}`)}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Network className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No corporate structure data available</p>
            <p className="text-sm mt-1">This contact has no shareholdings or directorships</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
