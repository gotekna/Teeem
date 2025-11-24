#!/usr/bin/env ruby
# frozen_string_literal: true

# Script to delete all user-created views and keep only system defaults
# Usage: rails runner scripts/reset_views_to_defaults.rb --yes

auto_confirm = ARGV.include?('--yes')

puts "\n🔄 Resetting all views to defaults...\n\n"

# Get all non-system views (anything not named __default_setup__)
user_views = TableView.where.not(name: '__default_setup__')

puts "📊 Found #{user_views.count} user-created views:\n\n"

views_by_table = user_views.group_by(&:table_id)

views_by_table.each do |table_id, views|
  table_name = Table.find_by(id: table_id)&.name || "Table #{table_id}"
  puts "  #{table_name} (#{views.count} views):"
  views.each do |view|
    user_email = view.user&.email || "Unknown user"
    puts "    - #{view.name} (ID: #{view.id}, User: #{user_email})"
  end
  puts ""
end

if user_views.count == 0
  puts "✅ No user-created views found. All tables already have default views only."
  exit
end

if auto_confirm
  response = 'yes'
  puts "✅ Auto-confirming deletion (--yes flag provided)\n"
else
  print "❓ Delete all #{user_views.count} user-created views? (yes/no): "
  response = STDIN.gets&.chomp&.downcase || 'no'
end

if response == 'yes'
  puts "\n🗑️  Deleting user-created views...\n"

  deleted_count = 0
  user_views.find_each do |view|
    table_name = view.table&.name || "Table #{view.table_id}"
    puts "   ✅ Deleted: #{view.name} from #{table_name} (ID: #{view.id})"
    view.destroy
    deleted_count += 1
  end

  puts "\n✅ Deleted #{deleted_count} user-created views"
  puts "✅ All tables now have default views only"
  puts "\n💡 Tip: New 'Default' views will be auto-created when you visit each table\n"
else
  puts "\n❌ Reset cancelled. No views were deleted."
end

puts ""
