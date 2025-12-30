"use client";

import * as React from "react";
import { Suspense, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";

// Import all tab components
import { SecurityTab } from "../components/SecurityTab";
import { PermissionsTab } from "../components/PermissionsTab";
import { CorporateTab } from "../components/CorporateTab";
import { HolidaysTab } from "../components/HolidaysTab";
import { WorkflowsTab } from "../components/WorkflowsTab";
import { FoldersTab } from "../components/FoldersTab";
import { JobSetupTab } from "../components/JobSetupTab";
import { WorkflowConfigTab } from "../components/WorkflowConfigTab";
import { ScheduleMasterTab } from "../components/ScheduleMasterTab";
import { MeetingTypesTab } from "../components/MeetingTypesTab";
import { SupervisorChecklistTab } from "../components/SupervisorChecklistTab";
import { GoldStandardTab } from "../components/GoldStandardTab";
import { DeveloperToolsTab } from "../components/DeveloperToolsTab";
import { UserManualTab } from "../components/UserManualTab";
import { InspiringQuotesTab } from "../components/InspiringQuotesTab";
import { DocumentTypesTab } from "../components/DocumentTypesTab";
import { ContactTypesTab } from "../components/ContactTypesTab";
import { BrandGuidelinesTab } from "../components/BrandGuidelinesTab";
import { DocumentTemplatesTab } from "../components/DocumentTemplatesTab";
import { EmailAccountsTab } from "../components/EmailAccountsTab";
import { SharePointTab } from "../components/SharePointTab";
import { ScheduledJobsTab } from "../components/ScheduledJobsTab";
import { NavigationTab } from "../components/NavigationTab";
import { EntityConfigurationTab } from "../components/EntityConfigurationTab";
import { PdfFieldsTab } from "../components/PdfFieldsTab";
import { AiProcessingTab } from "../components/AiProcessingTab";
import { XeroHealthTab } from "../components/XeroHealthTab";
import { CostTab } from "../components/CostTab";
import { UnrealEngineTab } from "../components/UnrealEngineTab";
import { ConnectionsTab } from "../components/ConnectionsTab";
import CompanyInfoTab from "../components/CompanyInfoTab";

// Company subtabs
const COMPANY_TABS = [
  { id: "info", label: "Info" },
  { id: "security", label: "Security" },
  { id: "permissions", label: "Permissions" },
  { id: "corporate", label: "Corporate" },
  { id: "holidays", label: "Holidays" },
  { id: "workflows", label: "Workflows" },
  { id: "folders", label: "Folders" },
  { id: "sharepoint", label: "SharePoint" },
  { id: "connections", label: "Connections" },
  { id: "job-setup", label: "Job Setup" },
  { id: "workflow-config", label: "Workflow Config" },
  { id: "doc-templates", label: "Doc Templates" },
];

// SSoT: Tabs that need full-height table layout
const FULL_HEIGHT_TABS = ["components", "schedule-master", "email-accounts"];

function PlaceholderTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-12">
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <p className="text-muted-foreground mt-2">{description}</p>
    </div>
  );
}

// Company Settings with subtab navigation
function CompanySettingsContent({ subtab, extra }: { subtab: string; extra?: string }) {
  const router = useRouter();

  const handleSubtabChange = (value: string) => {
    router.push(`/admin/system/company/${value}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Company Settings</h2>
        <Link
          href="/corporate"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Go to Corporate Dashboard
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <Tabs value={subtab} onValueChange={handleSubtabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {COMPANY_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="text-xs sm:text-sm whitespace-nowrap"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="info">
            <CompanyInfoTab />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab innertab={extra} />
          </TabsContent>
          <TabsContent value="permissions">
            <PermissionsTab />
          </TabsContent>
          <TabsContent value="corporate">
            <CorporateTab />
          </TabsContent>
          <TabsContent value="holidays">
            <HolidaysTab />
          </TabsContent>
          <TabsContent value="workflows">
            <WorkflowsTab />
          </TabsContent>
          <TabsContent value="folders">
            <FoldersTab />
          </TabsContent>
          <TabsContent value="sharepoint">
            <SharePointTab />
          </TabsContent>
          <TabsContent value="connections">
            <ConnectionsTab />
          </TabsContent>
          <TabsContent value="job-setup">
            <JobSetupTab />
          </TabsContent>
          <TabsContent value="workflow-config">
            <WorkflowConfigTab />
          </TabsContent>
          <TabsContent value="doc-templates">
            <DocumentTemplatesTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function SystemAdminCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  // Unwrap params Promise for Next.js 16
  const { slug } = use(params);
  // slug = ["company"] or ["company", "info"] or ["schedule-master", "data-view", "live"]
  const [tab, subtab, extra] = slug || [];

  // Get CSS class for tab content
  const getContentClass = () => {
    if (FULL_HEIGHT_TABS.includes(tab)) {
      return "h-full overflow-hidden -mx-4";
    }
    return "overflow-auto";
  };

  // Render the appropriate content based on the path
  const renderContent = () => {
    switch (tab) {
      case "company":
        return <CompanySettingsContent subtab={subtab || "info"} extra={extra} />;

      case "brand-guidelines":
        return <BrandGuidelinesTab />;

      case "contact-types":
        return <ContactTypesTab />;

      case "components":
        return <GoldStandardTab subtab={subtab} />;

      case "developer-tools":
        return <DeveloperToolsTab subtab={subtab} />;

      case "navigation":
        return <NavigationTab />;

      case "entity-config":
        // EntityConfigurationTab handles its own scope routing
        return <EntityConfigurationTab />;

      case "schedule-master":
        // ScheduleMasterTab handles its own subtab/view routing internally
        // We'll pass the path segments so it can read them
        return <ScheduleMasterTab />;

      case "meeting-types":
        return <MeetingTypesTab />;

      case "whs":
        // WHS links to external page
        return (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Redirecting to WHS...</p>
            <Link href="/whs" className="text-primary hover:underline">
              Go to WHS
            </Link>
          </div>
        );

      case "financial":
        // Financial links to external page
        return (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Redirecting to Financial...</p>
            <Link href="/financial" className="text-primary hover:underline">
              Go to Financial
            </Link>
          </div>
        );

      case "cost":
        return <CostTab />;

      case "pricebook":
        return (
          <PlaceholderTab
            title="Price Book"
            description="Configure pricing and cost data"
          />
        );

      case "supervisor-checklist":
        return <SupervisorChecklistTab />;

      case "user-manual":
        return <UserManualTab />;

      case "inspiring-quotes":
        return <InspiringQuotesTab />;

      case "scheduled-jobs":
        return <ScheduledJobsTab />;

      case "email-accounts":
        return <EmailAccountsTab />;

      case "pdf-fields":
        return <PdfFieldsTab />;

      case "ai-processing":
        return <AiProcessingTab />;

      case "xero-health":
        return <XeroHealthTab />;

      case "unreal-engine":
        return <UnrealEngineTab />;

      default:
        return (
          <PlaceholderTab
            title="Tab Not Found"
            description={`The tab "${tab}" does not exist.`}
          />
        );
    }
  };

  return (
    <Suspense fallback={<Spinner />}>
      <div className={getContentClass()}>{renderContent()}</div>
    </Suspense>
  );
}
