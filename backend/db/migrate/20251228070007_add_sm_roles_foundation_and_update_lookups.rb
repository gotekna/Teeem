# SSoT: Configure lookup columns for SM Schedule Master
# - Cost Centre → Foundation "Cost Centres" (looked up by name)
# - Assigned Role → Foundation "Role" (looked up by name)
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

    # Look up Cost Centres foundation by name (ID varies between environments)
    cost_centres_foundation = Foundation.find_by(name: "Cost Centres")
    unless cost_centres_foundation
      puts "WARNING: Cost Centres foundation not found - skipping"
      return
    end

    cost_centre_col.update!(
      column_type: "lookup",
      lookup_foundation_id: cost_centres_foundation.id,
      lookup_display_column: "name"
    )
    puts "Updated Cost Centre column to lookup → Foundation #{cost_centres_foundation.id} (Cost Centres)"
  end

  def update_assigned_role_column
    sm_schedule_master = Foundation.find_by(name: "SM Schedule Master")
    return unless sm_schedule_master

    assigned_role_col = sm_schedule_master.columns.find_by(name: "Assigned Role")
    return unless assigned_role_col

    # Look up Role foundation by name (ID varies between environments)
    role_foundation = Foundation.find_by(name: "Role")
    unless role_foundation
      puts "WARNING: Role foundation not found - skipping"
      return
    end

    assigned_role_col.update!(
      column_type: "lookup",
      lookup_foundation_id: role_foundation.id,
      lookup_display_column: "display_name"
    )
    puts "Updated Assigned Role column to lookup → Foundation #{role_foundation.id} (Role)"

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
