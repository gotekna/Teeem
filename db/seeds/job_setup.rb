# Seed Job Types
job_types = [
  'House',
  'Duplex',
  'Townhouse',
  'Micro Apartment',
  'Co Living',
  'NDIS House',
  'NDIS Units',
  'Kitchen',
  'House Renovation',
  'Unit Renovation'
]

job_types.each_with_index do |name, index|
  JobType.find_or_create_by!(name: name) do |jt|
    jt.position = index
    jt.is_active = true
  end
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
