'use client';

import * as React from 'react';
import { ComboboxDropdown, ComboboxItem } from '@/components/ui/combobox-dropdown';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Users } from 'lucide-react';
import { useAssignableRoles } from '@/hooks/useAssignableRoles';

interface UserOption {
  id: number;
  name: string;
}

interface TaskAssignmentFieldProps {
  users: UserOption[];
  assignedUserId?: string;
  assignedRole?: string;
  onAssignedUserChange: (userId: string) => void;
  onAssignedRoleChange: (role: string) => void;
  disabled?: boolean;
}

export function TaskAssignmentField({
  users,
  assignedUserId,
  assignedRole,
  onAssignedUserChange,
  onAssignedRoleChange,
  disabled,
}: TaskAssignmentFieldProps) {
  // SSoT: Fetch roles from backend
  const { roles } = useAssignableRoles();

  // Determine mode based on current values
  const mode = assignedRole ? 'role' : 'user';

  const handleModeChange = (newMode: string) => {
    if (newMode === 'user') {
      onAssignedRoleChange(''); // Clear role
    } else {
      onAssignedUserChange(''); // Clear user
    }
  };

  const userItems: ComboboxItem[] = users.map((u) => ({
    id: String(u.id),
    label: u.name,
  }));

  const selectedUser = userItems.find((u) => u.id === assignedUserId);

  return (
    <div className="space-y-2">
      <Tabs value={mode} onValueChange={handleModeChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="user" className="text-xs h-7" disabled={disabled}>
            <User className="h-3 w-3 mr-1" />
            User
          </TabsTrigger>
          <TabsTrigger value="role" className="text-xs h-7" disabled={disabled}>
            <Users className="h-3 w-3 mr-1" />
            Role
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === 'user' ? (
        <ComboboxDropdown
          items={userItems}
          selectedItem={selectedUser}
          onSelect={(item) => onAssignedUserChange(item.id)}
          placeholder="Search users..."
          clearable
          onClear={() => onAssignedUserChange('')}
          disabled={disabled}
        />
      ) : (
        <Select
          value={assignedRole || '_none'}
          onValueChange={(v) => onAssignedRoleChange(v === '_none' ? '' : v)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Unassigned</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
