import { redirect } from "next/navigation";
import { EntityConfigurationTab } from "../../components/EntityConfigurationTab";

// Legacy URL redirects (preserve bookmarks)
// SSoT (Feb 2026): entity-config → folder-config → warehouse-config, storage_config → warehouse_folders
const LEGACY_REDIRECTS: Record<string, string> = {
  "sharepoint_config": "warehouse_folders",  // Legacy SharePoint-specific name
  "storage_config": "warehouse_folders",  // Legacy provider-agnostic name
};

interface WarehouseConfigPageProps {
  params: Promise<{ scope: string }>;
}

export default async function WarehouseConfigPage({ params }: WarehouseConfigPageProps) {
  const resolvedParams = await params;
  let scope = resolvedParams.scope || "warehouse_folders";

  // Handle legacy URLs
  if (LEGACY_REDIRECTS[scope]) {
    redirect(`/admin/system/warehouse-config/${LEGACY_REDIRECTS[scope]}`);
  }

  return <EntityConfigurationTab scope={scope} />;
}
