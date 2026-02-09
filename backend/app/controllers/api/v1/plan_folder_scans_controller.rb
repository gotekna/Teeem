# frozen_string_literal: true

module Api
  module V1
    class PlanFolderScansController < ApplicationController
      # GET /api/v1/plan_folder_scans
      def index
        scans = PlanFolderScan.includes(:job, :job_plan).recent.limit(100)

        render json: {
          success: true,
          data: scans.map { |s| serialize_scan(s) },
          meta: {
            pending_count: PlanFolderScan.pending.count,
            processing_count: PlanFolderScan.processing.count,
            processed_count: PlanFolderScan.processed.count
          }
        }
      end

      # GET /api/v1/plan_folder_scans/pending_count
      # Used for navigation badge
      def pending_count
        render json: {
          success: true,
          pending_count: PlanFolderScan.pending.count
        }
      end

      # POST /api/v1/plan_folder_scans/:id/process
      # Manually trigger processing of a scanned file
      def process_scan
        scan = PlanFolderScan.find(params[:id])

        if scan.status == "pending" || scan.status == "error"
          PlanFolderProcessJob.perform_later(scan.id)
          render json: { success: true, message: "Processing queued" }
        else
          render json: { success: false, error: "Scan is not in pending state" }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/plan_folder_scans/:id/skip
      # Mark a file as skipped (not a plan)
      def skip
        scan = PlanFolderScan.find(params[:id])
        scan.mark_skipped!(params[:reason])

        render json: { success: true, data: serialize_scan(scan) }
      end

      # DELETE /api/v1/plan_folder_scans/:id
      def destroy
        scan = PlanFolderScan.find(params[:id])
        scan.destroy

        render json: { success: true }
      end

      # POST /api/v1/plan_folder_scans/scan_all
      # Scan all job folders for new plan files
      def scan_all
        PlanFolderScanJob.perform_later
        render json: {
          success: true,
          message: "Scan job queued. Results will appear shortly."
        }
      end

      private

      def serialize_scan(scan)
        {
          id: scan.id,
          job_id: scan.job_id,
          job_name: scan.job&.name,
          storage_reference: scan.storage_reference,
          file_name: scan.file_name,
          file_modified_at: scan.file_modified_at,
          file_size: scan.file_size,
          status: scan.status,
          job_plan_id: scan.job_plan_id,
          job_plan_name: scan.job_plan&.display_name,
          error_message: scan.error_message,
          processed_at: scan.processed_at,
          created_at: scan.created_at
        }
      end
    end
  end
end
