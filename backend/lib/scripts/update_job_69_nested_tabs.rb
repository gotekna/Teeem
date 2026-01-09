# Update JobDocumentationTabs for Job 69 with nested structure
# Main tabs (parent) with subtabs (children)

job = Job.find(69)
puts "=== UPDATING DOCUMENTATION TABS FOR JOB 69 (NESTED) ==="
puts "Job: #{job.title}"
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

# Helper to create parent tab with children
def create_tab_with_children(job, parent_attrs, children_attrs)
  parent = job.job_documentation_tabs.create!(parent_attrs)
  puts "Created parent: #{parent.name}"

  children_attrs.each_with_index do |child_attrs, idx|
    child = job.job_documentation_tabs.create!(
      child_attrs.merge(parent_id: parent.id, sequence_order: idx + 1)
    )
    puts "  Created child: #{child.name} -> #{child.folder_path}"
  end

  parent
end

# 1. Sales (no children)
job.job_documentation_tabs.create!(
  name: "Sales",
  sequence_order: 1,
  folder_path: "01 Sales"
)
puts "Created: Sales (no children)"

# 2. PreCon (with children)
create_tab_with_children(job,
  { name: "PreCon", sequence_order: 2, folder_path: "02 PreCon" },
  [
    { name: "Revit-DWG", folder_path: "02 PreCon/Revit-DWG" },
    { name: "Land Info", folder_path: "02 PreCon/Land Info" },
    { name: "Estimation", folder_path: "02 PreCon/Estimation" },
    { name: "Contracts", folder_path: "02 PreCon/Contracts" },
    { name: "Colour Selection", folder_path: "02 PreCon/Colour Selection" }
  ]
)

# 3. Certification (with children)
create_tab_with_children(job,
  { name: "Certification", sequence_order: 3, folder_path: "03 Certification" },
  [
    { name: "Council", folder_path: "03 Certification/Council" },
    { name: "NDIS", folder_path: "03 Certification/NDIS" },
    { name: "Plumbing", folder_path: "03 Certification/Plumbing" },
    { name: "Energy Efficiency", folder_path: "03 Certification/Energy Efficiency" },
    { name: "Final Approval", folder_path: "03 Certification/Final Approval" }
  ]
)

# 4. Plans (with children)
create_tab_with_children(job,
  { name: "Plans", sequence_order: 4, folder_path: "04 Plans" },
  [
    { name: "Sales Plans", folder_path: "04 Plans/Sales Plans" },
    { name: "Certified Plans", folder_path: "04 Plans/Certified Plans" },
    { name: "Working Drawings", folder_path: "04 Plans/Working Drawings" }
  ]
)

# 5. Active (renamed from Site, with children: Site, Purchase Order, Accounts)
create_tab_with_children(job,
  { name: "Active", sequence_order: 5, folder_path: "05 Site" },
  [
    { name: "Site", folder_path: "05 Site" },
    { name: "Purchase Order", folder_path: "05 Site/Purchase Order" },
    { name: "Accounts", folder_path: "05 Site/Accounts" }
  ]
)

# 6. Photo (with children)
create_tab_with_children(job,
  { name: "Photo", sequence_order: 6, folder_path: "06 Photo" },
  [
    { name: "Site", folder_path: "06 Photo/01 SITE" },
    { name: "Slab", folder_path: "06 Photo/02 SLAB" },
    { name: "Frame", folder_path: "06 Photo/03 FRAME" },
    { name: "Enclosed", folder_path: "06 Photo/04 ENCLOSED" },
    { name: "Fixing", folder_path: "06 Photo/05 FIXING" },
    { name: "PC", folder_path: "06 Photo/06 Practical Completion" },
    { name: "Supervisor", folder_path: "06 Photo/07 Supervisor Photos" }
  ]
)

# 7. Final Approval (with children)
create_tab_with_children(job,
  { name: "Final Approval", sequence_order: 7, folder_path: "07 Final Approval" },
  [
    { name: "Final Docs", folder_path: "07 Final Approval/Final Docs Required" },
    { name: "Form 21", folder_path: "07 Final Approval/Form 21" },
    { name: "NDIS", folder_path: "07 Final Approval/NDIS" },
    { name: "Plumbing", folder_path: "07 Final Approval/Plumbing" }
  ]
)

puts ""
puts "=== UPDATED TABS (NESTED STRUCTURE) ==="
job.job_documentation_tabs.reload.root_tabs.ordered.each do |parent|
  puts "#{parent.sequence_order}. #{parent.name} -> #{parent.folder_path}"
  parent.children.ordered.each do |child|
    puts "   #{child.sequence_order}. #{child.name} -> #{child.folder_path}"
  end
end

puts ""
puts "Total tabs: #{job.job_documentation_tabs.count}"
puts "Parent tabs: #{job.job_documentation_tabs.root_tabs.count}"
puts "Child tabs: #{job.job_documentation_tabs.where.not(parent_id: nil).count}"
