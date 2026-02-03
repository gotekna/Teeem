import { EntityConfigurationTab } from "../../components/EntityConfigurationTab";

// SSoT (Feb 2026): entity-config → warehouse-config, storage_config → warehouse_folders
// NO LEGACY REDIRECTS - fail fast on old URLs

interface WarehouseConfigPageProps {
  params: Promise<{ scope: string }>;
}

export default async function WarehouseConfigPage({ params }: WarehouseConfigPageProps) {
  const resolvedParams = await params;
  const scope = resolvedParams.scope || "warehouse_folders";

  return <EntityConfigurationTab scope={scope} />;
}
