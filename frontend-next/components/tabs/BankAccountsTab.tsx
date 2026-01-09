"use client";

/**
 * BankAccountsTab - Shows bank accounts for a company
 *
 * Extracted from corporate page for unified tab system.
 * Uses TeeemTableView and Foundation API (ID: 350) for bank accounts.
 * Includes Xero sync functionality.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { CorporateCompany } from "@/lib/types/corporate";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { XeroStatementView } from "@/components/corporate/XeroStatementView";
import { Spinner } from "@/components/ui/spinner";

interface BankAccountsTabProps {
  company: CorporateCompany;
  companyId?: string;
  entityId?: string;
}

interface SelectedBankAccount {
  id: number | string;
  account_name?: string;
  xero_account_id?: string;
}

export function BankAccountsTab({ company, companyId }: BankAccountsTabProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [entries, setEntries] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [selectedAccount, setSelectedAccount] = React.useState<SelectedBankAccount | null>(null);

  const effectiveCompanyId = companyId || String(company.id);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);

      // Load bank account entries for this company
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entriesResponse = await api.get<{ success: boolean; bank_accounts: any[] }>(
        `/api/v1/companies/${effectiveCompanyId}/bank_accounts`
      );
      if (entriesResponse.success) {
        setEntries(entriesResponse.bank_accounts || []);
      }
    } catch (error) {
      console.error("Failed to load bank accounts:", error);
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId]);

  // Sync bank accounts from Xero
  // - Renames Xero accounts to standardized format: {BANK_CODE} {BSB} {ACCOUNT_NUMBER}
  // - Sets date_opened from first transaction in Xero
  // - Sets status/date_closed based on Xero ARCHIVED status
  // - Stores official bank account name from Xero
  const syncFromXero = React.useCallback(async () => {
    try {
      setSyncing(true);
      // This endpoint syncs from Xero AND auto-creates local bank accounts
      const response = await api.get<{
        success: boolean;
        auto_created_count?: number;
        auto_linked_count?: number;
        renamed_count?: number;
        updated_count?: number;
        error?: string;
      }>(`/api/v1/companies/${effectiveCompanyId}/xero/bank_accounts`);

      if (response.success) {
        // Reload local bank accounts to show synced data
        await loadData();

        const created = response.auto_created_count || 0;
        const linked = response.auto_linked_count || 0;
        const renamed = response.renamed_count || 0;
        const updated = response.updated_count || 0;

        // Build summary message
        const changes: string[] = [];
        if (created > 0) changes.push(`${created} created`);
        if (linked > 0) changes.push(`${linked} linked`);
        if (renamed > 0) changes.push(`${renamed} renamed in Xero`);
        if (updated > 0) changes.push(`${updated} updated`);

        if (changes.length > 0) {
          toast.success(`Xero Sync Complete`, {
            description: changes.join(", ")
          });
        } else {
          toast.info("Xero Sync Complete", {
            description: "All accounts already up to date"
          });
        }
      } else {
        toast.error("Sync Failed", {
          description: response.error || "Unknown error"
        });
      }
    } catch (error) {
      console.error("Failed to sync from Xero:", error);
      toast.error("Sync Failed", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setSyncing(false);
    }
  }, [effectiveCompanyId, loadData]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    await loadData();
  };

  const handleRowUpdate = async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.put(`/api/v1/bank_accounts/${rowId}`, {
        bank_account: { [field]: value }
      });
      await loadData();
    } catch (error) {
      console.error("Failed to update bank account:", error);
      throw error;
    }
  };

  const handleDelete = async (row: { id: number | string; [key: string]: unknown }) => {
    try {
      await api.delete(`/api/v1/bank_accounts/${row.id}`);
      await loadData();
    } catch (error) {
      console.error("Failed to delete bank account:", error);
      throw error;
    }
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    try {
      await Promise.all(ids.map(id => api.delete(`/api/v1/bank_accounts/${id}`)));
      await loadData();
    } catch (error) {
      console.error("Failed to bulk delete bank accounts:", error);
      throw error;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleRowClick = (row: any) => {
    setSelectedAccount({
      id: row.id,
      account_name: row.account_name,
      xero_account_id: row.xero_account_id
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full">
      <TeeemTableView
        entries={entries}
        // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
        foundationId="bank_accounts"
        tableName="Bank Accounts"
        enableExport={true}
        enableImport={false}
        onRefresh={handleRefresh}
        onRowUpdate={handleRowUpdate}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRowClick={handleRowClick}
        leftActions={
          <Button
            variant="outline"
            size="sm"
            onClick={syncFromXero}
            disabled={syncing}
          >
            {syncing ? (
              <>
                <Spinner size={16} className="mr-2" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync from Xero
              </>
            )}
          </Button>
        }
      />

      {/* Bank Transactions Sheet */}
      <Sheet open={!!selectedAccount} onOpenChange={(open) => !open && setSelectedAccount(null)}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedAccount?.account_name || "Bank Transactions"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {selectedAccount && (
              <XeroStatementView
                companyId={effectiveCompanyId}
                tabKey="bank-statement"
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default BankAccountsTab;
