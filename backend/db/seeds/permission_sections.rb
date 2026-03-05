# frozen_string_literal: true

# SSoT: Seed all configurable permission sections
# Each section defines what permission keys are available and at what levels

puts "Seeding permission sections..."

SECTIONS = [
  # Calendar
  { key: "calendar",        section: "calendar",   sub_feature: nil,          display_name: "Calendar",             description: "View and manage calendar",          position: 0, is_section_header: true,  available_levels: [0, 2, 3] },
  { key: "calendar.events", section: "calendar",   sub_feature: "events",     display_name: "Create/Edit Events",   description: "Create and edit calendar events",   position: 1, is_section_header: false, available_levels: [0, 3] },

  # DocSort
  { key: "docsort",         section: "docsort",    sub_feature: nil,          display_name: "DocSort",              description: "Document sorting and management",   position: 0, is_section_header: true,  available_levels: [0, 2, 3, 4] },

  # Contacts
  { key: "contacts",        section: "contacts",   sub_feature: nil,          display_name: "Contacts",             description: "Contact records",                   position: 0, is_section_header: true,  available_levels: [0, 1, 2, 3, 4] },
  { key: "contacts.create", section: "contacts",   sub_feature: "create",     display_name: "Create Contacts",      description: "Create new contacts",               position: 1, is_section_header: false, available_levels: [0, 3] },
  { key: "contacts.delete", section: "contacts",   sub_feature: "delete",     display_name: "Delete Contacts",      description: "Delete contacts",                   position: 2, is_section_header: false, available_levels: [0, 4] },

  # Leads
  { key: "leads",           section: "leads",      sub_feature: nil,          display_name: "Leads",                description: "Lead records",                      position: 0, is_section_header: true,  available_levels: [0, 1, 2, 3, 4] },
  { key: "leads.convert",   section: "leads",      sub_feature: "convert",    display_name: "Convert Leads",        description: "Convert leads to contacts/jobs",    position: 1, is_section_header: false, available_levels: [0, 3] },

  # Jobs
  { key: "jobs",            section: "jobs",       sub_feature: nil,          display_name: "Jobs",                 description: "Job records",                       position: 0, is_section_header: true,  available_levels: [0, 1, 2, 3, 4] },
  { key: "jobs.create",     section: "jobs",       sub_feature: "create",     display_name: "Create Jobs",          description: "Create new jobs",                   position: 1, is_section_header: false, available_levels: [0, 3] },
  { key: "jobs.delete",     section: "jobs",       sub_feature: "delete",     display_name: "Delete Jobs",          description: "Delete jobs",                       position: 2, is_section_header: false, available_levels: [0, 4] },
  { key: "jobs.team",       section: "jobs",       sub_feature: "team",       display_name: "Manage Job Team",      description: "Manage job team assignments",        position: 3, is_section_header: false, available_levels: [0, 3] },
  { key: "jobs.gantt",      section: "jobs",       sub_feature: "gantt",      display_name: "View Gantt Charts",    description: "View Gantt charts",                 position: 4, is_section_header: false, available_levels: [0, 2] },

  # Finance
  { key: "finance",          section: "finance",   sub_feature: nil,          display_name: "Finance",              description: "Financial data",                    position: 0, is_section_header: true,  available_levels: [0, 1, 2, 3, 4] },
  { key: "finance.invoices", section: "finance",   sub_feature: "invoices",   display_name: "Create Invoices",      description: "Create and manage invoices",        position: 1, is_section_header: false, available_levels: [0, 3] },
  { key: "finance.approve",  section: "finance",   sub_feature: "approve",    display_name: "Approve Payments",     description: "Approve payment requests",          position: 2, is_section_header: false, available_levels: [0, 4] },
  { key: "finance.export",   section: "finance",   sub_feature: "export",     display_name: "Export Financial Data", description: "Export financial reports",           position: 3, is_section_header: false, available_levels: [0, 3] },

  # Meetings
  { key: "meetings",         section: "meetings",  sub_feature: nil,          display_name: "Meetings",             description: "Meeting records",                   position: 0, is_section_header: true,  available_levels: [0, 2, 3] },

  # Warehouse
  { key: "warehouse",         section: "warehouse",  sub_feature: nil,        display_name: "Warehouse",            description: "File warehouse",                    position: 0, is_section_header: true,  available_levels: [0, 2, 3, 4] },
  { key: "warehouse.upload",  section: "warehouse",  sub_feature: "upload",   display_name: "Upload Documents",     description: "Upload documents to warehouse",     position: 1, is_section_header: false, available_levels: [0, 3] },
  { key: "warehouse.delete",  section: "warehouse",  sub_feature: "delete",   display_name: "Delete Documents",     description: "Delete documents from warehouse",   position: 2, is_section_header: false, available_levels: [0, 4] },
  { key: "warehouse.folders", section: "warehouse",  sub_feature: "folders",  display_name: "Manage Folders",       description: "Manage folder structure",            position: 3, is_section_header: false, available_levels: [0, 4] },

  # Corporate
  { key: "corporate",            section: "corporate",  sub_feature: nil,         display_name: "Corporate",            description: "Corporate data",                    position: 0, is_section_header: true,  available_levels: [0, 2, 3, 4] },
  { key: "corporate.companies",  section: "corporate",  sub_feature: "companies", display_name: "Edit Companies",       description: "Edit company records",              position: 1, is_section_header: false, available_levels: [0, 3] },
  { key: "corporate.groups",     section: "corporate",  sub_feature: "groups",    display_name: "Manage Groups",        description: "Manage corporate groups",           position: 2, is_section_header: false, available_levels: [0, 4] },
  { key: "corporate.cases",      section: "corporate",  sub_feature: "cases",     display_name: "Cases / Legal",        description: "Case and legal data",               position: 3, is_section_header: false, available_levels: [0, 2, 3] },

  # Property Management
  { key: "properties",    section: "properties", sub_feature: nil,             display_name: "Property Management",  description: "Property records",                  position: 0, is_section_header: true,  available_levels: [0, 1, 2, 3, 4] },

  # Portal
  { key: "portal",        section: "portal",     sub_feature: nil,             display_name: "Portal",               description: "Portal management",                 position: 0, is_section_header: true,  available_levels: [0, 2, 3, 4] },

  # Settings
  { key: "settings",          section: "settings",  sub_feature: nil,          display_name: "Settings",             description: "Settings access",                   position: 0, is_section_header: true,  available_levels: [0, 2, 3, 4] },
  { key: "settings.users",    section: "settings",  sub_feature: "users",      display_name: "User Management",      description: "Manage users",                      position: 1, is_section_header: false, available_levels: [0, 2, 3, 4] },
  { key: "settings.roles",    section: "settings",  sub_feature: "roles",      display_name: "Role Management",      description: "Manage roles and permissions",       position: 2, is_section_header: false, available_levels: [0, 2, 3] },
  { key: "settings.company",  section: "settings",  sub_feature: "company",    display_name: "Company Settings",     description: "Manage company configuration",      position: 3, is_section_header: false, available_levels: [0, 2, 3] },
  { key: "settings.system",   section: "settings",  sub_feature: "system",     display_name: "System Admin",         description: "System administration",             position: 4, is_section_header: false, available_levels: [0, 4] },

  # Library
  { key: "library",       section: "library",    sub_feature: nil,             display_name: "Library",              description: "Library access",                    position: 0, is_section_header: true,  available_levels: [0, 2, 3] },

  # E-Signature
  { key: "esignature",    section: "esignature",  sub_feature: nil,            display_name: "E-Signature",          description: "E-Signature functionality",          position: 0, is_section_header: true,  available_levels: [0, 2, 3] },
].freeze

SECTIONS.each do |attrs|
  PermissionSection.find_or_create_by!(key: attrs[:key]) do |ps|
    ps.assign_attributes(attrs)
  end
end

puts "Created #{PermissionSection.count} permission sections"

# Seed default permissions for existing roles
# Map from old hardcoded system to new section-level permissions
puts "Seeding default role permissions..."

DEFAULT_ROLE_PERMISSIONS = {
  "admin" => {
    "calendar" => 3, "calendar.events" => 3,
    "docsort" => 4,
    "contacts" => 4, "contacts.create" => 3, "contacts.delete" => 4,
    "leads" => 4, "leads.convert" => 3,
    "jobs" => 4, "jobs.create" => 3, "jobs.delete" => 4, "jobs.team" => 3, "jobs.gantt" => 2,
    "finance" => 4, "finance.invoices" => 3, "finance.approve" => 4, "finance.export" => 3,
    "meetings" => 3,
    "warehouse" => 4, "warehouse.upload" => 3, "warehouse.delete" => 4, "warehouse.folders" => 4,
    "corporate" => 4, "corporate.companies" => 3, "corporate.groups" => 4, "corporate.cases" => 3,
    "properties" => 4,
    "portal" => 4,
    "settings" => 4, "settings.users" => 4, "settings.roles" => 3, "settings.company" => 3, "settings.system" => 4,
    "library" => 3,
    "esignature" => 3
  },
  "product_owner" => {
    "calendar" => 3, "calendar.events" => 3,
    "docsort" => 3,
    "contacts" => 3, "contacts.create" => 3,
    "leads" => 3, "leads.convert" => 3,
    "jobs" => 3, "jobs.create" => 3, "jobs.team" => 3, "jobs.gantt" => 2,
    "finance" => 2,
    "meetings" => 3,
    "warehouse" => 3, "warehouse.upload" => 3,
    "corporate" => 2, "corporate.cases" => 2,
    "properties" => 3,
    "portal" => 3,
    "settings" => 2,
    "library" => 3,
    "esignature" => 3
  },
  "estimator" => {
    "calendar" => 2,
    "contacts" => 2,
    "leads" => 2,
    "jobs" => 3, "jobs.create" => 3, "jobs.gantt" => 2,
    "finance" => 1,
    "meetings" => 2,
    "warehouse" => 2, "warehouse.upload" => 3,
    "library" => 2
  },
  "supervisor" => {
    "calendar" => 2,
    "contacts" => 2,
    "jobs" => 2, "jobs.gantt" => 2,
    "meetings" => 2,
    "warehouse" => 2, "warehouse.upload" => 3,
    "library" => 2
  },
  "builder" => {
    "calendar" => 2,
    "contacts" => 1,
    "jobs" => 1,
    "warehouse" => 2,
    "library" => 2
  },
  "user" => {
    "calendar" => 2,
    "contacts" => 1,
    "jobs" => 1,
    "library" => 2
  }
}.freeze

DEFAULT_ROLE_PERMISSIONS.each do |role_name, perms|
  role = Role.find_by(name: role_name)
  next unless role

  perms.each do |key, level|
    RoleSectionPermission.find_or_create_by!(role: role, permission_key: key) do |rsp|
      rsp.level = level
    end
  end
end

# Set special flags on admin role
admin_role = Role.find_by(name: "admin")
if admin_role
  admin_role.update!(can_view_confidential_fields: true) unless admin_role.can_view_confidential_fields
end

puts "Seeded role permissions for #{DEFAULT_ROLE_PERMISSIONS.keys.length} roles"
puts "Permission sections seed complete!"
