# Seed default SM Hold Reasons for SM Gantt
#
# See GANTT_ARCHITECTURE_PLAN.md Section 3
#

puts "Creating default SM Hold Reasons..."

hold_reasons = [
  {
    name: 'Awaiting Client Decision',
    description: 'Job on hold pending client decision or approval',
    color: '#F59E0B', # Amber
    icon: 'clock',
    is_active: true,
    sequence_order: 1,
    requires_notes: false,
    auto_notify_days: 3
  },
  {
    name: 'Awaiting Council Approval',
    description: 'Waiting for council or regulatory approval',
    color: '#8B5CF6', # Purple
    icon: 'building-office',
    is_active: true,
    sequence_order: 2,
    requires_notes: false,
    auto_notify_days: 7
  },
  {
    name: 'Weather Delay',
    description: 'Construction halted due to weather conditions',
    color: '#3B82F6', # Blue
    icon: 'cloud',
    is_active: true,
    sequence_order: 3,
    requires_notes: false,
    auto_notify_days: nil
  },
  {
    name: 'Material Shortage',
    description: 'Waiting for materials or supplies',
    color: '#EF4444', # Red
    icon: 'cube',
    is_active: true,
    sequence_order: 4,
    requires_notes: true,
    auto_notify_days: 5
  },
  {
    name: 'Subcontractor Unavailable',
    description: 'Scheduled subcontractor not available',
    color: '#F97316', # Orange
    icon: 'user-group',
    is_active: true,
    sequence_order: 5,
    requires_notes: true,
    auto_notify_days: 2
  },
  {
    name: 'Design Changes',
    description: 'Hold for design modifications or variations',
    color: '#EC4899', # Pink
    icon: 'pencil-square',
    is_active: true,
    sequence_order: 6,
    requires_notes: true,
    auto_notify_days: 5
  },
  {
    name: 'Site Access Issue',
    description: 'Cannot access site due to various reasons',
    color: '#6366F1', # Indigo
    icon: 'lock-closed',
    is_active: true,
    sequence_order: 7,
    requires_notes: true,
    auto_notify_days: 1
  },
  {
    name: 'Client Financial Hold',
    description: 'Awaiting payment or financial clearance',
    color: '#10B981', # Emerald
    icon: 'currency-dollar',
    is_active: true,
    sequence_order: 8,
    requires_notes: false,
    auto_notify_days: 7
  },
  {
    name: 'Inspection Required',
    description: 'Waiting for mandatory inspection',
    color: '#14B8A6', # Teal
    icon: 'clipboard-document-check',
    is_active: true,
    sequence_order: 9,
    requires_notes: false,
    auto_notify_days: 2
  },
  {
    name: 'Other',
    description: 'Other reason not listed above',
    color: '#6B7280', # Gray
    icon: 'ellipsis-horizontal',
    is_active: true,
    sequence_order: 99,
    requires_notes: true,
    auto_notify_days: nil
  }
]

hold_reasons.each do |reason_data|
  reason = SmHoldReason.find_or_initialize_by(name: reason_data[:name])
  reason.assign_attributes(reason_data)

  if reason.save
    puts "  ✅ #{reason.name}"
  else
    puts "  ❌ Failed to create #{reason_data[:name]}: #{reason.errors.full_messages.join(', ')}"
  end
end

puts "✅ SM Hold Reasons seeded: #{SmHoldReason.count} reasons"