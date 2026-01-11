# frozen_string_literal: true

module Api
  module V1
    class JobsPhotosController < ApplicationController
      # GET /api/v1/jobs_photos
      # Returns jobs with their latest photos, grouped by supervisor
      # Params:
      #   - job_type_ids[]: array of job type IDs to filter by (required)
      #   - status_ids[]: array of status IDs to filter by (optional, defaults to all non-lost)
      #   - limit: max photos per job (default: 5)
      def index
        job_type_ids = params[:job_type_ids].presence
        status_ids = params[:status_ids].presence
        photos_limit = (params[:limit] || 10).to_i.clamp(1, 20)

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

        # Build status filter - use provided IDs or default to all non-lost statuses
        if status_ids.present?
          status_filter = status_ids
        else
          # Default: all statuses except those with "lost" in the name
          status_filter = JobStatus.where.not("LOWER(name) LIKE ?", "%lost%").pluck(:id)
        end

        # Get jobs with the given job types and statuses
        jobs = Job.includes(:job_status, :job_type)
                  .where(job_status_id: status_filter)
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
            job_type: job.job_type&.name,
            job_status: job.job_status&.name,
            deposit: job.deposit,
            start_date: job.start_date&.iso8601,
            pc_date: job.practical_completion_date&.iso8601,
            photos: photos.map do |photo|
              # Build proxy URL for fetching image through backend (bypasses CORS and expired tokens)
              # SSoT: Same pattern as organization_sharepoint#download
              proxy_url = "/api/v1/documents/download?file_id=#{photo.sharepoint_item_id}&preview=true"
              {
                id: photo.id,
                name: photo.file_name,
                thumbnail_url: photo.thumbnail_url,  # Graph API thumbnail (may expire)
                proxy_url: proxy_url,                 # Backend proxy (always works)
                full_url: photo.web_url,
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

      # GET /api/v1/jobs_photos/statuses
      # Returns available job statuses for the filter (excludes "lost" statuses)
      def statuses
        statuses = JobStatus.where.not("LOWER(name) LIKE ?", "%lost%")
                            .order(:name)
                            .select(:id, :name)
                            .map { |s| { id: s.id, name: s.name } }
        render json: { success: true, data: statuses }
      end

      # GET /api/v1/jobs_photos/supervisors
      # Returns list of supervisors from User roles (SSoT: user_roles + roles tables)
      def supervisors
        names = User.with_role("supervisor").order(:name).pluck(:name)
        render json: { success: true, data: names }
      end
    end
  end
end
