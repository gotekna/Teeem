# frozen_string_literal: true

# Phase 6 Cleanup: Fix warehouse_root_folders SSoT
#
# Issues found:
# 1. 'user' key exists - Users are auth only, no separate storage (remove it)
# 2. 'contact' has path "People/..." - should be "Contacts/..." (Jan 2026 consolidation)
#
class FixWarehouseRootFoldersPeopleToContacts < ActiveRecord::Migration[8.0]
  def up
    StorageConfiguration.find_each do |sc|
      next unless sc.warehouse_root_folders.present?

      folders = sc.warehouse_root_folders.dup

      changed = false

      # Remove 'user' key - Users are auth only, Contacts are identity
      if folders.key?('user')
        folders.delete('user')
        changed = true
        say "Removed 'user' from warehouse_root_folders"
      end

      # Fix 'contact' path from "People/..." to "Contacts/..."
      if folders['contact']&.start_with?('People/')
        old_path = folders['contact']
        folders['contact'] = old_path.sub('People/', 'Contacts/')
        changed = true
        say "Fixed 'contact' path: #{old_path} → #{folders['contact']}"
      end

      if changed
        sc.update_column(:warehouse_root_folders, folders)
        say "Updated StorageConfiguration##{sc.id}"
      end
    end
  end

  def down
    # Reversible - add 'user' back and revert 'contact' path
    StorageConfiguration.find_each do |sc|
      next unless sc.warehouse_root_folders.present?

      folders = sc.warehouse_root_folders.dup

      # Add 'user' back
      folders['user'] = 'Users/{{UserName}}' unless folders.key?('user')

      # Revert 'contact' path
      if folders['contact']&.start_with?('Contacts/')
        folders['contact'] = folders['contact'].sub('Contacts/', 'People/')
      end

      sc.update_column(:warehouse_root_folders, folders)
    end
  end
end
