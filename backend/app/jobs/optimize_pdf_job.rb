# frozen_string_literal: true

# Automatically optimizes large PDFs after upload using Ghostscript.
#
# Scanned PDFs (print→stamp→scan) can be 100+ MB when the digital original
# is under 1 MB. Ghostscript recompresses embedded raster images to achieve
# ~90-96% reduction with no visible quality loss.
#
# Safety:
#   - Skips non-PDFs, files < 10 MB, and already-optimized blobs
#   - Validates GS output (PDF header, minimum size, >30% reduction)
#   - All heavy work in GS subprocess + disk I/O (~5 MB Ruby heap)
#   - Idempotent via pdf_optimized metadata check
#   - Original kept if optimization fails or doesn't help enough
#
class OptimizePdfJob < ApplicationJob
  queue_as :low

  # Don't retry GS failures — if it fails once, manual intervention needed
  discard_on StandardError do |job, error|
    Rails.logger.error "[OptimizePdf] Discarded job for blob #{job.arguments.first}: #{error.message}"
    mark_failed(job.arguments.first, job.arguments.second, error.message)
  end

  MINIMUM_SIZE = 10.megabytes
  MINIMUM_REDUCTION_PERCENT = 30
  MINIMUM_OUTPUT_SIZE = 1.kilobyte
  PDF_HEADER = "%PDF"

  def perform(storage_blob_id, warehouse_document_id: nil)
    @blob = StorageBlob.find_by(id: storage_blob_id)
    return unless @blob

    # Guards
    return unless pdf_content_type?
    return if @blob.file_size.to_i < MINIMUM_SIZE
    return if already_optimized?

    # Set tenant context from blob's linked records
    tenant = resolve_tenant
    return unless tenant

    ActsAsTenant.with_tenant(tenant) do
      mark_status("optimizing", warehouse_document_id)
      optimize!
    end
  rescue StandardError => e
    Rails.logger.error "[OptimizePdf] Failed for blob #{storage_blob_id}: #{e.class} - #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    mark_status("failed", warehouse_document_id, error: e.message)
  end

  private

  def pdf_content_type?
    @blob.content_type&.include?("pdf")
  end

  def already_optimized?
    # Check all linked WarehouseDocuments for optimization flag
    @blob.warehouse_documents.any? { |doc| doc.meta("pdf_optimized") == true }
  end

  def resolve_tenant
    # Try blob's tenant_id first
    return @blob.tenant if @blob.tenant_id.present?

    # Try ActsAsTenant
    return ActsAsTenant.current_tenant if ActsAsTenant.current_tenant.present?

    # Try through linked documents
    doc = @blob.warehouse_documents.first
    return doc.tenant if doc&.tenant_id.present?

    Rails.logger.warn "[OptimizePdf] No tenant found for blob #{@blob.id}, skipping"
    nil
  end

  def optimize!
    original_size = @blob.file_size.to_i
    Rails.logger.info "[OptimizePdf] Starting optimization for blob #{@blob.id} (#{human_size(original_size)})"

    provider = DocumentProviders::S3Compatible.for_tenant(ActsAsTenant.current_tenant)
    input_tempfile = provider.download_to_tempfile(@blob.storage_path)

    begin
      output_tempfile = run_ghostscript(input_tempfile.path)

      begin
        optimized_size = File.size(output_tempfile.path)

        # Validate output
        unless valid_pdf?(output_tempfile.path)
          Rails.logger.warn "[OptimizePdf] GS output is not a valid PDF, keeping original"
          mark_all_documents("skipped", reason: "invalid_output")
          return
        end

        reduction_percent = ((original_size - optimized_size).to_f / original_size * 100).round(1)

        if optimized_size < MINIMUM_OUTPUT_SIZE
          Rails.logger.warn "[OptimizePdf] GS output too small (#{optimized_size} bytes), keeping original"
          mark_all_documents("skipped", reason: "output_too_small")
          return
        end

        if reduction_percent < MINIMUM_REDUCTION_PERCENT
          Rails.logger.info "[OptimizePdf] Insufficient reduction (#{reduction_percent}%), keeping original"
          mark_all_documents("skipped", reason: "insufficient_reduction", reduction: reduction_percent)
          return
        end

        # Success — replace blob content
        replace_blob_content!(output_tempfile.path, optimized_size, provider)

        Rails.logger.info "[OptimizePdf] Optimized blob #{@blob.id}: #{human_size(original_size)} -> #{human_size(optimized_size)} (#{reduction_percent}% reduction)"

        mark_all_documents("completed",
          original_size: original_size,
          optimized_size: optimized_size,
          reduction_percent: reduction_percent
        )
      ensure
        output_tempfile.close! rescue nil
      end
    ensure
      input_tempfile.close! rescue nil
    end
  end

  def run_ghostscript(input_path)
    output_tempfile = Tempfile.new(["gs_optimized", ".pdf"], binmode: true)
    output_tempfile.close # GS writes to path directly

    gs_command = [
      "gs",
      "-sDEVICE=pdfwrite",
      "-dPDFSETTINGS=/ebook",        # 150 DPI images, good for scanned docs
      "-dCompatibilityLevel=1.4",
      "-dNOPAUSE",
      "-dBATCH",
      "-dQUIET",
      "-sOutputFile=#{output_tempfile.path}",
      input_path
    ]

    Rails.logger.info "[OptimizePdf] Running: #{gs_command.first(3).join(' ')} ... #{File.basename(input_path)}"

    stdout, stderr, status = Open3.capture3(*gs_command)

    unless status.success?
      raise "Ghostscript failed (exit #{status.exitstatus}): #{stderr.first(500)}"
    end

    output_tempfile
  end

  def valid_pdf?(path)
    File.open(path, "rb") do |f|
      header = f.read(4)
      header == PDF_HEADER
    end
  rescue StandardError
    false
  end

  def replace_blob_content!(optimized_path, optimized_size, provider)
    new_hash = Digest::SHA256.file(optimized_path).hexdigest

    # Check if a blob with this hash already exists (dedup)
    existing = StorageBlob.unscoped.find_by(content_hash: new_hash)
    if existing && existing.id != @blob.id
      Rails.logger.info "[OptimizePdf] Optimized content matches existing blob #{existing.id}, repointing"
      repoint_to_existing_blob(existing)
      return
    end

    # Upload optimized file to same storage path (overwrite)
    File.open(optimized_path, "rb") do |io|
      provider.upload_file(
        File.dirname(@blob.storage_path),
        io,
        File.basename(@blob.storage_path),
        content_type: "application/pdf"
      )
    end

    # Update blob metadata
    @blob.update!(
      content_hash: new_hash,
      file_size: optimized_size
    )
  end

  def repoint_to_existing_blob(existing_blob)
    @blob.warehouse_documents.find_each do |doc|
      doc.update!(storage_blob: existing_blob)
      existing_blob.increment_reference!
      @blob.decrement_reference!
    end
  end

  def mark_status(status, warehouse_document_id, error: nil)
    meta = { "pdf_optimization_status" => status }
    meta["pdf_optimization_error"] = error if error

    if warehouse_document_id
      doc = WarehouseDocument.find_by(id: warehouse_document_id)
      if doc
        doc.set_metadata(meta)
        doc.save!
      end
    end
  end

  def mark_all_documents(status, reason: nil, original_size: nil, optimized_size: nil, reduction_percent: nil)
    meta = {
      "pdf_optimization_status" => status,
      "pdf_optimized" => (status == "completed")
    }
    meta["pdf_original_size"] = original_size if original_size
    meta["pdf_optimized_size"] = optimized_size if optimized_size
    meta["pdf_reduction_percent"] = reduction_percent if reduction_percent
    meta["pdf_optimization_reason"] = reason if reason
    meta["pdf_optimized_at"] = Time.current.iso8601 if status == "completed"

    @blob.warehouse_documents.find_each do |doc|
      doc.set_metadata(meta)
      doc.save!
    end
  end

  def human_size(bytes)
    if bytes >= 1.megabyte
      "#{(bytes.to_f / 1.megabyte).round(1)} MB"
    elsif bytes >= 1.kilobyte
      "#{(bytes.to_f / 1.kilobyte).round(1)} KB"
    else
      "#{bytes} B"
    end
  end

  # Class method for discard_on callback
  def self.mark_failed(blob_id, _wd_id, error_message)
    blob = StorageBlob.find_by(id: blob_id)
    return unless blob

    blob.warehouse_documents.find_each do |doc|
      doc.set_metadata(
        "pdf_optimization_status" => "failed",
        "pdf_optimization_error" => error_message&.first(200)
      )
      doc.save
    end
  rescue StandardError => e
    Rails.logger.error "[OptimizePdf] Failed to mark_failed: #{e.message}"
  end
end
