# Add Photo children to Job 69 (and Final Approval children)

job = Job.find(69)
puts "Job: #{job.title}"

# Find Photo tab
photo = job.job_documentation_tabs.find_by(name: "Photo")
puts "Photo tab: #{photo.id}, children: #{photo.children.count}"

if photo.children.empty?
  puts "Adding Photo children..."
  children = [
    { name: "Site Photo", folder_path: "06 Photo/01 SITE" },
    { name: "Slab Photo", folder_path: "06 Photo/02 SLAB" },
    { name: "Frame Photo", folder_path: "06 Photo/03 FRAME" },
    { name: "Enclosed Photo", folder_path: "06 Photo/04 ENCLOSED" },
    { name: "Fixing Photo", folder_path: "06 Photo/05 FIXING" },
    { name: "PC Photo", folder_path: "06 Photo/06 Practical Completion" },
    { name: "Supervisor Photo", folder_path: "06 Photo/07 Supervisor Photos" }
  ]
  children.each_with_index do |c, i|
    job.job_documentation_tabs.create!(c.merge(parent_id: photo.id, sequence_order: i + 1))
    puts "  Created: #{c[:name]}"
  end
else
  puts "Photo already has children"
end

# Add Final Approval tab and children
final = job.job_documentation_tabs.find_by(name: "Final Approval")
if final
  puts "\nFinal Approval tab: #{final.id}, children: #{final.children.count}"
  puts "Final Approval already exists as child of Certification"
else
  # Create Final Approval as a parent tab
  final = job.job_documentation_tabs.create!(
    name: "Final Approval",
    sequence_order: 7,
    folder_path: "07 Final Approval"
  )
  puts "\nCreated Final Approval parent tab: #{final.id}"

  children = [
    { name: "Final Docs", folder_path: "07 Final Approval/Final Docs Required" },
    { name: "Form 21", folder_path: "07 Final Approval/Form 21" },
    { name: "NDIS Final", folder_path: "07 Final Approval/NDIS" },
    { name: "Plumbing Final", folder_path: "07 Final Approval/Plumbing" }
  ]
  children.each_with_index do |c, i|
    job.job_documentation_tabs.create!(c.merge(parent_id: final.id, sequence_order: i + 1))
    puts "  Created: #{c[:name]}"
  end
end

puts "\n=== Final Tab Structure ==="
job.job_documentation_tabs.reload.root_tabs.ordered.each do |parent|
  puts "#{parent.sequence_order}. #{parent.name} (#{parent.children.count} children)"
  parent.children.ordered.each do |child|
    puts "   - #{child.name}"
  end
end

puts "\nTotal tabs: #{job.job_documentation_tabs.count}"
