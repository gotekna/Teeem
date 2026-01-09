# Setup Expenses tab - Foundation columns and EntityTab
# This replicates the local database changes in production

puts "Setting up Expenses tab for production..."

# 1. Add Foundation columns for stage_from_task and trade_from_task
foundation = Foundation.find_by(slug: 'purchase-orders')
unless foundation
  puts "❌ purchase-orders Foundation not found"
  exit 1
end

# Check and create stage_from_task column
unless foundation.columns.exists?(column_name: 'stage_from_task')
  max_position = foundation.columns.maximum(:position) || 0
  Column.create!(
    foundation_id: foundation.id,
    column_name: 'stage_from_task',
    name: 'Stage',
    column_type: 'single_line_text',
    position: max_position + 1
  )
  puts "✅ Created stage_from_task column"
else
  puts "ℹ️  stage_from_task column already exists"
end

# Check and create trade_from_task column
unless foundation.columns.exists?(column_name: 'trade_from_task')
  max_position = foundation.columns.maximum(:position) || 0
  Column.create!(
    foundation_id: foundation.id,
    column_name: 'trade_from_task',
    name: 'Trade',
    column_type: 'single_line_text',
    position: max_position + 1
  )
  puts "✅ Created trade_from_task column"
else
  puts "ℹ️  trade_from_task column already exists"
end

# 2. Create or update Expenses EntityTab
finance_tab = EntityTab.find_by(scope: 'job', tab_key: 'finance')
unless finance_tab
  puts "❌ Finance parent tab not found"
  exit 1
end

expenses_tab = EntityTab.find_or_initialize_by(scope: 'job', tab_key: 'expenses')
expenses_tab.assign_attributes(
  display_name: 'Expenses',
  icon_name: 'Wallet',
  enabled: true,
  parent_id: finance_tab.id,  # Child of Finance
  order_position: 10,         # After Claims
  is_system_tab: true,
  component_name: 'JobExpensesTab'
)

if expenses_tab.new_record?
  expenses_tab.save!
  puts "✅ Created Expenses tab (ID: #{expenses_tab.id})"
else
  expenses_tab.save!
  puts "✅ Updated Expenses tab (ID: #{expenses_tab.id})"
end

puts ""
puts "Setup complete!"
puts "  Foundation columns: stage_from_task, trade_from_task"
puts "  EntityTab: expenses (child of Finance, position 10)"
