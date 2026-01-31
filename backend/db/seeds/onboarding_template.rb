# frozen_string_literal: true

# Onboarding Template Seed
#
# Creates the SmScheduleMasterTemplate for client onboarding.
# This template is used by OnboardingProvisioningService to create
# SmTasks for tracking onboarding progress.
#
# Run: rails db:seed:onboarding_template
# Or include in main seeds: load Rails.root.join('db/seeds/onboarding_template.rb')

puts "Creating TEEEM Onboarding template..."

# Skip if template already exists
if SmScheduleMasterTemplate.exists?(name: 'TEEEM Onboarding')
  puts "  -> TEEEM Onboarding template already exists, skipping"
  return
end

# Create the template
template = SmScheduleMasterTemplate.create!(
  name: 'TEEEM Onboarding',
  description: 'Self-service onboarding checklist for new TEEEM clients',
  is_default: false,
  is_system: true,
  category: 'internal'
)

puts "  -> Created template: #{template.name}"

# Define the tasks
onboarding_tasks = [
  # Required Group
  {
    name: 'Configure Storage Provider',
    description: 'Set up document storage (Wasabi, S3, or SharePoint)',
    task_type: 'milestone',
    group_name: 'Required Setup',
    position: 1,
    metadata: {
      onboarding_step_key: 'storage_provider',
      category: 'required',
      required: true,
      settings_path: '/settings/connections/provider',
      estimated_minutes: 10
    }
  },
  {
    name: 'Complete Company Information',
    description: 'Add your company name, ABN/ACN, and contact details',
    task_type: 'milestone',
    group_name: 'Required Setup',
    position: 2,
    metadata: {
      onboarding_step_key: 'company_info',
      category: 'required',
      required: true,
      settings_path: '/settings/company/info',
      estimated_minutes: 5
    }
  },
  {
    name: 'Invite First Team Member',
    description: 'Add at least one other user to your team',
    task_type: 'milestone',
    group_name: 'Required Setup',
    position: 3,
    metadata: {
      onboarding_step_key: 'first_user',
      category: 'required',
      required: true,
      settings_path: '/settings/users',
      estimated_minutes: 5
    }
  },

  # Configuration Group
  {
    name: 'Set Up Job Types',
    description: 'Define the types of jobs you manage (e.g., New Build, Renovation)',
    task_type: 'milestone',
    group_name: 'Configuration',
    position: 4,
    metadata: {
      onboarding_step_key: 'job_types',
      category: 'configuration',
      required: false,
      settings_path: '/settings/company/job-setup',
      estimated_minutes: 10
    }
  },
  {
    name: 'Configure Job Statuses & Stages',
    description: 'Define workflow stages for your jobs',
    task_type: 'milestone',
    group_name: 'Configuration',
    position: 5,
    metadata: {
      onboarding_step_key: 'job_statuses',
      category: 'configuration',
      required: false,
      settings_path: '/settings/company/job-setup',
      estimated_minutes: 15
    }
  },
  {
    name: 'Set Up Document Types',
    description: 'Configure document categories for your projects',
    task_type: 'milestone',
    group_name: 'Configuration',
    position: 6,
    metadata: {
      onboarding_step_key: 'document_types',
      category: 'configuration',
      required: false,
      settings_path: '/settings/company/documents',
      estimated_minutes: 10
    }
  },

  # Data Import Group
  {
    name: 'Import Contacts',
    description: 'Bring in your existing contacts, suppliers, and clients',
    task_type: 'milestone',
    group_name: 'Data Import',
    position: 7,
    metadata: {
      onboarding_step_key: 'import_contacts',
      category: 'data_import',
      required: false,
      import_type: 'contacts',
      template_available: true,
      estimated_minutes: 20
    }
  },
  {
    name: 'Import Jobs',
    description: 'Import your existing projects and jobs',
    task_type: 'milestone',
    group_name: 'Data Import',
    position: 8,
    metadata: {
      onboarding_step_key: 'import_jobs',
      category: 'data_import',
      required: false,
      import_type: 'jobs',
      template_available: true,
      estimated_minutes: 30
    }
  },
  {
    name: 'Import Pricebook Items',
    description: 'Import your product and service catalog',
    task_type: 'milestone',
    group_name: 'Data Import',
    position: 9,
    metadata: {
      onboarding_step_key: 'import_pricebook',
      category: 'data_import',
      required: false,
      import_type: 'pricebook_items',
      template_available: true,
      estimated_minutes: 30
    }
  },
  {
    name: 'Import Price History',
    description: 'Import historical pricing for trend analysis',
    task_type: 'milestone',
    group_name: 'Data Import',
    position: 10,
    metadata: {
      onboarding_step_key: 'import_price_history',
      category: 'data_import',
      required: false,
      import_type: 'price_histories',
      template_available: true,
      estimated_minutes: 15
    }
  },

  # Integrations Group
  {
    name: 'Connect Xero',
    description: 'Link your Xero accounting software',
    task_type: 'milestone',
    group_name: 'Integrations',
    position: 11,
    metadata: {
      onboarding_step_key: 'xero_connection',
      category: 'integrations',
      required: false,
      settings_path: '/settings/connections/integrations',
      estimated_minutes: 5
    }
  },
  {
    name: 'Connect Microsoft 365',
    description: 'Link your Microsoft account for email and calendar',
    task_type: 'milestone',
    group_name: 'Integrations',
    position: 12,
    metadata: {
      onboarding_step_key: 'microsoft_connection',
      category: 'integrations',
      required: false,
      settings_path: '/settings/connections/integrations',
      estimated_minutes: 5
    }
  },
  {
    name: 'Configure Email Sync',
    description: 'Set up email synchronization for project communication',
    task_type: 'milestone',
    group_name: 'Integrations',
    position: 13,
    metadata: {
      onboarding_step_key: 'email_sync',
      category: 'integrations',
      required: false,
      settings_path: '/settings/connections/migration',
      estimated_minutes: 10
    }
  }
]

# Create the tasks
onboarding_tasks.each do |task_data|
  # Find or create the group
  group = SmScheduleMasterGroup.find_or_create_by!(
    sm_schedule_master_template_id: template.id,
    name: task_data[:group_name]
  )

  # Create the task
  SmScheduleMasterTask.create!(
    sm_schedule_master_template_id: template.id,
    sm_schedule_master_group_id: group.id,
    name: task_data[:name],
    description: task_data[:description],
    task_type: task_data[:task_type],
    position: task_data[:position],
    duration_days: 0,
    lead_time_days: 0,
    metadata: task_data[:metadata]
  )

  puts "  -> Created task: #{task_data[:name]}"
end

puts "Created TEEEM Onboarding template with #{onboarding_tasks.size} tasks"
