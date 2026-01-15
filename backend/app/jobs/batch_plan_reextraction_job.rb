# frozen_string_literal: true

# =============================================================================
# BatchPlanReextractionJob - Batch re-extraction of plans with naming templates
# =============================================================================
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Downloads from Wasabi, SharePoint, or S3                         ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Uses BatchOperation for progress tracking (SSoT for all batch operations).
#
# This job coordinates re-extraction of all plans for a job:
# 1. Downloads each PDF from storage
# 2. Identifies plan type via PlanIdentificationService (SSoT)
# 3. Applies naming templates from PlanType (SSoT)
# 4. Updates display_name and renames storage file
#
# SSoT Compliance:
# - Uses BatchOperation for progress tracking
# - Uses PlanIdentificationService for ALL plan type matching
# - Uses PlanType.resolve_short_name (filename) / resolve_long_name (Display name)
# - Uses DocumentProviderAware for storage operations
# =============================================================================
class BatchPlanReextractionJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform(operation_id)
    @operation = BatchOperation.find_by(id: operation_id)
    return unless @operation
    return unless @operation.operation_type == "plan_reextract"

    @job = @operation.job
    return unless @job

    Rails.logger.info "[BatchPlanReextractionJob] Starting re-extraction for job #{@job.id}"

    # SSoT: Setup document provider using StorageConfiguration
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      @operation.mark_failed!("No storage provider configured: #{e.message}")
      return
    end

    # Get ALL plans with storage files (including combined PDFs like "All Plans")
    plans = @job.job_plans
                 .includes(:current_revision, :plan_type)
                 .joins(:current_revision)
                 .where.not(job_plan_revisions: { sharepoint_file_id: nil })
                 .order(:id)

    @operation.start_processing!(total: plans.count)

    plans.each_with_index do |plan, index|
      if plan.is_combined_pdf?
        process_combined_pdf!(plan, index)
      else
        process_single_plan!(plan, index)
      end
    rescue => e
      Rails.logger.error "[BatchPlanReextractionJob] Error processing plan #{plan.id}: #{e.message}"
      @operation.add_error!(item: plan.display_name, message: e.message)
    end

    @operation.mark_completed!
    Rails.logger.info "[BatchPlanReextractionJob] Completed re-extraction for job #{@job.id} (provider: #{current_provider_type})"
  rescue => e
    Rails.logger.error "[BatchPlanReextractionJob] Job failed: #{e.message}"
    @operation&.mark_failed!(e.message)
    raise
  end

  private

  # Process combined PDFs (like "All Plans") using the same template format
  def process_combined_pdf!(plan, index)
    @operation.update_progress!(
      processed: index,
      current_name: plan.display_name
    )

    revision = plan.current_revision
    return unless revision&.sharepoint_file_id.present?

    old_display_name = plan.display_name
    old_filename = revision.file_name

    # Build template values for combined PDF (use "ALL PLANS" instead of plan type name)
    template_values = build_combined_pdf_template_values(plan)

    # Use global default templates with "ALL PLANS" substituted
    new_filename = sanitize_filename(resolve_combined_template(:short, template_values)) + ".pdf"
    new_display_name = resolve_combined_template(:long, template_values)

    Rails.logger.info "[BatchPlanReextractionJob] Combined PDF #{plan.id}: '#{old_display_name}' -> '#{new_display_name}'"

    # Update plan record
    plan.update!(display_name: new_display_name)

    # Rename storage file if different
    if old_filename != new_filename
      rename_storage_file!(revision, new_filename)
    end

    @operation.add_completed_item!(new_display_name)
  end

  def process_single_plan!(plan, index)
    # Update progress for UI feedback
    @operation.update_progress!(
      processed: index,
      current_name: plan.display_name
    )

    revision = plan.current_revision
    return unless revision&.sharepoint_file_id.present?

    old_display_name = plan.display_name
    old_filename = revision.file_name

    # Download the file from storage
    content = download_from_provider(revision.sharepoint_file_id)
    return unless content

    # Use PlanIdentificationService (SSoT for plan identification)
    result = PlanIdentification::PlanIdentificationService.identify(
      content,
      @job,
      processable: plan
    )

    Rails.logger.info "[BatchPlanReextractionJob] Plan #{plan.id} identification result: #{result.success? ? 'success' : 'no match'}"

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
      # Short name = SharePoint filename, Long name = Display name
      new_filename = sanitize_filename(result.plan_type.resolve_short_name(template_values)) + ".pdf"
      new_display_name = result.plan_type.resolve_long_name(template_values)

      Rails.logger.info "[BatchPlanReextractionJob] Plan #{plan.id}: '#{old_display_name}' -> '#{new_display_name}'"

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
      @operation.add_completed_item!(new_display_name)

      # Record identification for audit trail
      PlanIdentificationRecord.record_from_result(plan, result)
    else
      Rails.logger.info "[BatchPlanReextractionJob] Plan #{plan.id}: No plan type identified, keeping existing name"
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
    # Invalid chars: < > : " / \ | ? *
    name.gsub(%r{[<>:"/\\|?*]}, "-").gsub(/\s+/, " ").strip
  end

  def rename_storage_file!(revision, new_filename)
    Rails.logger.info "[BatchPlanReextractionJob] Renaming storage file: #{revision.file_name} -> #{new_filename}"

    document_provider.rename_file(revision.sharepoint_file_id, new_filename)
    revision.update!(file_name: new_filename)

    Rails.logger.info "[BatchPlanReextractionJob] Storage file renamed successfully"
  rescue DocumentProviders::Error => e
    Rails.logger.error "[BatchPlanReextractionJob] Failed to rename storage file: #{e.message}"
    @operation.add_error!(item: revision.file_name, message: "Failed to rename: #{e.message}")
  rescue => e
    Rails.logger.error "[BatchPlanReextractionJob] Failed to rename storage file: #{e.message}"
    @operation.add_error!(item: revision.file_name, message: "Failed to rename: #{e.message}")
  end

  # Build template values for combined PDFs (All Plans)
  # Uses "00" as code and "ALL PLANS" as name
  def build_combined_pdf_template_values(plan)
    revision = plan.current_revision

    {
      # Job context
      job_code: format_job_code(@job),
      job_name: @job.name,
      job_address: @job.name,
      lot_number: @job.lot_number.to_s,
      street_name: @job.street_name.to_s,
      suburb: @job.suburb.to_s,
      project_name: @job.name,
      # Combined PDF uses "00" code and "ALL PLANS" name
      code: "00",
      name: "ALL PLANS",
      description: "Combined PDF containing all plans",
      category: "",
      category_code: "",
      # Revision context
      rev: revision&.revision || "A",
      date: Date.today.strftime("%Y%m%d"),
      variant: ""
    }
  end

  # Resolve template for combined PDFs using global defaults
  def resolve_combined_template(type, values)
    template = if type == :short
      PlanType.default_short_template
    else
      PlanType.default_long_template
    end

    PlanType.new.send(:resolve_template, template, values)
  end
end
