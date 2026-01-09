# Rename Active to Site and update child to avoid duplicate name

job = Job.find(69)
active_tab = job.job_documentation_tabs.where(name: "Active", parent_id: nil).first
if active_tab
  # First rename the child "Site" to "Site Docs" to avoid unique constraint
  site_child = active_tab.children.find_by(name: "Site")
  if site_child
    site_child.update!(name: "Site Docs")
    puts "Renamed child Site to Site Docs"
  end

  # Now rename the parent Active to Site
  active_tab.update!(name: "Site")
  puts "Renamed Active to Site"
else
  puts "Active tab not found"
end

puts "\n=== UPDATED STRUCTURE ==="
job.job_documentation_tabs.reload.root_tabs.active.ordered.includes(:children).each do |t|
  puts "#{t.sequence_order}. #{t.name} (#{t.children.count} children)"
  t.children.ordered.each do |c|
    puts "   - #{c.name}"
  end
end
