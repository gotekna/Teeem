# frozen_string_literal: true

# Job to analyze a job plan with AI and update its display name
# Downloads the PDF from SharePoint, runs through PlanIdentificationService
#
# SSoT: Uses PlanIdentificationService for ALL plan type matching
#
class PlanAiAnalysisJob < ApplicationJob
  queue_as :default

  def perform(job_plan_id)
    plan = JobPlan.find_by(id: job_plan_id)
    return unless plan

    revision = plan.current_revision
    return unless revision&.sharepoint_file_id.present?

    Rails.logger.info "[PlanAiAnalysisJob] Analyzing plan #{job_plan_id}: #{plan.display_name}"

    # Download the file from SharePoint
    credential = OrganizationSharePointCredential.active_credential
    return unless credential

    client = MicrosoftGraphClient.new(credential)
    content = client.download_file(revision.sharepoint_file_id)
    return unless content

    # Use PlanIdentificationService (THE ONE SSoT)
    # Pass processable: plan so AiProcessingLog links to this JobPlan for correction tracking
    result = PlanIdentification::PlanIdentificationService.identify(content, plan.job, processable: plan)

    Rails.logger.info "[PlanAiAnalysisJob] Service result: #{result.to_h.inspect}"

    # Update the plan with identified info
    if result.success?
      # Check if plan type is already used by another plan on this job
      variant_suffix = nil
      if result.plan_type.present?
        variant_suffix = PlanIdentification::PlanIdentificationService.find_variant_suffix(
          plan.job,
          result.plan_type.id,
          exclude_plan_id: plan.id
        )
      end

      # Build display name
      new_display_name = result.display_name || result.sheet_number

      plan.update!(
        plan_type_id: result.plan_type&.id,
        job_plan_tab_id: result.job_plan_tab&.id || plan.job_plan_tab_id,
        variant_suffix: variant_suffix,
        display_name: new_display_name
      )

      tab_name = result.job_plan_tab&.name || "none"
      Rails.logger.info(
        "[PlanAiAnalysisJob] Updated plan #{job_plan_id}: #{new_display_name} " \
        "(type: #{result.plan_type&.name || 'none'}, tab: #{tab_name}, " \
        "variant: #{variant_suffix || 'none'}, confidence: #{result.confidence}%)"
      )

      # Record identification for audit trail
      PlanIdentificationRecord.record_from_result(plan, result)
    else
      Rails.logger.info "[PlanAiAnalysisJob] No identification result for plan #{job_plan_id}"
    end
  end
end
