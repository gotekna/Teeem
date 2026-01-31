# frozen_string_literal: true

# OnboardingStatusService - SSoT for Onboarding Completion Status
#
# This service is THE ONE source of truth for checking onboarding step completion.
# All completion checks are COMPUTED from real system state - never manual "mark complete".
#
# Usage:
#   service = OnboardingStatusService.new(tenant)
#   service.full_status        # Returns complete status of all steps
#   service.step_complete?(:storage_provider)  # Check individual step
#   service.required_complete? # All blocking steps done?
#   service.progress_percentage # Overall progress
#
# Step Categories:
#   - required: Must complete before using the app
#   - configuration: System setup (recommended but not blocking)
#   - data_import: Bring in existing data
#   - integrations: Connect external systems
#
class OnboardingStatusService
  # Minimum thresholds for completion detection
  CONTACT_THRESHOLD = 5   # At least 5 contacts imported
  JOB_THRESHOLD = 1       # At least 1 job created
  USER_THRESHOLD = 2      # At least 2 users (admin + one team member)

  # Step definitions with completion detection methods
  STEPS = {
    # Required steps (blocking)
    storage_provider: {
      name: 'Configure Storage Provider',
      description: 'Set up document storage (Wasabi, S3, or SharePoint)',
      category: :required,
      required: true,
      settings_path: '/settings/connections/provider',
      estimated_minutes: 10
    },
    company_info: {
      name: 'Complete Company Information',
      description: 'Add your company name, ABN/ACN, and contact details',
      category: :required,
      required: true,
      settings_path: '/settings/company/info',
      estimated_minutes: 5
    },
    first_user: {
      name: 'Invite First Team Member',
      description: 'Add at least one other user to your team',
      category: :required,
      required: true,
      settings_path: '/settings/users',
      estimated_minutes: 5
    },

    # Configuration steps (recommended)
    job_types: {
      name: 'Set Up Job Types',
      description: 'Define the types of jobs you manage (e.g., New Build, Renovation)',
      category: :configuration,
      required: false,
      settings_path: '/settings/company/job-setup',
      estimated_minutes: 10
    },
    job_statuses: {
      name: 'Configure Job Statuses & Stages',
      description: 'Define workflow stages for your jobs',
      category: :configuration,
      required: false,
      settings_path: '/settings/company/job-setup',
      estimated_minutes: 15
    },
    document_types: {
      name: 'Set Up Document Types',
      description: 'Configure document categories for your projects',
      category: :configuration,
      required: false,
      settings_path: '/settings/company/documents',
      estimated_minutes: 10
    },

    # Data Import steps
    import_contacts: {
      name: 'Import Contacts',
      description: 'Bring in your existing contacts, suppliers, and clients',
      category: :data_import,
      required: false,
      import_type: 'contacts',
      template_available: true,
      estimated_minutes: 20
    },
    import_jobs: {
      name: 'Import Jobs',
      description: 'Import your existing projects and jobs',
      category: :data_import,
      required: false,
      import_type: 'jobs',
      template_available: true,
      estimated_minutes: 30
    },
    import_pricebook: {
      name: 'Import Pricebook Items',
      description: 'Import your product and service catalog',
      category: :data_import,
      required: false,
      import_type: 'pricebook_items',
      template_available: true,
      estimated_minutes: 30
    },
    import_price_history: {
      name: 'Import Price History',
      description: 'Import historical pricing for trend analysis',
      category: :data_import,
      required: false,
      import_type: 'price_histories',
      template_available: true,
      estimated_minutes: 15
    },

    # Integration steps
    xero_connection: {
      name: 'Connect Xero',
      description: 'Link your Xero accounting software',
      category: :integrations,
      required: false,
      settings_path: '/settings/connections/integrations',
      estimated_minutes: 5
    },
    microsoft_connection: {
      name: 'Connect Microsoft 365',
      description: 'Link your Microsoft account for email and calendar',
      category: :integrations,
      required: false,
      settings_path: '/settings/connections/integrations',
      estimated_minutes: 5
    },
    email_sync: {
      name: 'Configure Email Sync',
      description: 'Set up email synchronization for project communication',
      category: :integrations,
      required: false,
      settings_path: '/settings/connections/migration',
      estimated_minutes: 10
    }
  }.freeze

  attr_reader :tenant

  def initialize(tenant)
    @tenant = tenant
  end

  # Get full status of all onboarding steps
  def full_status
    {
      tenant_id: tenant.id,
      started_at: tenant.onboarding_started_at,
      completed_at: tenant.onboarding_completed_at,
      in_progress: tenant.onboarding_in_progress?,
      progress: progress_summary,
      steps: all_steps_status,
      categories: categories_summary
    }
  end

  # Check if a specific step is complete
  def step_complete?(step_key)
    step_key = step_key.to_sym
    return false unless STEPS.key?(step_key)

    send("#{step_key}_complete?")
  rescue NoMethodError
    # Fallback for steps without specific completion check
    false
  end

  # Check if all required steps are complete
  def required_complete?
    required_steps.all? { |key, _| step_complete?(key) }
  end

  # Check if minimum viable setup is complete (can use app)
  def can_skip_to_app?
    required_complete?
  end

  # Overall progress percentage
  def progress_percentage
    total = STEPS.size
    completed = STEPS.keys.count { |key| step_complete?(key) }
    ((completed.to_f / total) * 100).round
  end

  # Required steps progress
  def required_progress_percentage
    total = required_steps.size
    completed = required_steps.keys.count { |key| step_complete?(key) }
    ((completed.to_f / total) * 100).round
  end

  # Get status for a single step
  def step_status(step_key)
    step_key = step_key.to_sym
    step = STEPS[step_key]
    return nil unless step

    complete = step_complete?(step_key)
    assigned_user = step_assignee(step_key)

    step.merge(
      key: step_key,
      complete: complete,
      status: step_status_value(step_key, complete),
      assigned_user_id: assigned_user&.id,
      assigned_user_name: assigned_user&.name
    )
  end

  # Refresh status (sync SmTasks if needed)
  def refresh!
    sync_sm_tasks_with_status
    full_status
  end

  private

  # Required steps only
  def required_steps
    STEPS.select { |_key, step| step[:required] }
  end

  # All steps with their status
  def all_steps_status
    STEPS.keys.map { |key| step_status(key) }
  end

  # Summary by category
  def categories_summary
    STEPS.group_by { |_key, step| step[:category] }.transform_values do |steps|
      {
        total: steps.size,
        complete: steps.count { |key, _| step_complete?(key) },
        steps: steps.map { |key, _| step_status(key) }
      }
    end
  end

  # Progress summary
  def progress_summary
    {
      total_steps: STEPS.size,
      completed_steps: STEPS.keys.count { |key| step_complete?(key) },
      percentage: progress_percentage,
      required_total: required_steps.size,
      required_complete: required_steps.keys.count { |key| step_complete?(key) },
      required_percentage: required_progress_percentage
    }
  end

  # Status value (not_started, in_progress, complete, skipped)
  def step_status_value(step_key, complete)
    return 'complete' if complete
    return 'skipped' if step_skipped?(step_key)

    step_in_progress?(step_key) ? 'in_progress' : 'not_started'
  end

  # Check if step was explicitly skipped
  def step_skipped?(step_key)
    # Check SmTask status or onboarding metadata
    sm_task = onboarding_sm_task(step_key)
    sm_task&.skipped_at.present?
  end

  # Check if step is in progress
  def step_in_progress?(step_key)
    sm_task = onboarding_sm_task(step_key)
    sm_task&.status == 'started'
  end

  # Get assignee for a step
  def step_assignee(step_key)
    sm_task = onboarding_sm_task(step_key)
    sm_task&.assigned_user
  end

  # Get SmTask for this step from onboarding job
  def onboarding_sm_task(step_key)
    return nil unless tenant.onboarding_job_id

    @sm_tasks ||= SmTask.where(job_id: tenant.onboarding_job_id).index_by do |task|
      task.metadata&.dig('onboarding_step_key')&.to_sym
    end

    @sm_tasks[step_key.to_sym]
  end

  # Sync SmTask statuses with computed completion
  def sync_sm_tasks_with_status
    return unless tenant.onboarding_job_id

    STEPS.each_key do |step_key|
      sm_task = onboarding_sm_task(step_key)
      next unless sm_task

      if step_complete?(step_key) && sm_task.status != 'completed'
        sm_task.update!(status: 'completed', completed_at: Time.current)
      end
    end
  end

  # =============================================================================
  # Completion Detection Methods (SSoT - computed from real state)
  # =============================================================================

  def storage_provider_complete?
    provider = WarehouseProvider.for_tenant(tenant)
    provider&.connected? || false
  end

  def company_info_complete?
    setting = tenant.tenant_setting
    return false unless setting

    setting.company_name.present? && (setting.abn.present? || setting.acn.present?)
  end

  def first_user_complete?
    User.count >= USER_THRESHOLD
  end

  def job_types_complete?
    JobType.count >= 1
  end

  def job_statuses_complete?
    JobStatus.count >= 2  # At least active and completed
  end

  def document_types_complete?
    DocumentType.count >= 3  # A few document types configured
  end

  def import_contacts_complete?
    Contact.count >= CONTACT_THRESHOLD
  end

  def import_jobs_complete?
    Job.customer_facing.count >= JOB_THRESHOLD
  end

  def import_pricebook_complete?
    PricebookItem.count >= 10
  end

  def import_price_history_complete?
    PriceHistory.count >= 5
  end

  def xero_connection_complete?
    XeroCredential.connected.any?
  end

  def microsoft_connection_complete?
    MicrosoftCredential.connected.any?
  end

  def email_sync_complete?
    # Check if any email sync credentials are connected and active
    # credential_type: 'email' indicates email sync capability
    MicrosoftCredential.connected.where(credential_type: 'email').any?
  end
end
