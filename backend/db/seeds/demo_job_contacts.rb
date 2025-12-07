# Demo seed file for testing job contacts with relationships
# Run with: bin/rails runner db/seeds/demo_job_contacts.rb

puts "Creating demo contacts, jobs, and relationships..."

# Helper to create contacts with full data
def create_contact(attrs)
  contact = Contact.find_or_initialize_by(email: attrs[:email])
  contact.assign_attributes(attrs)
  contact.save!
  contact
end

# Create some companies (using display_name for display, company_name_or_trust for legal name)
acme_corp = create_contact(
  display_name: "ACME Construction Pty Ltd",
  company_name_or_trust: "ACME Construction Pty Ltd",
  email: "info@acmeconstruction.com.au",
  mobile_phone: "0412 345 678",
  office_phone: "07 3333 4444",
  entity_type: "company",
  contact_types: [ "customer" ],
  is_active: true
)
puts "  Created company: #{acme_corp.display_name}"

sunshine_builders = create_contact(
  display_name: "Sunshine Builders",
  company_name_or_trust: "Sunshine Builders Pty Ltd",
  email: "contact@sunshinebuilders.com.au",
  mobile_phone: "0423 456 789",
  office_phone: "07 3222 5555",
  entity_type: "company",
  contact_types: [ "customer" ],
  is_active: true
)
puts "  Created company: #{sunshine_builders.display_name}"

westpac_bank = create_contact(
  display_name: "Westpac Banking Corporation",
  company_name_or_trust: "Westpac Banking Corporation",
  email: "loans@westpac.com.au",
  office_phone: "13 20 32",
  entity_type: "company",
  contact_types: [ "customer" ],
  is_active: true
)
puts "  Created company: #{westpac_bank.display_name}"

# Create some people
john_smith = create_contact(
  first_name: "John",
  last_name: "Smith",
  display_name: "John Smith",
  email: "john.smith@acmeconstruction.com.au",
  mobile_phone: "0412 111 222",
  entity_type: "person",
  contact_types: [ "customer" ],
  is_active: true
)
puts "  Created person: #{john_smith.display_name}"

sarah_jones = create_contact(
  first_name: "Sarah",
  last_name: "Jones",
  display_name: "Sarah Jones",
  email: "sarah.jones@email.com",
  mobile_phone: "0423 222 333",
  entity_type: "person",
  contact_types: [ "customer" ],
  is_active: true
)
puts "  Created person: #{sarah_jones.display_name}"

mike_wilson = create_contact(
  first_name: "Mike",
  last_name: "Wilson",
  display_name: "Mike Wilson",
  email: "mike.wilson@sunshinebuilders.com.au",
  mobile_phone: "0434 333 444",
  entity_type: "person",
  contact_types: [ "customer" ],
  is_active: true
)
puts "  Created person: #{mike_wilson.display_name}"

emma_broker = create_contact(
  first_name: "Emma",
  last_name: "Thompson",
  display_name: "Emma Thompson",
  email: "emma@mortgagebrokers.com.au",
  mobile_phone: "0445 444 555",
  entity_type: "person",
  contact_types: [ "sales" ],
  primary_role: "Mortgage Broker",
  is_active: true
)
puts "  Created person: #{emma_broker.display_name}"

bank_manager = create_contact(
  first_name: "David",
  last_name: "Chen",
  display_name: "David Chen",
  email: "david.chen@westpac.com.au",
  mobile_phone: "0456 555 666",
  entity_type: "person",
  contact_types: [ "customer" ],
  primary_role: "Bank Manager",
  is_active: true
)
puts "  Created person: #{bank_manager.display_name}"

# Create relationships
puts "\nCreating relationships..."

# John Smith is an employee of ACME Corp
ContactRelationship.find_or_create_by!(
  source_contact: john_smith,
  related_contact: acme_corp,
  relationship_type: "employee_of"
) do |rel|
  rel.is_active = true
  rel.role_in_relationship = "Managing Director"
end
puts "  #{john_smith.display_name} is employee_of #{acme_corp.display_name}"

# Sarah Jones is a director of ACME Corp
ContactRelationship.find_or_create_by!(
  source_contact: sarah_jones,
  related_contact: acme_corp,
  relationship_type: "director_of"
) do |rel|
  rel.is_active = true
  rel.role_in_relationship = "Director"
end
puts "  #{sarah_jones.display_name} is director_of #{acme_corp.display_name}"

# Mike Wilson is an employee of Sunshine Builders
ContactRelationship.find_or_create_by!(
  source_contact: mike_wilson,
  related_contact: sunshine_builders,
  relationship_type: "employee_of"
) do |rel|
  rel.is_active = true
  rel.role_in_relationship = "Project Manager"
end
puts "  #{mike_wilson.display_name} is employee_of #{sunshine_builders.display_name}"

# Sarah and John are family members
ContactRelationship.find_or_create_by!(
  source_contact: sarah_jones,
  related_contact: john_smith,
  relationship_type: "family_member"
) do |rel|
  rel.is_active = true
  rel.notes = "Spouse"
end
puts "  #{sarah_jones.display_name} is family_member of #{john_smith.display_name}"

# David Chen works at Westpac
ContactRelationship.find_or_create_by!(
  source_contact: bank_manager,
  related_contact: westpac_bank,
  relationship_type: "employee_of"
) do |rel|
  rel.is_active = true
  rel.role_in_relationship = "Branch Manager"
end
puts "  #{bank_manager.display_name} is employee_of #{westpac_bank.display_name}"

# Create a demo job
puts "\nCreating demo job..."

# Get first user for internal team
user = User.first
unless user
  puts "  Warning: No users found. Creating a demo user..."
  user = User.create!(
    name: "Demo User",
    email: "demo@teeem.com.au",
    password: "password123",
    password_confirmation: "password123"
  )
end

job = Job.find_or_initialize_by(title: "Demo Project - Client Contacts Test")
job.assign_attributes(
  status: "active",
  ted_number: "DEMO-001"
)
job.save!
puts "  Created job: #{job.title} (ID: #{job.id})"

# Clear existing job contacts for this job
job.job_contacts.destroy_all

# Add contacts to the job with various roles
puts "\nAdding contacts to job..."

# Primary client - John Smith
JobContact.create!(
  job: job,
  contact: john_smith,
  role: "client",
  primary: true
)
puts "  Added #{john_smith.display_name} as Client (Primary)"

# Secondary client - ACME Corp
JobContact.create!(
  job: job,
  contact: acme_corp,
  role: "client",
  primary: false
)
puts "  Added #{acme_corp.display_name} as Client"

# Client Representative - Sarah Jones
JobContact.create!(
  job: job,
  contact: sarah_jones,
  role: "client_representative",
  primary: false
)
puts "  Added #{sarah_jones.display_name} as Client Representative"

# Client Broker - Emma Thompson
JobContact.create!(
  job: job,
  contact: emma_broker,
  role: "client_broker",
  primary: false
)
puts "  Added #{emma_broker.display_name} as Client Broker"

# Client Bank - Westpac
JobContact.create!(
  job: job,
  contact: westpac_bank,
  role: "client_bank",
  primary: false
)
puts "  Added #{westpac_bank.display_name} as Client Bank"

# Add internal team member if user exists
if user
  JobContact.create!(
    job: job,
    user: user,
    role: "supervisor",
    primary: false
  )
  puts "  Added #{user.name || user.email} as Supervisor"
end

puts "\n=========================================="
puts "Demo data created successfully!"
puts "=========================================="
puts "\nSummary:"
puts "  - Job ID: #{job.id}"
puts "  - Job Title: #{job.title}"
puts "  - Total Job Contacts: #{job.job_contacts.count}"
puts "\nContacts with relationships:"
job.job_contacts.includes(contact: :outgoing_relationships).each do |jc|
  next unless jc.contact
  rel_count = jc.contact.outgoing_relationships.count
  puts "  - #{jc.contact.display_name} (#{jc.role}): #{rel_count} relationship(s)"
end
puts "\nVisit /jobs/#{job.id} to see the People tab with relationships!"
