"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import {
  Plus,
  AlertTriangle,
  X,
  Check,
  CornerDownRight,
} from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";

// Foundation table name for Purchase Orders
const PURCHASE_ORDERS_TABLE_NAME = "purchase_orders";

interface Contact {
  id: number;
  display_name?: string;
  employee_names?: string[];
  employee_count?: number;
}

// Extended ComboboxItem with employee data for cascading view
interface SupplierItem {
  id: string;
  label: string;
  searchText?: string;
  employeeNames: string[];
}

// Trade represents a task category from sm_trades (SSoT for PO task types)
// Previously used TaskTemplate table which was dropped - sm_trades is now THE ONE
interface Trade {
  id: number;
  name: string;
}

interface JobPurchaseOrdersTabProps {
  jobId: string | number;
  jobTitle?: string;
}

export function JobPurchaseOrdersTab({ jobId, jobTitle }: JobPurchaseOrdersTabProps) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);


  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [customTaskName, setCustomTaskName] = useState("");

  // Handle row click - navigate to PO detail page
  const handleRowClick = useCallback((row: TableRow) => {
    const poNumber = row.purchase_order_number as string | undefined;
    const slug = poNumber?.replace('PO-', '') || row.id;
    if (slug) {
      router.push(`/purchase_orders/${slug}`);
    }
  }, [router]);

  // Handle inline row update - use slug-based API
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/${PURCHASE_ORDERS_TABLE_NAME}/records/${rowId}`, {
        record: { [field]: value }
      });
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error("Failed to update purchase order:", err);
      throw err;
    }
  }, []);

  const loadContacts = async () => {
    if (contacts.length > 0) return;
    try {
      setLoadingContacts(true);
      // FRC FIX: Use entity_type filter instead of type=suppliers
      // type=suppliers only returns contacts with is_supplier_cached=true (existing suppliers with POs)
      // But we need to show ALL potential suppliers (companies/trusts/sole_traders)
      // so users can create their first PO for a new supplier
      const response = await api.get<{ contacts: Contact[] }>("/api/v1/contacts?entity_type=company,trust,sole_trader");
      setContacts(response?.contacts || []);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Load trades from sm_trades foundation (SSoT for PO task categories)
  // Note: task_templates table was dropped - sm_trades is now THE ONE
  const loadTrades = async () => {
    if (trades.length > 0) return;
    try {
      setLoadingTrades(true);
      // Use Foundation API for sm_trades
      const response = await api.get<{ records: Trade[] }>(
        `/api/v1/foundations/sm_trades/records?per_page=200`
      );
      // Sort by name for easier selection
      const sortedTrades = (response?.records || []).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setTrades(sortedTrades);
    } catch (err) {
      console.error("Failed to load trades:", err);
    } finally {
      setLoadingTrades(false);
    }
  };

  const handleOpenCreateModal = async () => {
    setError(null);
    setSelectedContact(null);
    setSelectedTrade(null);
    setCustomTaskName("");
    setShowCreateModal(true);
    await Promise.all([loadContacts(), loadTrades()]);
  };

  const handleCreate = async () => {
    if (!selectedContact) {
      setError("Please select a supplier");
      return;
    }
    if (!selectedTrade && !customTaskName.trim()) {
      setError("Please select a trade or enter a custom task name");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      // Use ted_task field for the trade/task name (SSoT for PO task category)
      await api.post(`/api/v1/purchase_orders`, {
        purchase_order: {
          job_id: jobId,
          supplier_id: selectedContact.id,
          ted_task: selectedTrade?.name || customTaskName.trim(),
          status: "draft",
        },
      });
      setShowCreateModal(false);
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error("Failed to create purchase order:", err);
      setError("Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="flex flex-col h-full -mx-4">
      {/* TeeemTableView with server-side filtering by job_id */}
      <TeeemTableView
        key={refreshKey}
        foundationId={PURCHASE_ORDERS_TABLE_NAME}
        autoFetchRecords={true}
        initialFilters={[
          { id: "job-filter", column: "job_id", operator: "=", value: String(jobId) }
        ]}
        tableName="Purchase Orders"
        enableExport={true}
        onRefresh={() => setRefreshKey(k => k + 1)}
        onRowClick={handleRowClick}
        onRowUpdate={handleRowUpdate}
        leftActions={
          <Button onClick={handleOpenCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            New Purchase Order
          </Button>
        }
      />

      {/* Create PO Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>
              Create a new purchase order for {jobTitle || "this job"}.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-6 w-6"
                onClick={() => setError(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="space-y-4 py-4">
            {/* Supplier (Contact) Select */}
            <div className="space-y-2">
              <Label>Supplier</Label>
              <ComboboxDropdown<SupplierItem>
                items={contacts.map((contact) => ({
                  id: String(contact.id),
                  label: contact.display_name || `Contact ${contact.id}`,
                  // Include employee names in searchText so searching "Sandy" finds "Titus Tekform Pty Ltd"
                  searchText: contact.employee_names?.join(" ") || undefined,
                  employeeNames: contact.employee_names || [],
                }))}
                selectedItem={selectedContact ? {
                  id: String(selectedContact.id),
                  label: selectedContact.display_name || `Contact ${selectedContact.id}`,
                  searchText: selectedContact.employee_names?.join(" ") || undefined,
                  employeeNames: selectedContact.employee_names || [],
                } : undefined}
                onSelect={(item) => {
                  const contact = contacts.find((c) => String(c.id) === item.id);
                  setSelectedContact(contact || null);
                }}
                placeholder={loadingContacts ? "Loading suppliers..." : "Select supplier..."}
                searchPlaceholder="Search suppliers..."
                emptyResults="No supplier found."
                disabled={loadingContacts}
                isLoading={loadingContacts}
                renderListItem={({ isChecked, item, searchTerm }) => {
                  // Find matching employees based on search term
                  const searchLower = searchTerm.toLowerCase();
                  const matchingEmployees = searchTerm
                    ? item.employeeNames.filter(name =>
                        name.toLowerCase().includes(searchLower)
                      )
                    : [];

                  // Check if company name matches (not just employee)
                  const companyMatches = item.label.toLowerCase().includes(searchLower);

                  return (
                    <div className="flex flex-col w-full">
                      <div className="flex items-center">
                        <Check
                          className={`mr-2 h-4 w-4 flex-shrink-0 ${
                            isChecked ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {/* Show matching employees when search matches employee name (not company name) */}
                      {matchingEmployees.length > 0 && !companyMatches && (
                        <div className="ml-6 mt-0.5">
                          {matchingEmployees.slice(0, 2).map((employee, idx) => (
                            <div
                              key={idx}
                              className="flex items-center text-xs text-muted-foreground"
                            >
                              <CornerDownRight className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{employee} (Employee)</span>
                            </div>
                          ))}
                          {matchingEmployees.length > 2 && (
                            <div className="text-xs text-muted-foreground ml-4">
                              +{matchingEmployees.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </div>

            {/* Trade Select (Task Category) */}
            <div className="space-y-2">
              <Label>Trade</Label>
              <ComboboxDropdown
                items={trades.map((trade) => ({
                  id: String(trade.id),
                  label: trade.name,
                }))}
                selectedItem={selectedTrade ? {
                  id: String(selectedTrade.id),
                  label: selectedTrade.name,
                } : undefined}
                onSelect={(item) => {
                  const trade = trades.find((t) => String(t.id) === item.id);
                  setSelectedTrade(trade || null);
                  if (trade) setCustomTaskName(""); // Clear custom name when trade selected
                }}
                placeholder={loadingTrades ? "Loading trades..." : "Select trade..."}
                searchPlaceholder="Search trades..."
                emptyResults={trades.length === 0 ? "No trades available" : "No trade found."}
                disabled={loadingTrades || !!customTaskName}
                isLoading={loadingTrades}
                clearable
                onClear={() => setSelectedTrade(null)}
              />
            </div>

            {/* OR divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-muted" />
              <span className="text-xs text-muted-foreground">OR</span>
              <div className="flex-1 border-t border-muted" />
            </div>

            {/* Custom Task Name */}
            <div className="space-y-2">
              <Label>Custom Task Name</Label>
              <Input
                value={customTaskName}
                onChange={(e) => {
                  setCustomTaskName(e.target.value);
                  if (e.target.value) setSelectedTrade(null); // Clear trade when typing custom name
                }}
                placeholder="Enter custom task name..."
                disabled={!!selectedTrade}
              />
              <p className="text-xs text-muted-foreground">
                Use this if no trade matches your needs
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Creating...
                </>
              ) : (
                "Create Purchase Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JobPurchaseOrdersTab;
