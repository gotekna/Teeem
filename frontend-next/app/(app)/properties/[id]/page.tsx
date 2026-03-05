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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Save,
  X,
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
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<{
    property_types: { id: number; name: string }[];
    property_statuses: { id: number; name: string; color: string }[];
  }>({ property_types: [], property_statuses: [] });

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

  const startEditing = useCallback(() => {
    if (!property) return;
    setEditForm({
      name: property.name || "",
      street_address: property.street_address || "",
      suburb: property.suburb || "",
      state: property.state || "",
      postcode: property.postcode || "",
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parking_spaces: property.parking_spaces,
      land_area_sqm: property.land_area_sqm,
      floor_area_sqm: property.floor_area_sqm,
      year_built: property.year_built,
      description: property.description || "",
      weekly_rent_amount: property.weekly_rent_amount,
      bond_amount: property.bond_amount,
      property_type_id: property.property_type?.id ?? null,
      property_status_id: property.property_status?.id ?? null,
      sda_enrolled: property.sda_enrolled,
      sda_category: property.sda_category || "",
      sda_dwelling_id: property.sda_dwelling_id || "",
      sda_enrolment_date: property.sda_enrolment_date || "",
    });
    // Fetch lookups for dropdowns
    api.get<{ success: boolean; data: typeof lookups }>("/api/v1/properties/lookups").then(res => {
      if (res.success) setLookups(res.data);
    });
    setIsEditing(true);
  }, [property, lookups]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditForm({});
  }, []);

  const saveProperty = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api.patch<{ success: boolean; data: Property }>(`/api/v1/properties/${id}`, {
        property: editForm,
      });
      if (res.success) {
        setProperty(res.data);
        setIsEditing(false);
        toast({ title: "Property updated" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save property", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [id, editForm, toast]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateField = useCallback((field: string, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleActivateTenancy = useCallback(async (tenancyId: number) => {
    setActionLoading(`activate-${tenancyId}`);
    try {
      const res = await api.patch<{ success: boolean; data: Tenancy }>(`/api/v1/tenancies/${tenancyId}/activate`);
      if (res.success) {
        toast({ title: "Tenancy activated", description: "Billing has been set up." });
        refreshTenancies();
      }
    } catch {
      toast({ title: "Error", description: "Failed to activate tenancy", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [toast, refreshTenancies]);

  const handleTerminateTenancy = useCallback(async (tenancyId: number) => {
    setActionLoading(`terminate-${tenancyId}`);
    try {
      const res = await api.patch<{ success: boolean }>(`/api/v1/tenancies/${tenancyId}/terminate`, {
        end_date: new Date().toISOString().split("T")[0],
      });
      if (res.success) {
        toast({ title: "Tenancy terminated", description: "Billing has been deactivated." });
        refreshTenancies();
      }
    } catch {
      toast({ title: "Error", description: "Failed to terminate tenancy", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [toast, refreshTenancies]);

  const handleApproveBill = useCallback(async (billId: number) => {
    setActionLoading(`approve-${billId}`);
    try {
      const res = await api.patch<{ success: boolean }>(`/api/v1/property_bills/${billId}/approve`);
      if (res.success) {
        toast({ title: "Bill approved" });
        refreshBills();
      }
    } catch {
      toast({ title: "Error", description: "Failed to approve bill", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [toast, refreshBills]);

  const handleRemoveContact = useCallback(async (contactId: number, role: string) => {
    setActionLoading(`remove-${contactId}-${role}`);
    try {
      const res = await api.delete<{ success: boolean }>(`/api/v1/properties/${id}/remove_contact?contact_id=${contactId}&role=${role}`);
      if (res?.success) {
        toast({ title: "Contact removed" });
        refreshTenancies();
      }
    } catch {
      toast({ title: "Error", description: "Failed to remove contact", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [id, toast, refreshTenancies]);

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

        {isEditing ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={cancelEditing}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={saveProperty} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={startEditing}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        )}
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
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Input
                          value={String(editForm.name ?? "")}
                          onChange={e => updateField("name", e.target.value)}
                          placeholder="Property name"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Type</Label>
                        <Select
                          value={String(editForm.property_type_id ?? "")}
                          onValueChange={v => updateField("property_type_id", Number(v))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {lookups.property_types.map(t => (
                              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Select
                          value={String(editForm.property_status_id ?? "")}
                          onValueChange={v => updateField("property_status_id", Number(v))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {lookups.property_statuses.map(s => (
                              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Year Built</Label>
                        <Input
                          type="number"
                          value={editForm.year_built ?? ""}
                          onChange={e => updateField("year_built", e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Land Area (sqm)</Label>
                          <Input
                            type="number"
                            value={editForm.land_area_sqm ?? ""}
                            onChange={e => updateField("land_area_sqm", e.target.value ? Number(e.target.value) : null)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Floor Area (sqm)</Label>
                          <Input
                            type="number"
                            value={editForm.floor_area_sqm ?? ""}
                            onChange={e => updateField("floor_area_sqm", e.target.value ? Number(e.target.value) : null)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </CardContent>
              </Card>

              {/* Address */}
              {isEditing && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Street Address</Label>
                      <Input
                        value={String(editForm.street_address ?? "")}
                        onChange={e => updateField("street_address", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Suburb</Label>
                        <Input
                          value={String(editForm.suburb ?? "")}
                          onChange={e => updateField("suburb", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">State</Label>
                        <Input
                          value={String(editForm.state ?? "")}
                          onChange={e => updateField("state", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Postcode</Label>
                        <Input
                          value={String(editForm.postcode ?? "")}
                          onChange={e => updateField("postcode", e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rooms & Parking */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Features</CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Bedrooms</Label>
                          <Input
                            type="number"
                            value={editForm.bedrooms ?? ""}
                            onChange={e => updateField("bedrooms", e.target.value ? Number(e.target.value) : null)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Bathrooms</Label>
                          <Input
                            type="number"
                            value={editForm.bathrooms ?? ""}
                            onChange={e => updateField("bathrooms", e.target.value ? Number(e.target.value) : null)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Parking</Label>
                          <Input
                            type="number"
                            value={editForm.parking_spaces ?? ""}
                            onChange={e => updateField("parking_spaces", e.target.value ? Number(e.target.value) : null)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Textarea
                          value={String(editForm.description ?? "")}
                          onChange={e => updateField("description", e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
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
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Weekly Rent</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.weekly_rent_amount ?? ""}
                          onChange={e => updateField("weekly_rent_amount", e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Bond</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.bond_amount ?? ""}
                          onChange={e => updateField("bond_amount", e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Weekly Rent</div>
                      <div className="font-medium">{formatCurrency(property.weekly_rent_amount)}</div>
                      <div className="text-muted-foreground">Bond</div>
                      <div>{formatCurrency(property.bond_amount)}</div>
                    </div>
                  )}
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
              {(property.sda_enrolled || isEditing) && (
                <Card className={property.sda_enrolled ? "border-purple-200 dark:border-purple-800" : ""}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-purple-700 dark:text-purple-300">
                      <Shield className="h-4 w-4" />
                      SDA Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!editForm.sda_enrolled}
                            onChange={e => updateField("sda_enrolled", e.target.checked)}
                            className="rounded border-input"
                          />
                          <Label className="text-sm">SDA Enrolled</Label>
                        </div>
                        {editForm.sda_enrolled && (
                          <>
                            <div>
                              <Label className="text-xs text-muted-foreground">Category</Label>
                              <Select
                                value={String(editForm.sda_category ?? "")}
                                onValueChange={v => updateField("sda_category", v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {["improved_liveability", "fully_accessible", "robust", "high_physical_support"].map(c => (
                                    <SelectItem key={c} value={c}>{formatSdaCategory(c)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Dwelling ID</Label>
                              <Input
                                value={String(editForm.sda_dwelling_id ?? "")}
                                onChange={e => updateField("sda_dwelling_id", e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Enrolment Date</Label>
                              <Input
                                type="date"
                                value={String(editForm.sda_enrolment_date ?? "")}
                                onChange={e => updateField("sda_enrolment_date", e.target.value)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Category</div>
                        <div>{formatSdaCategory(property.sda_category)}</div>
                        <div className="text-muted-foreground">Dwelling ID</div>
                        <div className="font-mono text-xs">{property.sda_dwelling_id || "-"}</div>
                        <div className="text-muted-foreground">Enrolled Date</div>
                        <div>{property.sda_enrolment_date || "-"}</div>
                      </div>
                    )}
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
                    <div className="flex items-center gap-2">
                      <Badge variant={activeTenancy.status === "active" ? "default" : "secondary"}>
                        {activeTenancy.status}
                      </Badge>
                      {activeTenancy.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                          onClick={() => handleActivateTenancy(activeTenancy.id)}
                          disabled={actionLoading === `activate-${activeTenancy.id}`}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          {actionLoading === `activate-${activeTenancy.id}` ? "Activating..." : "Activate"}
                        </Button>
                      )}
                      {activeTenancy.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => handleTerminateTenancy(activeTenancy.id)}
                          disabled={actionLoading === `terminate-${activeTenancy.id}`}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          {actionLoading === `terminate-${activeTenancy.id}` ? "Terminating..." : "Terminate"}
                        </Button>
                      )}
                    </div>
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Property Contacts</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowContactDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Contact
                </Button>
              </CardHeader>
              <CardContent>
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No contacts assigned.</p>
                ) : (
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
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => handleRemoveContact(pc.contact.id, pc.role)}
                            disabled={actionLoading === `remove-${pc.contact.id}-${pc.role}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
                          {t.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs text-green-600"
                              onClick={() => handleActivateTenancy(t.id)}
                              disabled={actionLoading === `activate-${t.id}`}
                            >
                              {actionLoading === `activate-${t.id}` ? "..." : "Activate"}
                            </Button>
                          )}
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
                          {bill.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={() => handleApproveBill(bill.id)}
                              disabled={actionLoading === `approve-${bill.id}`}
                            >
                              {actionLoading === `approve-${bill.id}` ? "..." : "Approve"}
                            </Button>
                          )}
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
      <AddPropertyContactDialog
        open={showContactDialog}
        onOpenChange={setShowContactDialog}
        propertyId={id}
        onSuccess={refreshTenancies}
      />
    </div>
  );
}
