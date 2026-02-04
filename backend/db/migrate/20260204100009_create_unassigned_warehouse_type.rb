# frozen_string_literal: true

# Creates a special "unassigned" warehouse type to hold orphaned base folders
#
# Since warehouse_type_id has a NOT NULL constraint on base_folders,
# we need somewhere for folders to go when deselected from a type.
# This hidden type serves as that destination.
class CreateUnassignedWarehouseType < ActiveRecord::Migration[7.1]
  def up
    # Use direct SQL to bypass model validations for seeding
    execute <<-SQL
      INSERT INTO warehouse_types (code, display_name, description, is_system, enabled, order_position, created_at, updated_at)
      VALUES ('unassigned', 'Unassigned', 'System type for unassigned base folders', true, false, 999, NOW(), NOW())
      ON CONFLICT (code) DO NOTHING;
    SQL
  end

  def down
    execute <<-SQL
      DELETE FROM warehouse_types WHERE code = 'unassigned';
    SQL
  end
end
