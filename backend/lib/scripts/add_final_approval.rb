# Add Final Approval parent tab with children to Job 69

job = Job.find(69)

# Check if Final Approval parent already exists
existing = job.job_documentation_tabs.where(name: "Final Approval", parent_id: nil).first
if existing
  puts "Final Approval parent already exists: #{existing.id}"
else
  # Add Final Approval as a parent tab (sequence 7)
  final = job.job_documentation_tabs.create!(
    name: "Final Approval",
    sequence_order: 7,
    folder_path: "07 Final Approval",
    is_active: true
  )
  puts "Created parent: Final Approval (#{final.id})"

  # Add children
  children = [
    { name: "Final Docs", folder_path: "07 Final Approval/Final Docs Required" },
    { name: "Form 21", folder_path: "07 Final Approval/Form 21" },
    { name: "NDIS Final", folder_path: "07 Final Approval/NDIS" },
    { name: "Plumbing Final", folder_path: "07 Final Approval/Plumbing" }
  ]
  children.each_with_index do |c, i|
    child = job.job_documentation_tabs.create!(c.merge(parent_id: final.id, sequence_order: i + 1, is_active: true))
    puts "  Created: #{child.name}"
  end
end

puts "\n=== CURRENT STRUCTURE ==="
job.job_documentation_tabs.reload.root_tabs.active.ordered.includes(:children).each do |t|
  puts "#{t.sequence_order}. #{t.name} (#{t.children.count} children)"
  t.children.ordered.each do |c|
    puts "   - #{c.name}"
  end
end
