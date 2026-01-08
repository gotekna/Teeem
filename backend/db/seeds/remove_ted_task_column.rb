# SSoT: Remove ted_task column from purchase-orders foundation
# Run this after the migration removes the database column

foundation = Foundation.find_by(slug: 'purchase-orders')
unless foundation
  puts "❌ purchase-orders foundation not found"
  exit
end

# Find and delete the old 'Task' column (ted_task)
old_task_col = foundation.columns.find_by(name: 'ted_task')
if old_task_col
  old_task_col.destroy
  puts "✅ Deleted old 'Task' column (ted_task)"
else
  puts "⚠️  Old 'Task' column (ted_task) not found - may already be deleted"
end

# Find and rename 'Sm Task' to 'Task'
sm_task_col = foundation.columns.find_by(name: 'sm_task_id')
if sm_task_col
  sm_task_col.update!(label: 'Task')
  puts "✅ Renamed 'Sm Task' to 'Task'"
else
  puts "⚠️  'Sm Task' column not found"
end

puts "🎉 Foundation column update complete"
