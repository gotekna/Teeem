# frozen_string_literal: true

# OnboardingProvisioningService - Sets up onboarding for a new tenant
#
# Creates the internal "Onboarding" job with SmTasks for tracking progress.
# Uses SmScheduleMasterTemplate for task definitions (dogfooding the system).
#
# Usage:
#   service = OnboardingProvisioningService.new(tenant)
#   result = service.provision!
#   # => { success: true, job: Job, tasks_created: 12 }
#
class OnboardingProvisioningService
  ONBOARDING_TEMPLATE_NAME = 'TEEEM Onboarding'.freeze
  ONBOARDING_JOB_NAME = 'System: Onboarding'.freeze

  attr_reader :tenant, :errors

  def initialize(tenant)
    @tenant = tenant
    @errors = []
  end

  # Provision onboarding for a tenant
  def provision!
    return { success: false, errors: ['Onboarding already provisioned'] } if already_provisioned?

    ActsAsTenant.with_tenant(@tenant) do
      ActiveRecord::Base.transaction do
        job = create_onboarding_job
        tasks_created = create_onboarding_tasks(job)

        @tenant.update!(
          onboarding_job_id: job.id,
          onboarding_started_at: Time.current
        )

        return {
          success: true,
          job: job,
          tasks_created: tasks_created
        }
      rescue StandardError => e
        @errors << e.message
        Rails.logger.error "[OnboardingProvisioning] Failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
        raise ActiveRecord::Rollback
      end
    end

    { success: false, errors: @errors }
  end

  # Check if tenant already has onboarding provisioned
  def already_provisioned?
    @tenant.onboarding_job_id.present?
  end

  # Reset onboarding (for testing/debugging)
  def reset!
    return { success: false, errors: ['No onboarding to reset'] } unless already_provisioned?

    ActsAsTenant.with_tenant(@tenant) do
      ActiveRecord::Base.transaction do
        # Delete existing onboarding job (cascades to tasks)
        Job.find_by(id: @tenant.onboarding_job_id)&.destroy

        # Clear tenant onboarding fields
        @tenant.update!(
          onboarding_job_id: nil,
          onboarding_started_at: nil,
          onboarding_completed_at: nil
        )

        return { success: true }
      end
    end

    { success: false, errors: ['Failed to reset onboarding'] }
  end

  private

  # Create the internal onboarding job
  def create_onboarding_job
    # Find or create a job status for internal jobs
    internal_status = JobStatus.find_or_create_by!(name: 'Internal') do |status|
      status.description = 'Internal system jobs'
      status.position = 999
    end

    # Create the onboarding job
    Job.create!(
      name: ONBOARDING_JOB_NAME,
      project_type: 'internal',
      job_status: internal_status,
      street_name: 'System',
      suburb: 'Internal',
      state: 'QLD',
      postcode: '4000'
    )
  end

  # Create SmTasks from the template or inline definitions
  def create_onboarding_tasks(job)
    template = SmScheduleMasterTemplate.find_by(name: ONBOARDING_TEMPLATE_NAME)

    if template
      # Use existing template
      result = SmScheduleMasterTemplateCopyService.new(template, job, {
        start_date: Date.current,
        clear_existing: true,
        create_purchase_orders: false
      }).execute

      return result[:tasks_created]
    end

    # No template - create inline tasks
    create_inline_onboarding_tasks(job)
  end

  # Create tasks inline if no template exists
  def create_inline_onboarding_tasks(job)
    tasks_created = 0
    position = 0

    OnboardingStatusService::STEPS.each do |step_key, step|
      task = SmTask.create!(
        job: job,
        name: step[:name],
        description: step[:description],
        status: 'not_started',
        position: position,
        task_type: 'milestone',
        metadata: {
          onboarding_step_key: step_key.to_s,
          category: step[:category].to_s,
          required: step[:required],
          settings_path: step[:settings_path],
          import_type: step[:import_type]
        }
      )

      position += 1
      tasks_created += 1

      Rails.logger.info "[OnboardingProvisioning] Created task: #{task.name} (#{step_key})"
    end

    tasks_created
  end
end
