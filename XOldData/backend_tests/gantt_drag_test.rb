#!/usr/bin/env ruby
# frozen_string_literal: true

# Gantt Drag Test - Simulates dragging Task 1 and verifies cascade behavior
# Usage: rails runner test/gantt_drag_test.rb [template_id] [template_name]
#   template_id: Optional template ID to test (default: 4)
#   template_name: Optional template name (default: Bug Hunter Schedule Master)
#
# Examples:
#   rails runner test/gantt_drag_test.rb
#   rails runner test/gantt_drag_test.rb 5 "My Custom Template"

# Get template configuration from command line or use defaults
template_id = ARGV[0]&.to_i || 4
template_name = ARGV[1] || 'Bug Hunter Schedule Master'

puts "🧪 GANTT DRAG TEST #1: Move Task 1 by 5 days"
puts "📋 Testing template: #{template_name} (ID: #{template_id})"
puts "=" * 60

# Find template and tasks
template = ScheduleTemplate.find_by(id: template_id)
unless template
  puts "❌ ERROR: Template with ID #{template_id} not found"
  exit 1
end

puts "✅ Found template: #{template.name} (ID: #{template.id})"

# Get tasks
task1 = template.schedule_template_rows.find_by(id: 311) # Task 1
task2 = template.schedule_template_rows.find_by(id: 313) # Task 2 (depends on Task 1)
task3 = template.schedule_template_rows.find_by(id: 312) # Task 3 (depends on Task 1)

unless task1 && task2 && task3
  puts "❌ ERROR: Tasks not found (311, 313, 312)"
  exit 1
end

puts "\n📋 Initial State:"
puts "  Task 1 (#{task1.id}): start_date = #{task1.start_date}, sequence_order = #{task1.sequence_order}, manually_positioned = #{task1.manually_positioned}"
puts "  Task 2 (#{task2.id}): start_date = #{task2.start_date}, sequence_order = #{task2.sequence_order}, predecessors = #{task2.predecessor_ids}"
puts "  Task 3 (#{task3.id}): start_date = #{task3.start_date}, sequence_order = #{task3.sequence_order}, predecessors = #{task3.predecessor_ids}"

# Save original dates
original_task1_date = task1.start_date
original_task2_date = task2.start_date
original_task3_date = task3.start_date

# Simulate dragging Task 1 forward by 5 days
new_start_date = task1.start_date + 5

puts "\n🎯 Simulating drag: Moving Task 1 from day #{task1.start_date} to day #{new_start_date}"

# Update Task 1 (this should trigger cascade)
task1.update!(start_date: new_start_date)
task1.reload

puts "\n✅ Task 1 updated to: #{task1.start_date}"

# Reload dependent tasks
task2.reload
task3.reload

puts "\n📋 After Update:"
puts "  Task 1 (#{task1.id}): start_date = #{task1.start_date} (moved +5 days)"
puts "  Task 2 (#{task2.id}): start_date = #{task2.start_date} (should move +5 days)"
puts "  Task 3 (#{task3.id}): start_date = #{task3.start_date} (should move +5 days)"

# Verify cascade worked
expected_task2_date = original_task2_date + 5
expected_task3_date = original_task3_date + 5

puts "\n🔍 Verification:"

success = true

if task2.start_date == expected_task2_date
  puts "  ✅ Task 2 cascaded correctly (#{task2.start_date})"
else
  puts "  ❌ Task 2 cascade FAILED: expected #{expected_task2_date}, got #{task2.start_date}"
  success = false
end

if task3.start_date == expected_task3_date
  puts "  ✅ Task 3 cascaded correctly (#{task3.start_date})"
else
  puts "  ❌ Task 3 cascade FAILED: expected #{expected_task3_date}, got #{task3.start_date}"
  success = false
end

# Restore original dates
puts "\n🔄 Restoring original state..."
task1.update!(start_date: original_task1_date)
task2.reload
task3.reload

puts "  Task 1 restored to: #{task1.start_date}"
puts "  Task 2 restored to: #{task2.start_date}"
puts "  Task 3 restored to: #{task3.start_date}"

puts "\n" + "=" * 60
if success
  puts "✅ TEST PASSED: Cascade logic works correctly"
  exit 0
else
  puts "❌ TEST FAILED: Cascade logic has issues"
  exit 1
end
