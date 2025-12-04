# Update JobDocumentationTabs to match the 7 main folders
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

# New tabs - 7 main folders
new_tabs = [
  { name: "Sales", sequence_order: 1, folder_path: "01 Sales" },
  { name: "PreCon", sequence_order: 2, folder_path: "02 PreCon" },
  { name: "Certification", sequence_order: 3, folder_path: "03 Certification" },
  { name: "Plans", sequence_order: 4, folder_path: "04 Plans" },
  { name: "Site", sequence_order: 5, folder_path: "05 Site" },
  { name: "Photo", sequence_order: 6, folder_path: "06 Photo" },
  { name: "Final Approval", sequence_order: 7, folder_path: "07 Final Approval" }
]

new_tabs.each do |attrs|
  tab = job.job_documentation_tabs.create!(attrs)
  puts "Created: #{tab.name} -> #{tab.folder_path}"
end

puts ""
puts "=== UPDATED TABS ==="
job.job_documentation_tabs.reload.order(:sequence_order).each do |tab|
  puts "  #{tab.sequence_order}. #{tab.name} -> #{tab.folder_path}"
end

puts ""
puts "NOTE: To support subtabs (e.g., PreCon -> Revit-DWG, Land Info, etc.),"
puts "the JobDocumentationTab model needs a parent_id column and the UI needs updating."
