# Update JobDocumentationTabs to match folder template structure
# Create a flat list of tabs matching all folders (including subfolders)
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

# New tabs matching folder structure - flat list with subfolders as separate tabs
# Using the folder template structure
new_tabs = [
  # 01 Sales
  { name: "Sales", sequence_order: 1, folder_path: "01 Sales" },

  # 02 PreCon and subfolders
  { name: "Revit-DWG", sequence_order: 2, folder_path: "02 PreCon/Revit-DWG" },
  { name: "Land Info", sequence_order: 3, folder_path: "02 PreCon/Land Info" },
  { name: "Estimation", sequence_order: 4, folder_path: "02 PreCon/Estimation" },
  { name: "Contracts", sequence_order: 5, folder_path: "02 PreCon/Contracts" },
  { name: "Colour Selection", sequence_order: 6, folder_path: "02 PreCon/Colour Selection" },

  # 03 Certification and subfolders
  { name: "Council", sequence_order: 7, folder_path: "03 Certification/Council" },
  { name: "NDIS", sequence_order: 8, folder_path: "03 Certification/NDIS" },
  { name: "Plumbing", sequence_order: 9, folder_path: "03 Certification/Plumbing" },
  { name: "Energy Efficiency", sequence_order: 10, folder_path: "03 Certification/Energy Efficiency" },
  { name: "Certification Final", sequence_order: 11, folder_path: "03 Certification/Final Approval" },

  # 04 Plans and subfolders
  { name: "Sales Plans", sequence_order: 12, folder_path: "04 Plans/Sales Plans" },
  { name: "Certified Plans", sequence_order: 13, folder_path: "04 Plans/Certified Plans" },
  { name: "Working Drawings", sequence_order: 14, folder_path: "04 Plans/Working Drawings" },

  # 05 Site
  { name: "Site", sequence_order: 15, folder_path: "05 Site" },

  # 06 Photo and subfolders
  { name: "Site Photos", sequence_order: 16, folder_path: "06 Photo/01 SITE" },
  { name: "Slab Photos", sequence_order: 17, folder_path: "06 Photo/02 SLAB" },
  { name: "Frame Photos", sequence_order: 18, folder_path: "06 Photo/03 FRAME" },
  { name: "Enclosed Photos", sequence_order: 19, folder_path: "06 Photo/04 ENCLOSED" },
  { name: "Fixing Photos", sequence_order: 20, folder_path: "06 Photo/05 FIXING" },
  { name: "PC Photos", sequence_order: 21, folder_path: "06 Photo/06 Practical Completion" },
  { name: "Supervisor Photos", sequence_order: 22, folder_path: "06 Photo/07 Supervisor Photos" },

  # 07 Final Approval and subfolders
  { name: "Final Docs", sequence_order: 23, folder_path: "07 Final Approval/Final Docs Required" },
  { name: "Form 21", sequence_order: 24, folder_path: "07 Final Approval/Form 21" },
  { name: "Final NDIS", sequence_order: 25, folder_path: "07 Final Approval/NDIS" },
  { name: "Final Plumbing", sequence_order: 26, folder_path: "07 Final Approval/Plumbing" }
]

new_tabs.each do |attrs|
  tab = job.job_documentation_tabs.create!(attrs)
  puts "Created: #{tab.name} -> #{tab.folder_path}"
end

puts ""
puts "=== UPDATED TABS (#{job.job_documentation_tabs.count} total) ==="
job.job_documentation_tabs.reload.order(:sequence_order).each do |tab|
  puts "  #{tab.sequence_order.to_s.rjust(2)}. #{tab.name.ljust(20)} -> #{tab.folder_path}"
end
