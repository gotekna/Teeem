# frozen_string_literal: true

# FRC (Mar 2026): All warehouse folders were meant to be global (tenant_id=NULL)
# but many were created with tenant_id set before auto_globalize_master_record was added.
# WarehouseFolder already allows any tenant to edit global records (overrides write protection),
# so making them all global is the correct default.
class SetAllWarehouseFoldersToGlobal < ActiveRecord::Migration[8.0]
  def up
    # Set all warehouse_folders to global scope (tenant_id = NULL)
    count = execute("UPDATE warehouse_folders SET tenant_id = NULL WHERE tenant_id IS NOT NULL").cmd_tuples
    say "Set #{count} warehouse folders to global scope"
  end

  def down
    # Cannot reverse - we don't know which tenant_id each folder had
    say "Cannot reverse - warehouse folders remain global"
  end
end
