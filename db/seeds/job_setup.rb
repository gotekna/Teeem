# Seed Job Types with icons
# Icons use Heroicons names (outline style)
job_types = [
  { name: 'House', icon: 'HomeIcon' },
  { name: 'Duplex', icon: 'BuildingOfficeIcon' },
  { name: 'Townhouse', icon: 'BuildingOfficeIcon' },
  { name: 'Micro Apartment', icon: 'BuildingOfficeIcon' },
  { name: 'Co Living', icon: 'UserGroupIcon' },
  { name: 'NDIS House', icon: 'HomeIcon' },
  { name: 'NDIS Units', icon: 'BuildingOfficeIcon' },
  { name: 'Kitchen', icon: 'HomeModernIcon' },
  { name: 'House Renovation', icon: 'WrenchIcon' },
  { name: 'Unit Renovation', icon: 'WrenchIcon' }
]

job_types.each_with_index do |type_data, index|
  jt = JobType.find_or_initialize_by(name: type_data[:name])
  jt.position = index
  jt.is_active = true
  jt.icon = type_data[:icon]
  jt.save!
end
puts "Created #{JobType.count} job types"

# Seed Job Statuses
job_statuses = [
  { name: 'Enquiry', color: 'gray' },
  { name: 'Land', color: 'yellow' },
  { name: 'Drafting Req', color: 'orange' },
  { name: 'Drafting Completed', color: 'blue' },
  { name: 'Contract Signed', color: 'purple' },
  { name: 'Certification', color: 'indigo' },
  { name: 'Active Job', color: 'green' },
  { name: 'Handover', color: 'teal' },
  { name: 'Archived', color: 'slate' }
]

job_statuses.each_with_index do |data, index|
  JobStatus.find_or_create_by!(name: data[:name]) do |js|
    js.position = index
    js.is_active = true
    js.color = data[:color]
  end
end
puts "Created #{JobStatus.count} job statuses"
