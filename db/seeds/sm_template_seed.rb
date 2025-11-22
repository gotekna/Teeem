# Seed default SM Template for SM Gantt

puts "Creating default SM Template..."

# Create default SM Template
template = SmTemplate.find_or_create_by(name: 'Default SM Schedule') do |t|
  t.description = 'Standard residential construction schedule template'
  t.is_default = true
end

# Only seed rows if template is empty
if template.sm_template_rows.count == 0
  rows = [
    { task_number: 1, name: 'Site Preparation', duration_days: 2, trade: 'earthworks', stage: 'pre-construction' },
    { task_number: 2, name: 'Set Out', duration_days: 1, trade: 'surveyor', stage: 'pre-construction', predecessor_ids: [{ 'id' => 1, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 3, name: 'Excavation', duration_days: 3, trade: 'earthworks', stage: 'slab', predecessor_ids: [{ 'id' => 2, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 4, name: 'Plumbing Rough-in (Slab)', duration_days: 2, trade: 'plumber', stage: 'slab', predecessor_ids: [{ 'id' => 3, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 5, name: 'Slab Pour', duration_days: 1, trade: 'concreter', stage: 'slab', predecessor_ids: [{ 'id' => 4, 'type' => 'FS', 'lag' => 0 }], require_photo: true },
    { task_number: 6, name: 'Frame - Walls', duration_days: 5, trade: 'carpenter', stage: 'frame', predecessor_ids: [{ 'id' => 5, 'type' => 'FS', 'lag' => 3 }] },
    { task_number: 7, name: 'Frame - Roof', duration_days: 3, trade: 'carpenter', stage: 'frame', predecessor_ids: [{ 'id' => 6, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 8, name: 'Roof Tiles/Sheet', duration_days: 2, trade: 'roofer', stage: 'lockup', predecessor_ids: [{ 'id' => 7, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 9, name: 'Windows & External Doors', duration_days: 2, trade: 'joiner', stage: 'lockup', predecessor_ids: [{ 'id' => 8, 'type' => 'SS', 'lag' => 1 }] },
    { task_number: 10, name: 'Electrical Rough-in', duration_days: 3, trade: 'electrician', stage: 'fixing', predecessor_ids: [{ 'id' => 9, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 11, name: 'Plumbing Rough-in', duration_days: 3, trade: 'plumber', stage: 'fixing', predecessor_ids: [{ 'id' => 9, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 12, name: 'Insulation', duration_days: 2, trade: 'insulation', stage: 'fixing', predecessor_ids: [{ 'id' => 10, 'type' => 'FS', 'lag' => 0 }, { 'id' => 11, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 13, name: 'Plaster - Cornice & Ceiling', duration_days: 4, trade: 'plasterer', stage: 'fixing', predecessor_ids: [{ 'id' => 12, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 14, name: 'Plaster - Walls', duration_days: 3, trade: 'plasterer', stage: 'fixing', predecessor_ids: [{ 'id' => 13, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 15, name: 'Tiling', duration_days: 4, trade: 'tiler', stage: 'finishing', predecessor_ids: [{ 'id' => 14, 'type' => 'FS', 'lag' => 1 }] },
    { task_number: 16, name: 'Paint - Undercoat', duration_days: 2, trade: 'painter', stage: 'finishing', predecessor_ids: [{ 'id' => 14, 'type' => 'FS', 'lag' => 1 }] },
    { task_number: 17, name: 'Joinery Install', duration_days: 3, trade: 'joiner', stage: 'finishing', predecessor_ids: [{ 'id' => 16, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 18, name: 'Paint - Final Coat', duration_days: 3, trade: 'painter', stage: 'finishing', predecessor_ids: [{ 'id' => 17, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 19, name: 'Final Fix - Electrical', duration_days: 2, trade: 'electrician', stage: 'finishing', predecessor_ids: [{ 'id' => 18, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 20, name: 'Final Fix - Plumbing', duration_days: 2, trade: 'plumber', stage: 'finishing', predecessor_ids: [{ 'id' => 18, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 21, name: 'Final Clean', duration_days: 1, trade: 'cleaner', stage: 'handover', predecessor_ids: [{ 'id' => 19, 'type' => 'FS', 'lag' => 0 }, { 'id' => 20, 'type' => 'FS', 'lag' => 0 }] },
    { task_number: 22, name: 'Practical Completion Inspection', duration_days: 1, trade: 'supervisor', stage: 'handover', predecessor_ids: [{ 'id' => 21, 'type' => 'FS', 'lag' => 0 }], pass_fail_enabled: true }
  ]

  rows.each_with_index do |row_data, idx|
    template.sm_template_rows.create!(row_data.merge(sequence_order: idx + 1))
  end

  puts "Created #{template.sm_template_rows.count} template rows"
else
  puts "Template already has #{template.sm_template_rows.count} rows, skipping seed"
end

puts "Done! SM Template ID: #{template.id}"
