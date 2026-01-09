# frozen_string_literal: true

# =============================================================================
# BatchFolderProcessJob - Process pending scanned files into plans
# =============================================================================
# Uses BatchOperation for progress tracking (SSoT for all batch operations).
#
# This job processes files found by BatchFolderScanJob:
# 1. Downloads each pending file from SharePoint
# 2. Identifies job context (from folder structure)
# 3. Identifies plan type via PlanIdentificationService
# 4. Creates JobPlan record with proper naming
#
# Progress tracking:
# - total_items: number of files to process
# - processed_items: files processed so far
# - current_item_name: filename being processed
# - items_completed: plan names created
# =============================================================================
class BatchFolderProcessJob < ApplicationJob
  queue_as :default

  def perform(operation_id)
    @operation = BatchOperation.find_by(id: operation_id)
    return unless @operation
    return unless @operation.operation_type == "folder_process"

    Rails.logger.info "[BatchFolderProcessJob] Starting folder processing"

    # TODO: Get pending files from PendingScanFile model
    # For now, this is a placeholder
    pending_files = []

    @operation.start_processing!(total: pending_files.count)

    pending_files.each_with_index do |pending_file, index|
      process_file!(pending_file, index)
    rescue => e
      Rails.logger.error "[BatchFolderProcessJob] Error processing file #{pending_file.id}: #{e.message}"
      @operation.add_error!(item: pending_file.filename, message: e.message)
    end

    @operation.mark_completed!
    Rails.logger.info "[BatchFolderProcessJob] Completed folder processing"
  rescue => e
    Rails.logger.error "[BatchFolderProcessJob] Job failed: #{e.message}"
    @operation&.mark_failed!(e.message)
    raise
  end

  private

  def process_file!(pending_file, index)
    @operation.update_progress!(
      processed: index,
      current_name: pending_file.filename
    )

    # TODO: Implement file processing logic
    # 1. Download from SharePoint
    # 2. Identify plan type
    # 3. Create JobPlan record
    # 4. Mark pending file as processed

    Rails.logger.info "[BatchFolderProcessJob] Processing: #{pending_file.filename}"
  end
end
