import { EntityConfigurationTab } from "../../components/EntityConfigurationTab";

interface EntityConfigPageProps {
  params: Promise<{ scope: string }>;
}

export default async function EntityConfigPage({ params }: EntityConfigPageProps) {
  const resolvedParams = await params;
  const scope = resolvedParams.scope || "corporate_entity";

  return <EntityConfigurationTab scope={scope} />;
}
