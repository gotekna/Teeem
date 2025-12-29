"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Pencil,
  MapPin,
  Building,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Suburb {
  id: number;
  name: string;
  postcode: string;
  state: string;
  council: string | null;
  position: number;
  is_active: boolean;
}

const STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"];

const SEQ_COUNCILS = [
  "Brisbane City Council",
  "Gold Coast City Council",
  "Logan City Council",
  "Moreton Bay Regional Council",
  "Redland City Council",
  "Ipswich City Council",
  "Sunshine Coast Council",
  "Noosa Shire Council",
  "Scenic Rim Regional Council",
  "Lockyer Valley Regional Council",
  "Somerset Regional Council",
  "Toowoomba Regional Council",
];

export function SuburbsTab() {
  const { toast } = useToast();
  const [suburbs, setSuburbs] = React.useState<Suburb[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [stateFilter, setStateFilter] = React.useState<string>("all");
  const [councilFilter, setCouncilFilter] = React.useState<string>("all");

  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [editingSuburb, setEditingSuburb] = React.useState<Suburb | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    postcode: "",
    state: "QLD",
    council: "",
  });

  // Stats
  const [stats, setStats] = React.useState({
    total: 0,
    withCouncil: 0,
    byState: {} as Record<string, number>,
  });

  React.useEffect(() => {
    loadSuburbs();
  }, []);

  const loadSuburbs = async () => {
    try {
      const response = await api.get<{ suburbs: Suburb[] }>("/api/v1/suburbs");
      const allSuburbs = response.suburbs || [];
      setSuburbs(allSuburbs);

      // Calculate stats
      const byState: Record<string, number> = {};
      allSuburbs.forEach((s) => {
        byState[s.state] = (byState[s.state] || 0) + 1;
      });
      setStats({
        total: allSuburbs.length,
        withCouncil: allSuburbs.filter((s) => s.council).length,
        byState,
      });
    } catch (error) {
      console.error("Failed to load suburbs:", error);
      toast({ title: "Error", description: "Failed to load suburbs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (suburb: Suburb) => {
    setEditingSuburb(suburb);
    setFormData({
      name: suburb.name,
      postcode: suburb.postcode,
      state: suburb.state,
      council: suburb.council || "",
    });
    setShowEditDialog(true);
  };

  const handleSave = async () => {
    if (!editingSuburb) return;

    setSaving(true);
    try {
      await api.patch(`/api/v1/suburbs/${editingSuburb.id}`, {
        suburb: formData,
      });
      toast({ title: "Success", description: "Suburb updated successfully" });
      setShowEditDialog(false);
      loadSuburbs();
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save suburb", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Filter suburbs
  const filteredSuburbs = React.useMemo(() => {
    return suburbs.filter((suburb) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !suburb.name.toLowerCase().includes(query) &&
          !suburb.postcode.includes(query)
        ) {
          return false;
        }
      }

      // State filter
      if (stateFilter !== "all" && suburb.state !== stateFilter) {
        return false;
      }

      // Council filter
      if (councilFilter === "with-council" && !suburb.council) {
        return false;
      }
      if (councilFilter === "without-council" && suburb.council) {
        return false;
      }
      if (
        councilFilter !== "all" &&
        councilFilter !== "with-council" &&
        councilFilter !== "without-council" &&
        suburb.council !== councilFilter
      ) {
        return false;
      }

      return true;
    });
  }, [suburbs, searchQuery, stateFilter, councilFilter]);

  // Get unique councils for filter
  const uniqueCouncils = React.useMemo(() => {
    const councils = new Set<string>();
    suburbs.forEach((s) => {
      if (s.council) councils.add(s.council);
    });
    return Array.from(councils).sort();
  }, [suburbs]);

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Suburbs Lookup</h2>
          <p className="text-sm text-muted-foreground">
            Manage suburb data for auto-fill on job addresses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {stats.total} suburbs
          </Badge>
          <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20">
            {stats.withCouncil} with council
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suburb or postcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full sm:w-32">
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state} ({stats.byState[state] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={councilFilter} onValueChange={setCouncilFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Council" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="with-council">With Council</SelectItem>
                  <SelectItem value="without-council">Without Council</SelectItem>
                  {uniqueCouncils.map((council) => (
                    <SelectItem key={council} value={council}>
                      {council}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suburbs list */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {filteredSuburbs.length} suburbs
              {searchQuery && ` matching "${searchQuery}"`}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Spinner size={24} className="text-muted-foreground" />
            </div>
          ) : filteredSuburbs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No suburbs found matching your filters.
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table className="w-full">
                <TableHeader className="sticky top-0 bg-background border-b">
                  <TableRow className="text-left text-xs text-muted-foreground">
                    <TableHead className="pb-2 font-medium">Suburb</TableHead>
                    <TableHead className="pb-2 font-medium">Postcode</TableHead>
                    <TableHead className="pb-2 font-medium">State</TableHead>
                    <TableHead className="pb-2 font-medium">Council</TableHead>
                    <TableHead className="pb-2 font-medium w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {filteredSuburbs.slice(0, 100).map((suburb) => (
                    <TableRow key={suburb.id} className="hover:bg-muted/50">
                      <TableCell className="py-2 text-sm font-medium">{suburb.name}</TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">{suburb.postcode}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-xs">
                          {suburb.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-sm">
                        {suburb.council ? (
                          <span className="text-green-600 dark:text-green-400">{suburb.council}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditClick(suburb)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredSuburbs.length > 100 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Showing first 100 of {filteredSuburbs.length} results. Use search to narrow down.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Suburb</DialogTitle>
            <DialogDescription>
              Update suburb details. Council is used for auto-fill on job addresses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Suburb Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={formData.postcode}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select
                value={formData.state}
                onValueChange={(value) => setFormData({ ...formData, state: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="council">Council</Label>
              <Select
                value={formData.council || "none"}
                onValueChange={(value) => setFormData({ ...formData, council: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select council" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Council</SelectItem>
                  {SEQ_COUNCILS.map((council) => (
                    <SelectItem key={council} value={council}>
                      {council}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Or type a custom council name:
              </p>
              <Input
                placeholder="Custom council name"
                value={formData.council}
                onChange={(e) => setFormData({ ...formData, council: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
