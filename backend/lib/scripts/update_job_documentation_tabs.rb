# Update JobDocumentationTabs to match folder template structure
job = Job.find(69)
puts "=== UPDATING DOCUMENTATION TABS FOR JOB 69 ==="
puts ""

# Current tabs
puts "Current tabs:"
job.job_documentation_tabs.order(:sequence_order).each do |tab|
  puts "  #{tab.id}: #{tab.name}"
end
puts ""

# Delete old tabs
job.job_documentation_tabs.destroy_all
puts "Cleared old tabs"
puts ""

# New tabs matching folder structure
new_tabs = [
  { name: "01 Sales", sequence_order: 1, folder_path: "01 Sales" },
  { name: "02 PreCon", sequence_order: 2, folder_path: "02 PreCon" },
  { name: "03 Certification", sequence_order: 3, folder_path: "03 Certification" },
  { name: "04 Plans", sequence_order: 4, folder_path: "04 Plans" },
  { name: "05 Site", sequence_order: 5, folder_path: "05 Site" },
  { name: "06 Photo", sequence_order: 6, folder_path: "06 Photo" },
  { name: "07 Final Approval", sequence_order: 7, folder_path: "07 Final Approval" }
]

new_tabs.each do |attrs|
  tab = job.job_documentation_tabs.create!(attrs)
  puts "Created: #{tab.name} (#{tab.folder_path})"
end

puts ""
puts "=== UPDATED TABS ==="
job.job_documentation_tabs.reload.order(:sequence_order).each do |tab|
  puts "  #{tab.sequence_order}. #{tab.name} -> #{tab.folder_path}"
end
