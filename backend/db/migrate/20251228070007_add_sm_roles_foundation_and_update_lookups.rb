# SSoT: Configure lookup columns for SM Schedule Master
# - Cost Centre → Foundation 533 (Cost Centres)
# - Assigned Role → Foundation 413 (Role) - same as Admin > System > Company > Security > Roles
class AddSmRolesFoundationAndUpdateLookups < ActiveRecord::Migration[8.0]
  def up
    # 1. Update Cost Centre column to be a lookup
    update_cost_centre_column

    # 2. Update Assigned Role column to be a lookup (uses existing Role Foundation)
    update_assigned_role_column
  end

  def down
    # Revert columns to single_line_text
    sm_schedule_master = Foundation.find_by(name: "SM Schedule Master")
    return unless sm_schedule_master

    cost_centre_col = sm_schedule_master.columns.find_by(name: "Cost Centre")
    cost_centre_col&.update!(column_type: "single_line_text", lookup_foundation_id: nil, lookup_display_column: nil)

    assigned_role_col = sm_schedule_master.columns.find_by(name: "Assigned Role")
    assigned_role_col&.update!(column_type: "single_line_text", lookup_foundation_id: nil, lookup_display_column: nil)
  end

  private

  def update_cost_centre_column
    sm_schedule_master = Foundation.find_by(name: "SM Schedule Master")
    return unless sm_schedule_master

    cost_centre_col = sm_schedule_master.columns.find_by(name: "Cost Centre")
    return unless cost_centre_col

    # Cost Centres foundation is ID 533
    cost_centre_col.update!(
      column_type: "lookup",
      lookup_foundation_id: 533,
      lookup_display_column: "name"
    )
    puts "Updated Cost Centre column to lookup → Foundation 533 (Cost Centres)"
  end

  def update_assigned_role_column
    sm_schedule_master = Foundation.find_by(name: "SM Schedule Master")
    return unless sm_schedule_master

    assigned_role_col = sm_schedule_master.columns.find_by(name: "Assigned Role")
    return unless assigned_role_col

    # Role foundation is ID 413 - same as Admin > System > Company > Security > Roles
    assigned_role_col.update!(
      column_type: "lookup",
      lookup_foundation_id: 413,
      lookup_display_column: "display_name"
    )
    puts "Updated Assigned Role column to lookup → Foundation 413 (Role)"

    # Migrate existing text values to Role IDs
    migrate_assigned_role_data
  end

  def migrate_assigned_role_data
    # Map old text values to Role IDs
    # Role table: 3=supervisor, 6=admin
    mapping = {
      "admin" => "6",
      "supervisor" => "3"
    }

    mapping.each do |name, id|
      result = ActiveRecord::Base.connection.execute(
        "UPDATE sm_schedule_master SET assigned_role = '#{id}' WHERE assigned_role = '#{name}'"
      )
      puts "  Migrated assigned_role '#{name}' → '#{id}'"
    end
  end
end
