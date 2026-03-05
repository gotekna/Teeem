"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { BackButton } from "@/components/ui/back-button";
import {
  Building2,
  MapPin,
  Pencil,
  Bed,
  Bath,
  Car,
  DollarSign,
  Users,
  Home,
  Shield,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

import { CreateTenancyDialog } from "@/components/properties/CreateTenancyDialog";
import { CreateBillDialog } from "@/components/properties/CreateBillDialog";
import { CreateInspectionDialog } from "@/components/properties/CreateInspectionDialog";
import { AddPropertyContactDialog } from "@/components/properties/AddPropertyContactDialog";
import { useWarehouseFolders } from "@/lib/hooks/useWarehouseFolders";
import EntityDocumentListTab from "@/components/documents/EntityDocumentListTab";

interface Property {
  id: number;
  property_code: string;
  name: string | null;
  street_address: string;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  land_area_sqm: number | null;
  floor_area_sqm: number | null;
  year_built: number | null;
  description: string | null;
  sda_category: string | null;
  sda_enrolled: boolean;
  sda_enrolment_date: string | null;
  sda_dwelling_id: string | null;
  weekly_rent_amount: number | null;
  bond_amount: number | null;
  property_type?: { id: number; name: string } | null;
  property_status?: { id: number; name: string; color: string } | null;
  owner_contact?: { id: number; display_name: string; email?: string; phone?: string } | null;
  managing_agent_contact?: { id: number; display_name: string; email?: string; phone?: string } | null;
}

interface Tenancy {
  id: number;
  tenancy_type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  weekly_rent: number;
  rent_frequency: string;
  bond_amount: number | null;
  bond_lodged: boolean;
  sda_plan_number: string | null;
  sda_weekly_rate: number | null;
  participant_rent_contribution: number | null;
  ndia_payment_amount: number | null;
  sda_participant_contact?: { id: number; display_name: string } | null;
  notes: string | null;
}

interface PropertyBill {
  id: number;
  bill_type: string;
  description: string | null;
  amount: number;
  tax_amount: number;
  bill_date: string;
  due_date: string | null;
  charge_to: string;
  status: string;
  supplier_contact?: { id: number; display_name: string } | null;
}

interface PropertyInspection {
  id: number;
  inspection_type: string;
  scheduled_date: string;
  completed_date: string | null;
  status: string;
  overall_condition: string | null;
  notes: string | null;
  inspector_contact?: { id: number; display_name: string } | null;
}

interface PropertyContact {
  id: number;
  role: string;
  is_primary: boolean;
  start_date: string | null;
  end_date: string | null;
  contact: { id: number; display_name: string; email?: string; phone?: string };
}


function StatusBadge({ status, color }: { status: string; color?: string }) {
  return (
    <Badge
      variant="outline"
      className="text-xs"
      style={color ? { borderColor: color, color } : undefined}
    >
      {status}
    </Badge>
  );
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "-";
  return `$${Number(amount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
}

function formatSdaCategory(cat: string | null): string {
  if (!cat) return "-";
  return cat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const id = params.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [bills, setBills] = useState<PropertyBill[]>([]);
  const [contacts, setContacts] = useState<PropertyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTenancyDialog, setShowTenancyDialog] = useState(false);
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);  // TODO: move to inspections warehouse tab

  // SSoT: Load warehouse folder tabs for property scope
  const { tabs: propertyTabs } = useWarehouseFolders({ scope: "property" });

  // Get enabled document folder tabs (children of root "properties" parent)
  const documentFolderTabs = useMemo(() => {
    // Property has a single root parent with children - flatten children as tabs
    const rootTab = propertyTabs.find(t => t.tab_key === "properties");
    const children = rootTab?.children || [];
    return children
      .filter(t => t.enabled)
      .map(t => ({
        id: t.tab_key,
        name: t.display_name,
        warehouseFolder: t,
      }));
  }, [propertyTabs]);

  // URL is SSoT for tab state
  const pathParts = pathname.split("/");
  const activeTab = pathParts[3] || "overview";

  const handleTabChange = useCallback((tab: string) => {
    router.push(`/properties/${id}/${tab}`);
  }, [router, id]);

  const refreshTenancies = useCallback(() => {
    api.get<{ success: boolean; data: Tenancy[] }>(`/api/v1/properties/${id}/tenancies`).then(res => {
      if (res.success) setTenancies(res.data);
    });
    api.get<{ success: boolean; data: PropertyContact[] }>(`/api/v1/properties/${id}/contacts`).then(res => {
      if (res.success) setContacts(res.data);
    });
  }, [id]);

  const refreshBills = useCallback(() => {
    api.get<{ success: boolean; data: PropertyBill[] }>(`/api/v1/properties/${id}/bills`).then(res => {
      if (res.success) setBills(res.data);
    });
  }, [id]);

  // Fetch property data
  useEffect(() => {
    async function fetchProperty() {
      try {
        const res = await api.get<{ success: boolean; data: Property }>(`/api/v1/properties/${id}`);
        if (res.success) {
          setProperty(res.data);
        }
      } catch {
        toast({ title: "Error", description: "Failed to load property", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    fetchProperty();
  }, [id, toast]);

  // Fetch tab-specific data when tab changes
  useEffect(() => {
    if (!id) return;

    if (activeTab === "tenancy") {
      refreshTenancies();
    } else if (activeTab === "financials") {
      refreshBills();
    }
  }, [id, activeTab, refreshTenancies, refreshBills]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="p-6">
        <BackButton fallbackHref="/properties" />
        <p className="mt-4 text-muted-foreground">Property not found.</p>
      </div>
    );
  }

  const activeTenancy = tenancies.find(t => t.status === "active");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/properties" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">
                {property.name || property.street_address}
              </h1>
              <Badge variant="secondary" className="text-xs font-mono">
                {property.property_code}
              </Badge>
              {property.property_status && (
                <StatusBadge
                  status={property.property_status.name}
                  color={property.property_status.color}
                />
              )}
              {property.sda_enrolled && (
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  SDA
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {[property.street_address, property.suburb, property.state, property.postcode].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => router.push(`/properties/${id}/overview`)}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        <div className="border-b px-6">
          <TabsList className="h-10">
            <TabsTrigger value="overview" className="gap-1.5">
              <Home className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tenancy" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Tenancy
            </TabsTrigger>
            <TabsTrigger value="financials" className="gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Financials
            </TabsTrigger>
            {/* SSoT: Document folder tabs from warehouse folders */}
            {documentFolderTabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Overview Tab */}
          <TabsContent value="overview" className="p-6 space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Property Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Property Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Type</div>
                    <div>{property.property_type?.name || "-"}</div>
                    <div className="text-muted-foreground">Year Built</div>
                    <div>{property.year_built || "-"}</div>
                    <div className="text-muted-foreground">Land Area</div>
                    <div>{property.land_area_sqm ? `${property.land_area_sqm} sqm` : "-"}</div>
                    <div className="text-muted-foreground">Floor Area</div>
                    <div>{property.floor_area_sqm ? `${property.floor_area_sqm} sqm` : "-"}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Rooms & Parking */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{property.bedrooms ?? "-"}</span>
                      <span className="text-muted-foreground">Beds</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{property.bathrooms ?? "-"}</span>
                      <span className="text-muted-foreground">Baths</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{property.parking_spaces ?? "-"}</span>
                      <span className="text-muted-foreground">Parking</span>
                    </div>
                  </div>
                  {property.description && (
                    <p className="text-sm text-muted-foreground mt-3">{property.description}</p>
                  )}
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Financial
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Weekly Rent</div>
                    <div className="font-medium">{formatCurrency(property.weekly_rent_amount)}</div>
                    <div className="text-muted-foreground">Bond</div>
                    <div>{formatCurrency(property.bond_amount)}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Owner & Agent */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Owner & Agent
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <Label className="text-muted-foreground">Owner</Label>
                    <div className="font-medium">{property.owner_contact?.display_name || "-"}</div>
                    {property.owner_contact?.email && (
                      <div className="text-muted-foreground text-xs">{property.owner_contact.email}</div>
                    )}
                  </div>
                  <Separator />
                  <div className="text-sm">
                    <Label className="text-muted-foreground">Managing Agent</Label>
                    <div className="font-medium">{property.managing_agent_contact?.display_name || "-"}</div>
                  </div>
                </CardContent>
              </Card>

              {/* SDA Info */}
              {property.sda_enrolled && (
                <Card className="border-purple-200 dark:border-purple-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-purple-700 dark:text-purple-300">
                      <Shield className="h-4 w-4" />
                      SDA Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Category</div>
                      <div>{formatSdaCategory(property.sda_category)}</div>
                      <div className="text-muted-foreground">Dwelling ID</div>
                      <div className="font-mono text-xs">{property.sda_dwelling_id || "-"}</div>
                      <div className="text-muted-foreground">Enrolled Date</div>
                      <div>{property.sda_enrolment_date || "-"}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Tenancy Tab */}
          <TabsContent value="tenancy" className="p-6 space-y-6 mt-0">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowTenancyDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Tenancy
              </Button>
            </div>

            {/* Active Tenancy */}
            {activeTenancy ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>Current Tenancy</span>
                    <Badge variant={activeTenancy.status === "active" ? "default" : "secondary"}>
                      {activeTenancy.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Type</Label>
                      <div className="font-medium capitalize">{activeTenancy.tenancy_type.replace(/_/g, " ")}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Start Date</Label>
                      <div>{activeTenancy.start_date}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">End Date</Label>
                      <div>{activeTenancy.end_date || "Periodic"}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Rent</Label>
                      <div className="font-medium">{formatCurrency(activeTenancy.weekly_rent)}/{activeTenancy.rent_frequency}</div>
                    </div>
                  </div>

                  {activeTenancy.tenancy_type === "sda" && (
                    <>
                      <Separator className="my-4" />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <Label className="text-muted-foreground">SDA Participant</Label>
                          <div className="font-medium">{activeTenancy.sda_participant_contact?.display_name || "-"}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">NDIS Plan</Label>
                          <div className="font-mono text-xs">{activeTenancy.sda_plan_number || "-"}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Participant Contribution</Label>
                          <div className="font-medium">{formatCurrency(activeTenancy.participant_rent_contribution)}/wk</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">NDIA Payment</Label>
                          <div className="font-medium">{formatCurrency(activeTenancy.ndia_payment_amount)}/wk</div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                    <div>
                      <Label className="text-muted-foreground">Bond</Label>
                      <div>
                        {formatCurrency(activeTenancy.bond_amount)}
                        {activeTenancy.bond_lodged && (
                          <Badge variant="outline" className="ml-2 text-xs text-green-600">Lodged</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No active tenancy. This property is currently vacant.
                </CardContent>
              </Card>
            )}

            {/* Property Contacts */}
            {contacts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Property Contacts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {contacts.map((pc) => (
                      <div key={pc.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                        <div>
                          <span className="font-medium">{pc.contact.display_name}</span>
                          {pc.contact.email && (
                            <span className="text-muted-foreground ml-2 text-xs">{pc.contact.email}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">{pc.role.replace(/_/g, " ")}</Badge>
                          {pc.is_primary && <Badge className="text-xs">Primary</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Past Tenancies */}
            {tenancies.filter(t => t.status !== "active").length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Past Tenancies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {tenancies.filter(t => t.status !== "active").map((t) => (
                      <div key={t.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                        <div>
                          <span className="capitalize">{t.tenancy_type.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground ml-2">
                            {t.start_date} - {t.end_date || "ongoing"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{formatCurrency(t.weekly_rent)}/wk</span>
                          <Badge variant="secondary" className="text-xs capitalize">{t.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Financials Tab */}
          <TabsContent value="financials" className="p-6 space-y-6 mt-0">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowBillDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Bill
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{formatCurrency(property.weekly_rent_amount)}</div>
                  <p className="text-xs text-muted-foreground">Weekly Rent</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {formatCurrency(property.weekly_rent_amount ? property.weekly_rent_amount * 52 : null)}
                  </div>
                  <p className="text-xs text-muted-foreground">Annual Rent Income</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {formatCurrency(bills.reduce((sum, b) => sum + Number(b.amount), 0))}
                  </div>
                  <p className="text-xs text-muted-foreground">Total Bills</p>
                </CardContent>
              </Card>
            </div>

            {/* Bills List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Bills</CardTitle>
              </CardHeader>
              <CardContent>
                {bills.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No bills recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {bills.map((bill) => (
                      <div key={bill.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                        <div>
                          <span className="font-medium capitalize">{bill.bill_type}</span>
                          {bill.description && <span className="text-muted-foreground ml-2">- {bill.description}</span>}
                          <div className="text-xs text-muted-foreground">
                            {bill.bill_date} {bill.supplier_contact && `| ${bill.supplier_contact.display_name}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{formatCurrency(bill.amount)}</span>
                          <Badge variant="outline" className="text-xs capitalize">{bill.charge_to.replace(/_/g, " ")}</Badge>
                          <Badge variant={bill.status === "paid" ? "default" : "secondary"} className="text-xs capitalize">{bill.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SSoT: Document folder tabs from warehouse folders */}
          {documentFolderTabs.map(tab => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0 flex-1">
              <EntityDocumentListTab
                entityId={Number(id)}
                entityType="Property"
                sourceType="property"
                uploadScope="documents"
                warehouseFolder={tab.warehouseFolder}
                entityName={property.name || property.street_address}
                entityCode={property.property_code}
              />
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {/* Create Dialogs */}
      <CreateTenancyDialog
        open={showTenancyDialog}
        onOpenChange={setShowTenancyDialog}
        propertyId={id}
        onSuccess={refreshTenancies}
      />
      <CreateBillDialog
        open={showBillDialog}
        onOpenChange={setShowBillDialog}
        propertyId={id}
        onSuccess={refreshBills}
      />
      <CreateInspectionDialog
        open={showInspectionDialog}
        onOpenChange={setShowInspectionDialog}
        propertyId={id}
        onSuccess={() => {}}
      />
    </div>
  );
}
