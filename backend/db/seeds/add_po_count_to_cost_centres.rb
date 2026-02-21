# Add per-template PO count columns to cost_centres Foundation
# Shows how many POs reference each cost centre, broken down by schedule template
#
# Creates one column per active SmScheduleMasterTemplate (e.g., "POs (House Schedule Master)")
# Column names use parameterized template names: po_count_house_schedule_master

puts "Adding per-template PO count columns to cost_centres Foundation..."

foundation = Foundation.find_by(slug: 'cost_centres')
unless foundation
  puts "cost_centres Foundation not found"
  exit 1
end

# Remove old single PO count column if it exists
old_col = foundation.columns.find_by(column_name: 'purchase_orders_count')
if old_col
  old_col.destroy
  puts "Removed old purchase_orders_count column"
end

# Create one column per active template
templates = SmScheduleMasterTemplate.active.ordered
template_names = templates.pluck(:name).uniq

max_position = foundation.columns.maximum(:position) || 0

template_names.each_with_index do |tname, idx|
  col_name = "po_count_#{tname.parameterize(separator: '_')}"
  display_name = "POs (#{tname.gsub('Schedule Master', 'SM').gsub('Schedule', 'Sched')})"

  unless foundation.columns.exists?(column_name: col_name)
    Column.create!(
      foundation_id: foundation.id,
      column_name: col_name,
      name: display_name,
      column_type: 'whole_number',
      position: max_position + 1 + idx
    )
    puts "Created column: #{col_name} -> '#{display_name}'"
  else
    puts "Column #{col_name} already exists"
  end
end

puts "Done!"
