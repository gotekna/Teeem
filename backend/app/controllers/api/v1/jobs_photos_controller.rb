# frozen_string_literal: true

module Api
  module V1
    class JobsPhotosController < ApplicationController
      # GET /api/v1/jobs_photos
      # Returns jobs with their latest photos, grouped by supervisor
      # Params:
      #   - job_type_ids[]: array of job type IDs to filter by (required)
      #   - limit: max photos per job (default: 5)
      def index
        job_type_ids = params[:job_type_ids].presence
        photos_limit = (params[:limit] || 5).to_i.clamp(1, 10)

        # Return empty if no job types selected
        if job_type_ids.blank?
          return render json: {
            success: true,
            data: {
              total_jobs: 0,
              supervisors: {}
            }
          }
        end

        # Get Active status for filtering
        active_status = JobStatus.find_by(name: "Active")

        # Get jobs with the given job types (Active jobs only)
        jobs = Job.includes(:job_status, :job_type)
                  .where(job_status: active_status)
                  .where(job_type_id: job_type_ids)
                  .where.not(site_supervisor_name: [nil, ""])
                  .order(:site_supervisor_name, :name)

        # Build response grouped by supervisor
        grouped_data = {}

        jobs.find_each do |job|
          supervisor = job.site_supervisor_name || "Unassigned"

          # Get latest photos for this job from JobDocument (data warehouse)
          photos = JobDocument.where(job_id: job.id)
                              .where(file_type: "image")
                              .where.not(thumbnail_url: [nil, ""])
                              .order(last_modified_at: :desc)
                              .limit(photos_limit)

          # Skip jobs with no photos
          next if photos.empty?

          grouped_data[supervisor] ||= []
          grouped_data[supervisor] << {
            job_id: job.id,
            job_name: job.name,
            job_number: job.job_number,
            photos: photos.map do |photo|
              {
                id: photo.id,
                name: photo.file_name,
                thumbnail_url: photo.thumbnail_url,
                modified_at: photo.last_modified_at&.iso8601,
                days_old: photo.last_modified_at ? ((Time.current - photo.last_modified_at) / 1.day).to_i : nil
              }
            end
          }
        end

        # Sort supervisors alphabetically
        sorted_data = grouped_data.sort.to_h

        # Calculate total job count for frontend dynamic sizing
        total_jobs = sorted_data.values.flatten.size

        render json: {
          success: true,
          data: {
            total_jobs: total_jobs,
            supervisors: sorted_data
          }
        }
      end

      # GET /api/v1/jobs_photos/job_types
      # Returns available job types for the filter
      def job_types
        types = JobType.order(:name).select(:id, :name).map { |t| { id: t.id, name: t.name } }
        render json: { success: true, data: types }
      end
    end
  end
end
