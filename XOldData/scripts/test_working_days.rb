# Test script for working days enforcement in Schedule Cascade
# Run with: bin/rails runner test_working_days.rb

# Find or create a test user
user = User.first || User.create!(
  email: "test@example.com",
  name: "Test User",
  password: "Password123!",
  password_confirmation: "Password123!",
  role: "admin"
)

# Create a test template
template = ScheduleTemplate.create!(
  name: "Working Days Test Schedule",
  description: "Demonstrates working days enforcement with weekends and holidays",
  created_by_id: user.id
)

# Create test tasks that will cascade across weekends
# Assuming today is a reference point, create tasks that span a weekend

# Task 1: Starting on a Thursday (day 0)
task1 = ScheduleTemplateRow.create!(
  schedule_template: template,
  name: "Foundation - Thursday Start",
  sequence_order: 0,
  start_date: 0,  # Thursday
  duration: 2,    # Ends Friday
  predecessor_ids: [],
  manually_positioned: false
)

# Task 2: Should start Monday (skips weekend)
# FS dependency with 0 lag from Task 1 (ends Friday) -> should start Monday
task2 = ScheduleTemplateRow.create!(
  schedule_template: template,
  name: "Framing - Auto Skip Weekend",
  sequence_order: 1,
  start_date: 10,  # Placeholder
  duration: 3,
  predecessor_ids: [{ id: 1, type: "FS", lag: 2 }],  # +2 lag would land on Sunday
  manually_positioned: false
)

# Task 3: Locked task on Saturday (should NOT move)
task3 = ScheduleTemplateRow.create!(
  schedule_template: template,
  name: "Concrete Pour - LOCKED (Supplier Confirmed)",
  sequence_order: 2,
  start_date: 6,  # Saturday (intentionally)
  duration: 1,
  predecessor_ids: [],
  supplier_confirm: true,  # LOCKED
  manually_positioned: false
)

# Task 4: Manually positioned on Sunday (should be skipped in cascade)
task4 = ScheduleTemplateRow.create!(
  schedule_template: template,
  name: "Manual Task - Sunday",
  sequence_order: 3,
  start_date: 7,  # Sunday
  duration: 1,
  predecessor_ids: [{ id: 1, type: "FS", lag: 0 }],
  manually_positioned: true  # Should be skipped
)

# Task 5: Regular task that should cascade
task5 = ScheduleTemplateRow.create!(
  schedule_template: template,
  name: "Electrical Rough-in",
  sequence_order: 4,
  start_date: 10,
  duration: 2,
  predecessor_ids: [{ id: 2, type: "FS", lag: 0 }],
  manually_positioned: false
)

puts "✅ Created test schedule template: #{template.name} (ID: #{template.id})"
puts ""
puts "Tasks created (BEFORE cascade):"
puts "1. #{task1.name} - Day #{task1.start_date} (Duration: #{task1.duration})"
puts "2. #{task2.name} - Day #{task2.start_date} (Duration: #{task2.duration}) - Should skip weekend"
puts "3. #{task3.name} - Day #{task3.start_date} (LOCKED - can stay on weekend)"
puts "4. #{task4.name} - Day #{task4.start_date} (MANUAL - won't cascade)"
puts "5. #{task5.name} - Day #{task5.start_date} (Duration: #{task5.duration})"
puts ""
puts "Now triggering cascade from Task 1..."

# Trigger cascade by updating task1
task1.update_column(:start_date, 3)  # Change to day 3
affected = ScheduleCascadeService.cascade_changes(task1, [:start_date])

puts ""
puts "CASCADE RESULTS (AFTER):"
puts "Affected #{affected.length} tasks"
affected.each do |t|
  t.reload
  locked = t.supplier_confirm? || t.confirm? || t.start? || t.complete? || t.manually_positioned?

  # Calculate what day of week this would be
  reference_date = Date.today
  actual_date = reference_date + t.start_date.days
  day_name = actual_date.strftime("%A")

  puts "- #{t.name}: Day #{t.start_date} (#{day_name}) #{locked ? '🔒 LOCKED' : '✓'}"
end

puts ""
puts "Key observations:"
puts "- Unlocked tasks should ONLY be on weekdays (Mon-Fri)"
puts "- Locked tasks (supplier_confirm, confirm, start, complete) CAN be on weekends"
puts "- Manually positioned tasks are NOT cascaded to"
puts ""
puts "Template ID for viewing in UI: #{template.id}"
