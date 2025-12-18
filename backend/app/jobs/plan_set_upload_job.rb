# frozen_string_literal: true

# Background job to process plan set uploads (PDF splitting and SharePoint upload)
# This runs in background to avoid Heroku's 30-second timeout
class PlanSetUploadJob < ApplicationJob
  queue_as :default

  def perform(job_id, file_path, original_filename, tab_id = nil)
    job = Job.find(job_id)

    Rails.logger.info "[PlanSetUploadJob] Starting for job #{job_id}, file: #{original_filename}"

    # Open the temp file
    file = File.open(file_path, 'rb')
    uploaded_file = ActionDispatch::Http::UploadedFile.new(
      tempfile: file,
      filename: original_filename,
      type: 'application/pdf'
    )

    # Process with PlanSetService - skip AI, will be done later
    service = PlanSetService.new(job, uploaded_file)
    result = service.process!(skip_ai: true)

    unless result[:success]
      Rails.logger.error "[PlanSetUploadJob] PlanSetService failed: #{result[:error]}"
      return
    end

    # Get the first tab if not specified
    tab_id ||= job.job_plan_tabs.root_tabs.ordered.first&.id

    plans_for_ai_analysis = []

    # Create job plan for "All Plans"
    if result[:all_plans].present?
      all_plans_plan = job.job_plans.create!(
        job_plan_tab_id: tab_id,
        plan_type_id: nil,
        display_name: "All Plans"
      )

      all_plans_plan.add_revision!(
        sharepoint_file_id: result[:all_plans][:file_id],
        sharepoint_web_url: result[:all_plans][:web_url],
        file_name: result[:all_plans][:name],
        file_size: result[:all_plans][:size],
        revision_date: Date.today
      )

      Rails.logger.info "[PlanSetUploadJob] Created All Plans entry"
    end

    # Create job plans for each individual page
    result[:pages].each do |page|
      display_name = page[:name].sub(/\.pdf$/i, '')

      plan = job.job_plans.create!(
        job_plan_tab_id: tab_id,
        plan_type_id: nil,
        display_name: display_name
      )

      plan.add_revision!(
        sharepoint_file_id: page[:file_id],
        sharepoint_web_url: page[:web_url],
        file_name: page[:name],
        file_size: page[:size],
        revision_date: Date.today
      )

      plans_for_ai_analysis << plan.id
      Rails.logger.info "[PlanSetUploadJob] Created plan: #{display_name}"
    end

    # Queue AI analysis jobs
    plans_for_ai_analysis.each_with_index do |plan_id, index|
      PlanAiAnalysisJob.set(wait: (index * 3).seconds).perform_later(plan_id)
    end

    Rails.logger.info "[PlanSetUploadJob] Completed! Created #{plans_for_ai_analysis.length + 1} plans, queued #{plans_for_ai_analysis.length} AI analysis jobs"

  ensure
    # Clean up temp file
    file&.close
    File.delete(file_path) if file_path && File.exist?(file_path)
  end
end
