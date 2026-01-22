# frozen_string_literal: true

# =============================================================================
# PlanReextractionJob - Batch re-extraction of plans with naming templates
# =============================================================================
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Downloads from Wasabi, SharePoint, or S3                         ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# This job coordinates re-extraction of all plans for a job:
# 1. Downloads each PDF from storage
# 2. Identifies plan type via PlanIdentificationService (SSoT)
# 3. Applies naming templates from PlanType (SSoT)
# 4. Updates display_name and renames storage file
#
# SSoT Compliance:
# - Uses PlanIdentificationService for ALL plan type matching
# - Uses PlanType.resolve_short_name (filename) / resolve_long_name (Display name)
# - Uses DocumentProviderAware for storage operations
# =============================================================================
class PlanReextractionJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform(reextraction_id)
    @reextraction = PlanReextraction.find_by(id: reextraction_id)
    return unless @reextraction

    @job = @reextraction.job
    return unless @job

    Rails.logger.info "[PlanReextractionJob] Starting re-extraction for job #{@job.id}"

    # SSoT: Setup document provider using StorageConfiguration
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      @reextraction.mark_failed!("No storage provider configured: #{e.message}")
      return
    end

    # Get plans with storage files
    plans = @job.job_plans.includes(:current_revision, :plan_type)
                 .joins(:current_revision)
                 .where.not(job_plan_revisions: { storage_file_id: nil })
                 .order(:id)

    @reextraction.start_processing!(total: plans.count)

    plans.each_with_index do |plan, index|
      process_single_plan!(plan, index)
    rescue => e
      Rails.logger.error "[PlanReextractionJob] Error processing plan #{plan.id}: #{e.message}"
      @reextraction.add_rename_error!(plan.display_name, e.message)
    end

    @reextraction.mark_completed!
    Rails.logger.info "[PlanReextractionJob] Completed re-extraction for job #{@job.id} (provider: #{current_provider_type})"
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
    return unless revision&.storage_reference.present?

    old_display_name = plan.display_name
    old_filename = revision.file_name

    # Download the file from storage
    content = download_from_provider(revision.storage_reference)
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
      # Short name = filename, Long name = Display name
      new_filename = sanitize_filename(result.plan_type.resolve_short_name(template_values)) + ".pdf"
      new_display_name = result.plan_type.resolve_long_name(template_values)

      Rails.logger.info "[PlanReextractionJob] Plan #{plan.id}: '#{old_display_name}' -> '#{new_display_name}'"

      # Update plan record
      # Set is_combined_pdf flag if this is the "00-ALL PLANS" type
      is_combined = result.plan_type.code == "00"
      plan.update!(
        plan_type_id: result.plan_type.id,
        job_plan_tab_id: result.job_plan_tab&.id || plan.job_plan_tab_id,
        variant_suffix: variant_suffix,
        display_name: new_display_name,
        is_combined_pdf: is_combined
      )

      # Rename storage file if different
      if old_filename != new_filename
        rename_storage_file!(revision, new_filename)
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
    # SSoT: Use job_code from database column
    job.job_code
  end

  def sanitize_filename(name)
    # Remove characters invalid for storage filenames
    name.gsub(%r{[<>:"/\\|?*]}, "-").gsub(/\s+/, " ").strip
  end

  def rename_storage_file!(revision, new_filename)
    Rails.logger.info "[PlanReextractionJob] Renaming storage file: #{revision.file_name} -> #{new_filename}"

    # Use the provider's rename capability
    document_provider.rename_file(revision.storage_reference, new_filename)
    revision.update!(file_name: new_filename)

    Rails.logger.info "[PlanReextractionJob] Storage file renamed successfully"
  rescue DocumentProviders::Error => e
    Rails.logger.error "[PlanReextractionJob] Failed to rename storage file: #{e.message}"
    @reextraction.add_rename_error!(revision.file_name, e.message)
  rescue => e
    Rails.logger.error "[PlanReextractionJob] Failed to rename storage file: #{e.message}"
    @reextraction.add_rename_error!(revision.file_name, e.message)
  end
end
