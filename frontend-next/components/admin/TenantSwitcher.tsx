'use client';

import { Building2, ChevronDown, X, Shield } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTenant, Tenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

interface TenantSwitcherProps {
  className?: string;
  compact?: boolean;
}

/**
 * TenantSwitcher - Admin component for switching between tenants
 *
 * Only visible to TEEEM staff (users with @teeem.com.au email or super_admin role).
 * Displays a yellow banner/dropdown to indicate admin is viewing as a different tenant.
 */
export function TenantSwitcher({ className, compact = false }: TenantSwitcherProps) {
  const {
    tenants,
    currentTenant,
    isLoading,
    isTeeemStaff,
    canSwitchTenants,
    switchTenant,
    clearTenantOverride,
  } = useTenant();

  // Only show for TEEEM staff
  if (!isTeeemStaff) {
    return null;
  }

  // Don't render if no tenants available
  if (tenants.length === 0 && !isLoading) {
    return null;
  }

  const handleTenantChange = async (tenantId: string) => {
    const id = parseInt(tenantId, 10);
    if (!isNaN(id)) {
      await switchTenant(id);
    }
  };

  const handleClearOverride = async () => {
    await clearTenantOverride();
  };

  // Environment badge color
  const getEnvironmentBadgeVariant = (env: string) => {
    switch (env) {
      case 'production':
        return 'default';
      case 'beta':
        return 'secondary';
      case 'staging':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (compact) {
    // Compact mode - just the select dropdown
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Shield className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <Select
          value={currentTenant?.id?.toString() || ''}
          onValueChange={handleTenantChange}
          disabled={isLoading || !canSwitchTenants}
        >
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Select tenant" />
          </SelectTrigger>
          <SelectContent>
            {tenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id.toString()}>
                <TenantOption tenant={tenant} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Full mode - banner with context
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2',
        'bg-yellow-50 dark:bg-yellow-900/20',
        'border-b border-yellow-200 dark:border-yellow-800',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
            Viewing as:
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            <span className="text-sm text-yellow-600 dark:text-yellow-400">Loading...</span>
          </div>
        ) : (
          <Select
            value={currentTenant?.id?.toString() || ''}
            onValueChange={handleTenantChange}
            disabled={isLoading || !canSwitchTenants}
          >
            <SelectTrigger className="w-[220px] h-8 bg-white dark:bg-gray-800 border-yellow-300 dark:border-yellow-700">
              <SelectValue placeholder="Select tenant">
                {currentTenant && <TenantOption tenant={currentTenant} />}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id.toString()}>
                  <TenantOption tenant={tenant} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {currentTenant && (
          <div className="flex items-center gap-2">
            <Badge variant={getEnvironmentBadgeVariant(currentTenant.environment)}>
              {currentTenant.environment}
            </Badge>
            {currentTenant.isMasterTenant && (
              <Badge variant="destructive" className="text-xs">
                Master
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Clear override button */}
      {currentTenant && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearOverride}
          disabled={isLoading}
          className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:text-yellow-200 dark:hover:bg-yellow-900/40"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

// Helper component for tenant option display
function TenantOption({ tenant }: { tenant: Tenant }) {
  return (
    <div className="flex items-center gap-2">
      <span className="truncate">{tenant.name}</span>
      {tenant.slug && (
        <span className="text-xs text-muted-foreground">({tenant.slug})</span>
      )}
    </div>
  );
}

export default TenantSwitcher;
