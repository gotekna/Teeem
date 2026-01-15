# frozen_string_literal: true

require "hexapdf"

# =============================================================================
# PlanCombinerService - Auto-generate "All Plans" combined PDF
# =============================================================================
# Combines all individual plans into one PDF, sorted by plan_type.code.
# Called automatically after any plan is added/updated/deleted.
#
# SSoT:
# - Uses PlanType templates for naming (same as individual plans)
# - Uses HexaPDF for PDF merging (already used throughout codebase)
# - Uses StorageUploadable for provider-agnostic storage operations
# =============================================================================
class PlanCombinerService
  include StorageUploadable

  class CombineError < StandardError; end

  def initialize(job)
    @job = job
  end

  # Combine all individual plans into one "All Plans" PDF
  def combine_all_plans!
    Rails.logger.info "[PlanCombinerService] Starting combine for job #{@job.id}"

    plans = get_plans_to_combine
    return nil if plans.empty?

    combined_content = combine_pdfs(plans)
    return nil unless combined_content

    all_plans_record = find_or_create_all_plans_record
    folder_path = get_plans_folder_path
    filename = build_filename

    result = upload_to_storage_path(folder_path, combined_content, filename, content_type: "application/pdf")
    raise CombineError, "Failed to upload: #{result[:error]}" unless result[:success]

    update_revision(all_plans_record, result[:raw], filename)
    all_plans_record.update!(display_name: build_display_name)

    Rails.logger.info "[PlanCombinerService] Completed combine for job #{@job.id}"
    all_plans_record
  rescue => e
    Rails.logger.error "[PlanCombinerService] Error: #{e.message}"
    raise
  end

  private

  def get_plans_to_combine
    @job.job_plans
        .regular_plans # exclude existing combined PDF
        .includes(:current_revision, :plan_type)
        .joins(:current_revision)
        .where("job_plan_revisions.sharepoint_file_id IS NOT NULL OR job_plan_revisions.storage_path IS NOT NULL")
        .sort_by { |p| p.plan_type&.code || "999" }
  end

  def combine_pdfs(plans)
    target = HexaPDF::Document.new

    plans.each_with_index do |plan, index|
      revision = plan.current_revision
      file_ref = revision&.storage_path || revision&.sharepoint_file_id
      next unless file_ref

      result = download_from_storage(file_ref)
      next unless result[:success]

      source = HexaPDF::Document.new(io: StringIO.new(result[:content]))
      source.pages.each { |page| target.pages << target.import(page) }
      Rails.logger.info "[PlanCombinerService] Added plan #{index + 1}: #{plan.display_name} (#{source.pages.count} pages)"
    rescue => e
      Rails.logger.warn "[PlanCombinerService] Could not add plan #{plan.id}: #{e.message}"
    end

    return nil if target.pages.count == 0

    output = StringIO.new
    target.write(output, optimize: true)
    output.string
  end

  def find_or_create_all_plans_record
    all_plans_type = PlanType.find_by(code: "00")

    existing = @job.job_plans.find_by(is_combined_pdf: true)
    return existing if existing

    @job.job_plans.create!(
      plan_type: all_plans_type,
      is_combined_pdf: true,
      display_name: build_display_name
    )
  end

  def update_revision(all_plans_record, upload_result, filename)
    revision = all_plans_record.current_revision

    if revision
      # Update existing revision - support both SharePoint and S3/Wasabi results
      revision.update!(
        sharepoint_file_id: upload_result[:id],
        sharepoint_web_url: upload_result[:web_url] || upload_result[:url],
        storage_path: upload_result[:path],
        file_name: filename
      )
    else
      # Create new revision
      revision = all_plans_record.revisions.create!(
        revision: "A",
        revision_date: Date.current,
        sharepoint_file_id: upload_result[:id],
        sharepoint_web_url: upload_result[:web_url] || upload_result[:url],
        storage_path: upload_result[:path],
        file_name: filename
      )
      all_plans_record.update!(current_revision: revision)
    end
  end

  def get_plans_folder_path
    raise CombineError, "Job has no storage folder" unless @job.storage_folder_path.present?
    "#{@job.storage_folder_path}/#{EntityTab.folder_name_for('job', 'plans', '04 Plans')}"
  end

  def build_filename
    all_plans_type = PlanType.find_by(code: "00")
    return "All Plans.pdf" unless all_plans_type

    template_values = build_template_values(all_plans_type)
    sanitize_filename(all_plans_type.resolve_short_name(template_values)) + ".pdf"
  end

  def build_display_name
    all_plans_type = PlanType.find_by(code: "00")
    return "All Plans" unless all_plans_type

    template_values = build_template_values(all_plans_type)
    all_plans_type.resolve_long_name(template_values)
  end

  def build_template_values(plan_type)
    {
      job_code: "J#{@job.id.to_s.rjust(3, '0')}",
      job_name: @job.name,
      job_address: @job.name,
      lot_number: @job.lot_number.to_s,
      street_name: @job.street_name.to_s,
      suburb: @job.suburb.to_s,
      project_name: @job.name,
      code: plan_type.code,
      name: plan_type.name,
      description: plan_type.notes.to_s,
      category: "",
      category_code: "",
      rev: "A",
      date: Date.today.strftime("%Y%m%d"),
      variant: ""
    }
  end

  def sanitize_filename(name)
    name.gsub(%r{[<>:"/\\|?*]}, "-").gsub(/\s+/, " ").strip
  end
end
