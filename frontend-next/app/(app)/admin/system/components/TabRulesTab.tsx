"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, ChevronRight, ChevronDown, EyeOff, Building2, ShieldCheck, Tags } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WarehouseFolder } from "@/lib/types/warehouse-folders";
import { TAB_TYPE_CONFIG, type TabType } from "@/lib/constants/tab-types";
import { GROUP_LABELS, type TabGroup } from "@/lib/types/warehouse-folders";

/**
 * TabRulesTab - Shows tab visibility rules and entity type configuration
 *
 * Two sub-tabs:
 * - Tab Visibility: Matrix of all tabs with entity type columns
 * - Entity Types: List of entity types with descriptions and their visible tabs
 */

const FALLBACK_ENTITY_TYPES = ["Company", "Trust", "Superfund", "Charity"];

// Descriptions for each entity type
const ENTITY_TYPE_INFO: Record<string, { description: string; examples: string; color: string }> = {
  Company: {
    description: "A standard company entity registered with ASIC. The most common entity type for businesses.",
    examples: "Pty Ltd, Ltd, Proprietary companies",
    color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
  },
  Trust: {
    description: "A trust structure where assets are held by a trustee for the benefit of beneficiaries. Shows Trust Deed tab.",
    examples: "Family trusts, Unit trusts, Discretionary trusts",
    color: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
  },
  Superfund: {
    description: "A self-managed superannuation fund (SMSF) regulated by the ATO. Has specific compliance and reporting requirements.",
    examples: "Self-managed super funds, SMSFs",
    color: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
  },
  Charity: {
    description: "A charitable organisation registered with the ACNC. Has special tax and reporting obligations.",
    examples: "Not-for-profits, DGR entities, Charitable trusts",
    color: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
  },
  "Corporate Trustee": {
    description: "A company that acts as trustee for a trust or superannuation fund. Links to the trust it manages.",
    examples: "Trustee companies for family trusts or SMSFs",
    color: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800",
  },
  "Sole Trader": {
    description: "An individual operating a business in their own name. Simplest business structure with no separate legal entity.",
    examples: "Individual contractors, freelancers, sole proprietors",
    color: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
  },
};

const SCOPES_TO_FETCH = [
  { scope: "corporate", label: "Corporate" },
  { scope: "job", label: "Jobs" },
  { scope: "contact", label: "Contacts" },
  { scope: "library", label: "Library" },
] as const;

interface ScopeData {
  scope: string;
  label: string;
  tabs: WarehouseFolder[];
}

interface FlatTab {
  tab: WarehouseFolder;
  depth: number;
  hasChildren: boolean;
}

export function TabRulesTab() {
  const [scopeData, setScopeData] = React.useState<ScopeData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [entityTypes, setEntityTypes] = React.useState<string[]>(FALLBACK_ENTITY_TYPES);
  const [collapsedIds, setCollapsedIds] = React.useState<Set<number>>(new Set());
  // Scope sections collapsed by default
  const [collapsedScopes, setCollapsedScopes] = React.useState<Set<string>>(
    new Set(SCOPES_TO_FETCH.map((s) => s.scope))
  );

  const toggleCollapse = (id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleScopeCollapse = (scope: string) => {
    setCollapsedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  };

  React.useEffect(() => {
    const fetchAll = async () => {
      try {
        const entityResponse = await api.get<{ success: boolean; data: string[] }>(
          "/api/v1/warehouse_folders/entity_types"
        );
        if (entityResponse?.success && entityResponse.data?.length > 0) {
          setEntityTypes(entityResponse.data);
        }

        const results = await Promise.all(
          SCOPES_TO_FETCH.map(async ({ scope, label }) => {
            const response = await api.get<{ success: boolean; data: { tabs: WarehouseFolder[] } }>(
              `/api/v1/warehouse_folders?scope=${scope}&include_disabled=true`
            );
            return {
              scope,
              label,
              tabs: response?.success ? response.data.tabs : [],
            };
          })
        );
        setScopeData(results);
      } catch (err) {
        console.error("Failed to fetch tab rules:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const flattenTabs = React.useCallback(
    (tabs: WarehouseFolder[], depth = 0): FlatTab[] => {
      const result: FlatTab[] = [];
      for (const tab of tabs) {
        const hasChildren = (tab.children?.length ?? 0) > 0;
        result.push({ tab, depth, hasChildren });
        if (hasChildren && !collapsedIds.has(tab.id)) {
          result.push(...flattenTabs(tab.children, depth + 1));
        }
      }
      return result;
    },
    [collapsedIds]
  );

  // Flatten ALL tabs (ignoring collapsed state) for counting
  const flattenAll = (tabs: WarehouseFolder[]): WarehouseFolder[] => {
    const result: WarehouseFolder[] = [];
    for (const tab of tabs) {
      result.push(tab);
      if (tab.children?.length > 0) {
        result.push(...flattenAll(tab.children));
      }
    }
    return result;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const hasEntityFilter = (tab: WarehouseFolder, type: string) => {
    if (!tab.entity_filters || tab.entity_filters.length === 0) return true;
    return tab.entity_filters.includes(type);
  };

  // Get corporate tabs for entity type counting
  const corporateScope = scopeData.find((s) => s.scope === "corporate");
  const allCorporateTabs = corporateScope ? flattenAll(corporateScope.tabs) : [];
  const enabledCorporateTabs = allCorporateTabs.filter((t) => t.enabled);

  return (
    <Tabs defaultValue="tab_visibility" className="space-y-4">
      <TabsList>
        <TabsTrigger value="tab_visibility" className="text-sm">
          <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
          Tab Visibility
        </TabsTrigger>
        <TabsTrigger value="entity_types" className="text-sm">
          <Building2 className="h-3.5 w-3.5 mr-1.5" />
          Entity Types
        </TabsTrigger>
        <TabsTrigger value="badges" className="text-sm">
          <Tags className="h-3.5 w-3.5 mr-1.5" />
          Badges
        </TabsTrigger>
      </TabsList>

      {/* ===== TAB VISIBILITY ===== */}
      <TabsContent value="tab_visibility" className="space-y-6 mt-0">
        <div>
          <h3 className="text-lg font-semibold">Tab Visibility Rules</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Shows which tabs are visible for each entity type. Empty entity filters means the tab is shown for all types.
          </p>
        </div>

        {scopeData.map(({ scope, label, tabs }) => {
          const flatTabs = flattenTabs(tabs);
          const showEntityColumns = scope === "corporate";

          const isScopeCollapsed = collapsedScopes.has(scope);

          return (
            <div key={scope} className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleScopeCollapse(scope)}
                className="w-full flex items-center gap-2 bg-muted/50 px-4 py-2 border-b hover:bg-muted/70 transition-colors text-left"
              >
                {isScopeCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div>
                  <h4 className="font-semibold text-sm">{label} Tabs</h4>
                  <p className="text-xs text-muted-foreground">{tabs.length} root tabs, {flatTabs.length} total</p>
                </div>
              </button>
              {!isScopeCollapsed && <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-xs uppercase text-muted-foreground">Tab</th>
                      <th className="text-left px-3 py-2 font-medium text-xs uppercase text-muted-foreground w-24">Group</th>
                      <th className="text-center px-3 py-2 font-medium text-xs uppercase text-muted-foreground w-16">Enabled</th>
                      {showEntityColumns && entityTypes.map((type) => (
                        <th key={type} className="text-center px-3 py-2 font-medium text-xs uppercase text-muted-foreground w-24">
                          {type}
                        </th>
                      ))}
                      <th className="text-left px-3 py-2 font-medium text-xs uppercase text-muted-foreground">
                        {showEntityColumns ? "Entity Filters" : "Details"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatTabs.map(({ tab, depth, hasChildren }) => {
                      const isCollapsed = collapsedIds.has(tab.id);
                      return (
                        <tr
                          key={tab.id}
                          className={cn(
                            "border-b last:border-0 hover:bg-muted/20 transition-colors",
                            !tab.enabled && "opacity-50"
                          )}
                        >
                          <td className="px-4 py-1.5">
                            <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
                              {hasChildren ? (
                                <button
                                  type="button"
                                  onClick={() => toggleCollapse(tab.id)}
                                  className="p-0.5 -ml-1 rounded hover:bg-muted transition-colors"
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </button>
                              ) : depth > 0 ? (
                                <span className="w-4.5 inline-block" />
                              ) : null}
                              <span className={cn(
                                "font-medium text-sm",
                                tab.is_system && "text-blue-600 dark:text-blue-400"
                              )}>
                                {tab.display_name}
                              </span>
                              {tab.is_system && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-1">system</Badge>
                              )}
                              {hasChildren && (
                                <span className="text-[10px] text-muted-foreground ml-1">({tab.children.length})</span>
                              )}
                              {tab.hidden_by_default && (
                                <span title="Hidden by default"><EyeOff className="h-3 w-3 text-muted-foreground/50 ml-1" /></span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono" style={{ paddingLeft: `${depth * 20 + (hasChildren ? 22 : depth > 0 ? 18 : 0)}px` }}>
                              {tab.tab_key}
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-xs text-muted-foreground">{tab.tab_group || "—"}</span>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {tab.enabled ? (
                              <Check className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
                            ) : (
                              <X className="h-4 w-4 text-red-500/60 mx-auto" />
                            )}
                          </td>
                          {showEntityColumns && entityTypes.map((type) => (
                            <td key={type} className="px-3 py-1.5 text-center">
                              {hasEntityFilter(tab, type) ? (
                                <Check className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-red-500/40 mx-auto" />
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-1.5">
                            {tab.entity_filters && tab.entity_filters.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {tab.entity_filters.map((ef) => (
                                  <Badge key={ef} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    {ef}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">All types</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {flatTabs.length === 0 && (
                      <tr>
                        <td colSpan={showEntityColumns ? 4 + entityTypes.length : 4} className="px-4 py-6 text-center text-muted-foreground text-sm">
                          No tabs configured for this scope
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>}
            </div>
          );
        })}
      </TabsContent>

      {/* ===== ENTITY TYPES ===== */}
      <TabsContent value="entity_types" className="space-y-6 mt-0">
        <div>
          <h3 className="text-lg font-semibold">Entity Types</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Corporate entity types and the tabs visible for each. Entity types are configured per tenant.
          </p>
        </div>

        <div className="grid gap-4">
          {entityTypes.map((type) => {
            const info = ENTITY_TYPE_INFO[type];
            const visibleTabs = enabledCorporateTabs.filter((t) => hasEntityFilter(t, type));
            const mainTabs = visibleTabs.filter((t) => t.tab_group === "main");
            const overviewTabs = visibleTabs.filter((t) => t.tab_group === "overview");
            const docTabs = visibleTabs.filter((t) => t.tab_group === "documents");
            const otherTabs = visibleTabs.filter((t) => !["main", "overview", "documents"].includes(t.tab_group || ""));

            return (
              <div key={type} className={cn("border rounded-lg overflow-hidden", info?.color)}>
                <div className="px-4 py-3 border-b">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base">{type}</h4>
                    <Badge variant="outline" className="text-xs">
                      {visibleTabs.length} / {enabledCorporateTabs.length} tabs
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {info?.description || "Custom entity type."}
                  </p>
                  {info?.examples && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Examples: {info.examples}
                    </p>
                  )}
                </div>
                <div className="px-4 py-3 space-y-2 bg-background/50">
                  {mainTabs.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">Main Tabs</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {mainTabs.map((t) => (
                          <Badge key={t.id} variant="secondary" className="text-xs">{t.display_name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {overviewTabs.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">Overview Sub-tabs</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {overviewTabs.map((t) => (
                          <Badge key={t.id} variant="outline" className="text-xs">{t.display_name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {docTabs.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">Document Tabs</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {docTabs.map((t) => (
                          <Badge key={t.id} variant="outline" className="text-xs">{t.display_name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {otherTabs.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">Other</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {otherTabs.map((t) => (
                          <Badge key={t.id} variant="outline" className="text-xs">{t.display_name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {visibleTabs.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No tabs configured for this entity type</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>

      {/* ===== BADGES ===== */}
      <TabsContent value="badges" className="space-y-6 mt-0">
        <div>
          <h3 className="text-lg font-semibold">Badges & Labels Reference</h3>
          <p className="text-sm text-muted-foreground mt-1">
            All the badges, labels, and indicators used across warehouse folders and tab configuration.
          </p>
        </div>

        {/* Tab Types */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 border-b">
            <h4 className="font-semibold text-sm">Tab Types</h4>
            <p className="text-xs text-muted-foreground">Controls how a tab behaves — what it stores and how it renders.</p>
          </div>
          <div className="divide-y">
            {(Object.entries(TAB_TYPE_CONFIG) as [TabType, typeof TAB_TYPE_CONFIG[TabType]][]).map(([type, config]) => (
              <div key={type} className="flex items-start gap-4 px-4 py-3">
                <Badge className={cn("text-xs font-mono shrink-0 mt-0.5", config.color, config.darkColor, config.textColor)}>
                  {config.shortLabel}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{config.label}</span>
                    <span className="text-xs font-mono text-muted-foreground">tab_type: &quot;{type}&quot;</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{config.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {type === "system" && "Used for navigation tabs like Overview, ASIC, ATO. These tabs don't store files directly — they contain sub-tabs or display data. Root-level system tabs appear in the main tab bar (tab_group='main'), child system tabs appear as sub-tabs (tab_group='overview')."}
                    {type === "document" && "Used for document storage folders like Trust, Insurance, Plans. Files can be uploaded, viewed, and managed within these tabs. Automatically gets tab_group='documents'."}
                    {type === "mailbox" && "Connected to an email mailbox via IMAP sync. Shows synced emails and attachments. Automatically gets tab_group='documents'."}
                    {type === "revit" && "Stores Revit/CAD files with special handling for local file sync. Shows CAD-specific UI controls. Automatically gets tab_group='documents'."}
                    {type === "photo" && "Displays files in a photo gallery grid layout instead of a table. Good for site photos, progress images. Automatically gets tab_group='documents'."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Groups */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 border-b">
            <h4 className="font-semibold text-sm">Tab Groups</h4>
            <p className="text-xs text-muted-foreground">Controls WHERE a tab appears in the page layout.</p>
          </div>
          <div className="divide-y">
            {([
              { group: "main" as TabGroup, desc: "Main navigation tabs shown at the top of the entity page. These are the primary tabs like Overview, ASIC, Documents, etc.", auto: "Root-level system tabs" },
              { group: "overview" as TabGroup, desc: "Sub-tabs displayed under the Overview main tab. These are secondary navigation like Information, Corporate, Directors.", auto: "Child system tabs (nested under a parent)" },
              { group: "documents" as TabGroup, desc: "Document folder tabs shown inside the Documents section. Each one is a folder where files can be uploaded.", auto: "Document, mailbox, revit, and photo tab types" },
              { group: "data" as TabGroup, desc: "Data display tabs. Typically used for read-only data views or system information.", auto: "Legacy — now auto-set to 'main' for root tabs" },
              { group: "reports" as TabGroup, desc: "Report tabs for generated reports and analytics.", auto: "Manual only" },
              { group: "setup" as TabGroup, desc: "Configuration and setup tabs for entity-specific settings.", auto: "Manual only" },
              { group: "system" as TabGroup, desc: "Internal system tabs not typically shown to end users.", auto: "Manual only" },
            ]).map(({ group, desc, auto }) => (
              <div key={group} className="flex items-start gap-4 px-4 py-3">
                <Badge variant="outline" className="text-xs font-mono shrink-0 mt-0.5">{group}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{GROUP_LABELS[group]}</span>
                    <span className="text-xs font-mono text-muted-foreground">tab_group: &quot;{group}&quot;</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                  <p className="text-xs text-muted-foreground mt-1">Auto-assigned: {auto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Display Modes */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 border-b">
            <h4 className="font-semibold text-sm">Display Modes</h4>
            <p className="text-xs text-muted-foreground">Controls how a tab is rendered in the tab bar.</p>
          </div>
          <div className="divide-y">
            {([
              { mode: "both", label: "Icon + Text", desc: "Shows both the icon and the tab name. Default for most tabs." },
              { mode: "icon_only", label: "Icon Only", desc: "Only shows the icon — saves space. Hover shows the name as tooltip. Good for common tabs like Warehouse." },
              { mode: "text_only", label: "Text Only", desc: "Only shows the tab name with no icon. Used when no suitable icon exists." },
            ]).map(({ mode, label, desc }) => (
              <div key={mode} className="flex items-start gap-4 px-4 py-3">
                <Badge variant="secondary" className="text-xs font-mono shrink-0 mt-0.5">{mode}</Badge>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm">{label}</span>
                  <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Other Indicators */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 border-b">
            <h4 className="font-semibold text-sm">Other Indicators</h4>
            <p className="text-xs text-muted-foreground">Additional flags and badges used on tabs.</p>
          </div>
          <div className="divide-y">
            <div className="flex items-start gap-4 px-4 py-3">
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 mt-0.5">system</Badge>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm">System Tab</span>
                <p className="text-sm text-muted-foreground mt-0.5">System-generated tab that cannot be deleted. These are created automatically when the warehouse is configured. Can be disabled but not removed.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 px-4 py-3">
              <span className="shrink-0 mt-0.5"><EyeOff className="h-4 w-4 text-muted-foreground/60" /></span>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm">Hidden by Default</span>
                <p className="text-sm text-muted-foreground mt-0.5">Tab is hidden in the overflow menu by default. Users can still access it via the &quot;more tabs&quot; menu. Useful for rarely-used tabs that shouldn&apos;t clutter the main tab bar.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 px-4 py-3">
              <div className="shrink-0 mt-0.5 flex items-center gap-1">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <X className="h-4 w-4 text-red-500/40" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm">Entity Filter Check/Cross</span>
                <p className="text-sm text-muted-foreground mt-0.5">
                  <Check className="h-3 w-3 text-green-600 inline" /> = Tab is visible for that entity type.{" "}
                  <X className="h-3 w-3 text-red-500/40 inline" /> = Tab is hidden. Controlled by the entity_filters array on each tab. Empty filters = visible to all.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 px-4 py-3">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 mt-0.5">Trust</Badge>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm">Entity Filter Badge</span>
                <p className="text-sm text-muted-foreground mt-0.5">Shows which entity types can see this tab. When entity_filters is empty, shows &quot;All types&quot; in italic — meaning the tab is visible to every entity type.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 px-4 py-3">
              <div className="shrink-0 mt-0.5 flex items-center gap-1">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs text-muted-foreground">/</span>
                <X className="h-4 w-4 text-red-500/60" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm">Enabled / Disabled</span>
                <p className="text-sm text-muted-foreground mt-0.5">Whether the tab is active. Disabled tabs are hidden from all users regardless of entity type filters. The entire row is dimmed in the Tab Visibility matrix.</p>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
