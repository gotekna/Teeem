# frozen_string_literal: true

# =============================================================================
# PlanReextractionJob - Batch re-extraction of plans with naming templates
# =============================================================================
# This job coordinates re-extraction of all plans for a job:
# 1. Downloads each PDF from SharePoint
# 2. Identifies plan type via PlanIdentificationService (SSoT)
# 3. Applies naming templates from PlanType (SSoT)
# 4. Updates display_name and renames SharePoint file
#
# SSoT Compliance:
# - Uses PlanIdentificationService for ALL plan type matching
# - Uses PlanType.resolve_short_name/resolve_long_name for naming
# - Uses MicrosoftGraphClient for SharePoint operations
# =============================================================================
class PlanReextractionJob < ApplicationJob
  queue_as :default

  def perform(reextraction_id)
    @reextraction = PlanReextraction.find_by(id: reextraction_id)
    return unless @reextraction

    @job = @reextraction.job
    return unless @job

    Rails.logger.info "[PlanReextractionJob] Starting re-extraction for job #{@job.id}"

    # Get plans with SharePoint files
    plans = @job.job_plans.includes(:current_revision, :plan_type)
                 .joins(:current_revision)
                 .where.not(job_plan_revisions: { sharepoint_file_id: nil })
                 .order(:id)

    @reextraction.start_processing!(total: plans.count)

    plans.each_with_index do |plan, index|
      process_single_plan!(plan, index)
    rescue => e
      Rails.logger.error "[PlanReextractionJob] Error processing plan #{plan.id}: #{e.message}"
      @reextraction.add_rename_error!(plan.display_name, e.message)
    end

    @reextraction.mark_completed!
    Rails.logger.info "[PlanReextractionJob] Completed re-extraction for job #{@job.id}"
  rescue => e
    Rails.logger.error "[PlanReextractionJob] Job failed: #{e.message}"
    @reextraction&.mark_failed!(e.message)
    raise
  end

  private

  def process_single_plan!(plan, index)
    # Update progress for UI feedback
    @reextraction.update_progress!(
      processed: index,
      current_name: plan.display_name
    )

    revision = plan.current_revision
    return unless revision&.sharepoint_file_id.present?

    old_display_name = plan.display_name
    old_filename = revision.file_name

    # Download the file from SharePoint
    credential = OrganizationSharePointCredential.active_credential
    return unless credential

    client = MicrosoftGraphClient.new(credential)
    content = client.download_file(revision.sharepoint_file_id)
    return unless content

    # Use PlanIdentificationService (SSoT for plan identification)
    result = PlanIdentification::PlanIdentificationService.identify(
      content,
      @job,
      processable: plan
    )

    Rails.logger.info "[PlanReextractionJob] Plan #{plan.id} identification result: #{result.success? ? 'success' : 'no match'}"

    if result.success? && result.plan_type.present?
      # Calculate variant suffix if plan type already used by another plan
      variant_suffix = PlanIdentification::PlanIdentificationService.find_variant_suffix(
        @job,
        result.plan_type.id,
        exclude_plan_id: plan.id
      )

      # Build template values from job context
      template_values = build_template_values(plan, result, variant_suffix)

      # Resolve templates (SSoT: PlanType model)
      new_display_name = result.plan_type.resolve_short_name(template_values)
      new_filename = sanitize_filename(result.plan_type.resolve_long_name(template_values)) + ".pdf"

      Rails.logger.info "[PlanReextractionJob] Plan #{plan.id}: '#{old_display_name}' -> '#{new_display_name}'"

      # Update plan record
      plan.update!(
        plan_type_id: result.plan_type.id,
        job_plan_tab_id: result.job_plan_tab&.id || plan.job_plan_tab_id,
        variant_suffix: variant_suffix,
        display_name: new_display_name
      )

      # Rename SharePoint file if different
      if old_filename != new_filename
        rename_sharepoint_file!(revision, new_filename, client)
      end

      # Record successful update
      @reextraction.add_updated_plan!(new_display_name)

      # Record identification for audit trail
      PlanIdentificationRecord.record_from_result(plan, result)
    else
      Rails.logger.info "[PlanReextractionJob] Plan #{plan.id}: No plan type identified, keeping existing name"
    end
  end

  def build_template_values(plan, result, variant_suffix)
    revision = plan.current_revision
    plan_type = result.plan_type
    category = plan_type.plan_categories.first

    {
      # Job context
      job_code: format_job_code(@job),
      job_name: @job.name,
      job_address: @job.name,
      lot_number: @job.lot_number.to_s,
      street_name: @job.street_name.to_s,
      suburb: @job.suburb.to_s,
      project_name: @job.name,
      # Plan type context
      code: plan_type.code,
      name: plan_type.name,
      description: plan_type.notes.to_s,
      category: category&.name.to_s,
      category_code: category&.code.to_s,
      # Revision context
      rev: revision&.revision || "A",
      date: Date.today.strftime("%Y%m%d"),
      variant: variant_suffix.to_s
    }
  end

  def format_job_code(job)
    # Format job ID as a code (e.g., "46" -> "J046")
    "J#{job.id.to_s.rjust(3, '0')}"
  end

  def sanitize_filename(name)
    # Remove characters invalid for SharePoint filenames
    # Invalid chars: < > : " / \ | ? *
    name.gsub(%r{[<>:"/\\|?*]}, "-").gsub(/\s+/, " ").strip
  end

  def rename_sharepoint_file!(revision, new_filename, client)
    Rails.logger.info "[PlanReextractionJob] Renaming SharePoint file: #{revision.file_name} -> #{new_filename}"

    client.rename_file(revision.sharepoint_file_id, new_filename)
    revision.update!(file_name: new_filename)

    Rails.logger.info "[PlanReextractionJob] SharePoint file renamed successfully"
  rescue => e
    Rails.logger.error "[PlanReextractionJob] Failed to rename SharePoint file: #{e.message}"
    @reextraction.add_rename_error!(revision.file_name, e.message)
  end
end
