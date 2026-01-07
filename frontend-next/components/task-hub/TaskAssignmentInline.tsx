'use client';

import { useState, useEffect } from 'react';
import { ComboboxDropdown, ComboboxItem } from '@/components/ui/combobox-dropdown';
import { Button } from '@/components/ui/button';
import { User, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAssignableRoles } from '@/hooks/useAssignableRoles';

interface UserOption {
  id: number;
  name: string;
}

interface TaskAssignmentInlineProps {
  assignedUserId?: number;
  assignedRole?: string;
  onAssign: (userId?: number, role?: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function TaskAssignmentInline({
  assignedUserId,
  assignedRole,
  onAssign,
  disabled,
  compact,
}: TaskAssignmentInlineProps) {
  // SSoT: Fetch roles from backend
  const { roles } = useAssignableRoles();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [mode, setMode] = useState<'user' | 'role'>(assignedRole ? 'role' : 'user');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Load users on mount
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await api.get<{ users: UserOption[] }>('/api/v1/users/for_select');
        if (response.users) {
          setUsers(response.users);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    loadUsers();
  }, []);

  const userItems: ComboboxItem[] = users.map((u) => ({
    id: String(u.id),
    label: u.name,
  }));

  const selectedUser = userItems.find((u) => u.id === String(assignedUserId));

  const handleModeChange = (newMode: 'user' | 'role') => {
    setMode(newMode);
    // Clear the other value when switching modes
    if (newMode === 'user' && assignedRole) {
      onAssign(undefined, undefined);
    } else if (newMode === 'role' && assignedUserId) {
      onAssign(undefined, undefined);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1')}>
      {/* Mode toggle buttons */}
      <div className="flex border rounded-md">
        <Button
          type="button"
          variant={mode === 'user' ? 'default' : 'ghost'}
          size="sm"
          className={cn('h-7 px-2 rounded-r-none', compact && 'h-6 px-1.5')}
          onClick={() => handleModeChange('user')}
          disabled={disabled}
        >
          <User className={cn('h-3.5 w-3.5', compact && 'h-3 w-3')} />
        </Button>
        <Button
          type="button"
          variant={mode === 'role' ? 'default' : 'ghost'}
          size="sm"
          className={cn('h-7 px-2 rounded-l-none', compact && 'h-6 px-1.5')}
          onClick={() => handleModeChange('role')}
          disabled={disabled}
        >
          <Users className={cn('h-3.5 w-3.5', compact && 'h-3 w-3')} />
        </Button>
      </div>

      {/* User or Role selector */}
      <div className="flex-1 min-w-[120px]">
        {mode === 'user' ? (
          <ComboboxDropdown
            items={userItems}
            selectedItem={selectedUser}
            onSelect={(item) => onAssign(parseInt(item.id), undefined)}
            placeholder={loadingUsers ? 'Loading...' : 'Select user...'}
            clearable
            onClear={() => onAssign(undefined, undefined)}
            disabled={disabled || loadingUsers}
            className={cn(compact && 'h-7 text-xs')}
          />
        ) : (
          <ComboboxDropdown
            items={[
              { id: '_unassigned', label: 'Unassigned' },
              ...roles.map((r) => ({
                id: r.value,
                label: r.label,
              }))
            ]}
            selectedItem={
              assignedRole
                ? { id: assignedRole, label: roles.find(r => r.value === assignedRole)?.label || assignedRole }
                : { id: '_unassigned', label: 'Unassigned' }
            }
            onSelect={(item) => onAssign(undefined, item.id === '_unassigned' ? undefined : item.id)}
            placeholder="Select role..."
            disabled={disabled}
            className={cn(compact && 'h-7 text-xs')}
          />
        )}
      </div>
    </div>
  );
}
