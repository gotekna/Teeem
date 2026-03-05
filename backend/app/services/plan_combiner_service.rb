# frozen_string_literal: true

require "hexapdf"

# =============================================================================
# PlanCombinerService - Auto-generate "All Plans" combined PDF
# =============================================================================
# Combines all individual plans into one PDF, sorted by plan_type.code.
# Called automatically after any plan is added/updated/deleted.
#
# Blob-only storage (Mar 2026): Downloads plan content from StorageBlob,
# creates combined PDF as a new StorageBlob + WarehouseDocument.
# No legacy S3 folder structure used.
# =============================================================================
class PlanCombinerService
  class CombineError < StandardError; end

  def initialize(job)
    @job = job
  end

  def combine_all_plans!
    Rails.logger.info "[PlanCombinerService] Starting combine for job #{@job.id}"

    plans = get_plans_to_combine
    return nil if plans.empty?

    combined_content = combine_pdfs(plans)
    return nil unless combined_content

    all_plans_record = find_or_create_all_plans_record
    filename = build_filename

    update_revision(all_plans_record, filename, combined_content)
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
        .regular_plans
        .includes(:current_revision, :plan_type)
        .joins(:current_revision)
        .where("job_plan_revisions.storage_blob_id IS NOT NULL")
        .sort_by { |p| p.plan_type&.code || "999" }
  end

  def combine_pdfs(plans)
    require "hexapdf"
    target = HexaPDF::Document.new

    plans.each_with_index do |plan, index|
      revision = plan.current_revision
      blob = revision&.storage_blob
      next unless blob

      content = blob.download
      next unless content.present?

      source = HexaPDF::Document.new(io: StringIO.new(content))
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

  def update_revision(all_plans_record, filename, combined_content)
    blob = create_storage_blob(combined_content, filename)

    revision = all_plans_record.current_revision

    if revision
      revision.update!(
        storage_blob: blob,
        file_name: filename
      )
    else
      revision = all_plans_record.revisions.create!(
        revision: "A",
        revision_date: Date.current,
        storage_blob: blob,
        file_name: filename
      )
      all_plans_record.update!(current_revision: revision)
    end

    create_warehouse_document(blob, filename, combined_content.bytesize) if blob
  end

  def create_storage_blob(content, filename)
    StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: "application/pdf"
    )
  end

  def create_warehouse_document(blob, filename, file_size)
    plans_folder = WarehouseFolder.where(warehouse_type: "job", tab_key: "plans").enabled.first

    WarehouseDocumentCreator.find_or_create!(
      find_by: {
        source_type: "job",
        linkable: @job,
        metadata_match: { "plan_type" => "combined" }
      },
      filename: filename,
      source_type: "job",
      linkable: @job,
      storage_blob: blob,
      warehouse_folder_id: plans_folder&.id,
      file_size: file_size,
      content_type: "application/pdf",
      metadata: { "plan_type" => "combined" }
    )
    blob.increment_reference!
    Rails.logger.info "[PlanCombinerService] Created/updated WarehouseDocument for #{filename}"
  rescue => e
    Rails.logger.warn "[PlanCombinerService] Failed to create WarehouseDocument for #{filename}: #{e.message}"
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
      job_code: @job.job_code,
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
      date: Date.current.strftime("%Y%m%d"),
      variant: ""
    }
  end

  def sanitize_filename(name)
    name.gsub(%r{[<>:"/\\|?*]}, "-").gsub(/\s+/, " ").strip
  end
end
