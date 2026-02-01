import { redirect } from "next/navigation";
import { EntityConfigurationTab } from "../../components/EntityConfigurationTab";

// Legacy URL redirects (preserve bookmarks)
const LEGACY_REDIRECTS: Record<string, string> = {
  "sharepoint_config": "storage_config",  // Renamed to provider-agnostic
};

interface EntityConfigPageProps {
  params: Promise<{ scope: string }>;
}

export default async function EntityConfigPage({ params }: EntityConfigPageProps) {
  const resolvedParams = await params;
  let scope = resolvedParams.scope || "corporate";

  // Handle legacy URLs
  if (LEGACY_REDIRECTS[scope]) {
    redirect(`/admin/system/entity-config/${LEGACY_REDIRECTS[scope]}`);
  }

  return <EntityConfigurationTab scope={scope} />;
}
