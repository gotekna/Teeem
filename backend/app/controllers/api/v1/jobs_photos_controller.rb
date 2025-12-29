# frozen_string_literal: true

module Api
  module V1
    class JobsPhotosController < ApplicationController
      # GET /api/v1/jobs_photos
      # Returns jobs with their latest photos, grouped by supervisor
      # Params:
      #   - statuses[]: array of job status names (required)
      #   - limit: max photos per job (default: 5)
      def index
        status_names = params[:statuses].presence
        photos_limit = (params[:limit] || 5).to_i.clamp(1, 10)

        # Return empty if no statuses selected
        if status_names.blank?
          return render json: {
            success: true,
            data: {
              statuses: [],
              total_jobs: 0,
              supervisors: {}
            }
          }
        end

        # Find the statuses
        statuses = JobStatus.where(name: status_names)

        # Get jobs with the given statuses
        jobs = Job.includes(:job_status)
                  .where(job_status: statuses)
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
                              .order(modified_at: :desc)
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
                modified_at: photo.modified_at&.iso8601,
                days_old: photo.modified_at ? ((Time.current - photo.modified_at) / 1.day).to_i : nil
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
            statuses: status_names,
            total_jobs: total_jobs,
            supervisors: sorted_data
          }
        }
      end

      # GET /api/v1/jobs_photos/statuses
      # Returns available job statuses for the filter dropdown
      def statuses
        statuses = JobStatus.order(:name).pluck(:name)
        render json: { success: true, data: statuses }
      end
    end
  end
end
