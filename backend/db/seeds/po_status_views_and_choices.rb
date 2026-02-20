# Add colored choice options to PO status column and create global PO status views
# Run: rails runner db/seeds/po_status_views_and_choices.rb

puts "Setting up PO status column choices and global views..."

foundation = Foundation.find_by(slug: 'purchase-orders')
unless foundation
  puts "purchase-orders Foundation not found"
  exit 1
end

# ============================================================================
# 1. Update status column with colored choices
# ============================================================================
status_column = foundation.columns.find_by(column_name: 'status')
if status_column
  # Ensure column_type is 'choice' (may be 'single_line_text')
  if status_column.column_type != 'choice'
    status_column.update!(column_type: 'choice')
    puts "Updated status column_type to 'choice'"
  end

  # Set available_choices (plain string values for the dropdown editor)
  choice_values = %w[draft pending approved sent received invoiced paid cancelled]
  status_column.update!(available_choices: choice_values)
  puts "Updated available_choices: #{choice_values.join(', ')}"

  # Store colors and labels in settings JSONB (used by displayChoice renderer)
  settings = status_column.settings || {}
  settings["choice_colors"] = {
    "draft"     => "bg-muted text-foreground",
    "pending"   => "bg-status-warning text-status-warning-foreground",
    "approved"  => "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    "sent"      => "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
    "received"  => "bg-status-success text-status-success-foreground",
    "invoiced"  => "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300",
    "paid"      => "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300",
    "cancelled" => "bg-status-error text-status-error-foreground"
  }
  settings["choice_labels"] = {
    "draft"     => "Draft",
    "pending"   => "Pending",
    "approved"  => "Approved",
    "sent"      => "Sent",
    "received"  => "Received",
    "invoiced"  => "Invoiced",
    "paid"      => "Paid",
    "cancelled" => "Cancelled"
  }
  status_column.update!(settings: settings)
  puts "Updated settings with choice_colors and choice_labels"
else
  puts "WARNING: status column not found on purchase-orders Foundation"
end

# ============================================================================
# 2. Add missing Foundation columns for virtual fields used by group-by
# ============================================================================
virtual_columns = [
  { column_name: "stage_from_task", name: "Stage", column_type: "single_line_text" },
  { column_name: "trade_from_task", name: "Trade", column_type: "single_line_text" },
  { column_name: "profit_centre_from_line_items", name: "Profit Centre", column_type: "single_line_text" }
]

virtual_columns.each do |vc|
  unless foundation.columns.exists?(column_name: vc[:column_name])
    max_pos = foundation.columns.maximum(:position) || 0
    Column.create!(
      foundation_id: foundation.id,
      column_name: vc[:column_name],
      name: vc[:name],
      column_type: vc[:column_type],
      position: max_pos + 1
    )
    puts "Created column: #{vc[:column_name]} (#{vc[:name]})"
  else
    puts "Column already exists: #{vc[:column_name]}"
  end
end

# ============================================================================
# 3. Create global views (status filters + group-by views) across all tenants
# ============================================================================
# Status filter views
status_views = [
  { name: "All POs",    filter_value: nil },
  { name: "Draft",      filter_value: "draft" },
  { name: "Pending",    filter_value: "pending" },
  { name: "Approved",   filter_value: "approved" },
  { name: "Sent",       filter_value: "sent" },
  { name: "Received",   filter_value: "received" },
  { name: "Invoiced",   filter_value: "invoiced" },
  { name: "Paid",       filter_value: "paid" },
  { name: "Cancelled",  filter_value: "cancelled" }
]

# Group-by views (replaces the toolbar group-by buttons)
group_views = [
  { name: "By PO/Task",       group_by: "po_task_name" },
  { name: "By Supplier",      group_by: "supplier_id" },
  { name: "By Stage",         group_by: "stage_from_task" },
  { name: "By Trade",         group_by: "trade_from_task" },
  { name: "By Cost Centre",   group_by: "cost_centre_from_task" },
  { name: "By Profit Centre", group_by: "profit_centre_from_line_items" }
]

Tenant.find_each do |tenant|
  ActsAsTenant.with_tenant(tenant) do
    puts "\nTenant: #{tenant.name} (ID: #{tenant.id})"

    # Remove existing global views for this foundation (replace with new set)
    existing_global = FoundationView.global_views.where(foundation_id: foundation.id)
    if existing_global.any?
      puts "  Removing #{existing_global.count} existing global view(s)..."
      existing_global.destroy_all
    end

    idx = 0

    # Create status filter views
    status_views.each do |status_def|
      filters = if status_def[:filter_value]
        {
          "filters" => [
            { "column" => "status", "operator" => "equals", "value" => status_def[:filter_value], "groupId" => "default" }
          ],
          "filterGroups" => [{ "id" => "default", "logic" => "AND" }],
          "interGroupLogic" => "AND"
        }
      else
        {}
      end

      view = FoundationView.new(
        tenant_id: tenant.id,
        foundation_id: foundation.id,
        name: status_def[:name],
        view_type: "custom",
        is_global: true,
        user_id: nil,
        is_default: idx == 0,
        display_order: idx,
        filters: filters,
        sort_order: [{ "column" => "purchase_order_number", "dir" => "desc" }]
      )

      if view.save
        puts "  Created: #{status_def[:name]}#{status_def[:filter_value] ? " (filter: status=#{status_def[:filter_value]})" : ""}"
      else
        puts "  FAILED: #{status_def[:name]} - #{view.errors.full_messages.join(', ')}"
      end
      idx += 1
    end

    # Create group-by views
    group_views.each do |group_def|
      view = FoundationView.new(
        tenant_id: tenant.id,
        foundation_id: foundation.id,
        name: group_def[:name],
        view_type: "custom",
        is_global: true,
        user_id: nil,
        is_default: false,
        display_order: idx,
        group_by_columns: [group_def[:group_by]],
        sort_order: [{ "column" => "purchase_order_number", "dir" => "desc" }]
      )

      if view.save
        puts "  Created: #{group_def[:name]} (group_by: #{group_def[:group_by]})"
      else
        puts "  FAILED: #{group_def[:name]} - #{view.errors.full_messages.join(', ')}"
      end
      idx += 1
    end
  end
end

puts "\nDone!"
