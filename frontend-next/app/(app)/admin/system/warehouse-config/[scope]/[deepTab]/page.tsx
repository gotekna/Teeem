import { EntityConfigurationTab } from "../../../components/EntityConfigurationTab";

// Handles: /admin/system/warehouse-config/warehouse_tables/warehouse_types etc.

interface WarehouseConfigDeepTabPageProps {
  params: Promise<{ scope: string; deepTab: string }>;
}

export default async function WarehouseConfigDeepTabPage({ params }: WarehouseConfigDeepTabPageProps) {
  const resolvedParams = await params;
  const scope = resolvedParams.scope || "warehouse_folders";
  const deepTab = resolvedParams.deepTab;

  return <EntityConfigurationTab scope={scope} deepTab={deepTab} />;
}
